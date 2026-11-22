import { createRequire } from "node:module";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";

// Training records and qualification requirements against a seeded database.
const require = createRequire(import.meta.url);
const { createTrainingService } = require(path.resolve(__dirname, "../../electron/main/training-service.js"));
let db: TestDatabase;
let training: any;
let pilot: string;
let manager: string;
// "Today" for these tests: 2026-11-21, local time.
const now = () => new Date(2026, 10, 21, 12, 0, 0);

beforeAll(async () => {
    db = createTestDatabase();
    db.run("tsx", ["prisma/seed.ts"]);
    training = createTrainingService(db.prisma, { now });
    pilot = (await db.prisma.user.create({ data: { username: "pilot1", passwordHash: "x", firstName: "Pat", lastName: "Pilot", status: "ACTIVE" } })).id;
    const tm = await db.prisma.role.findUniqueOrThrow({ where: { roleName: "Training_Manager" } });
    manager = (await db.prisma.user.create({ data: { username: "tm1", passwordHash: "x", firstName: "Tess", lastName: "Manager", status: "ACTIVE", userRoles: { create: { roleId: tm.id } } } })).id;
    for (const code of ["PIC", "IFR"]) {
        const q = await db.prisma.qualification.findUniqueOrThrow({ where: { code } });
        await db.prisma.userQualification.create({ data: { userId: pilot, qualificationId: q.id } });
    }
});
afterAll(async () => { await db.cleanup(); });

const program = async (code: string) => (await db.prisma.trainingProgram.findUniqueOrThrow({ where: { code } })).id;
const record = async (code: string, date: string) => {
    const result = await training.submit(pilot, { programId: await program(code), completionDate: date });
    expect(result.success, result.message).toBe(true);
    return (await db.prisma.userTrainingRecord.findFirstOrThrow({ where: { userId: pilot, program: { code } }, orderBy: { submittedAt: "desc" } })).id;
};
const mine = async () => (await training.myTraining(pilot)).qualifications;
const statusOf = async (code: string) => (await mine()).find((q: any) => q.code === code);

describe("seeded requirements", () => {
    it("give PIC its checks, company training and a current CRM, and IFR a current PIC", async () => {
        const pic = await statusOf("PIC");
        expect(pic.items.map((i: any) => `${i.type}:${i.code}`)).toEqual(["TRAINING:135.293", "TRAINING:135.299", "TRAINING:COMPANY_RECURRENT", "QUALIFICATION:CRM"]);
        expect((await statusOf("IFR")).items.map((i: any) => i.code)).toEqual(["135.293", "135.297", "PIC"]);
        expect(pic.status).toBe("INCOMPLETE");
        expect((await training.myTraining(pilot)).canApprove).toBe(false);
        expect((await training.myTraining(manager)).canApprove).toBe(true);
        expect((await statusOf("IFR")).items.find((i: any) => i.code === "PIC")).toMatchObject({ type: "QUALIFICATION", status: "MISSING" });
    });
});

describe("recording and approving training", () => {
    it("records a person's own training as waiting for approval, and it does not count yet", async () => {
        await record("135.293", "2026-03-10");
        const item = (await statusOf("PIC")).items.find((i: any) => i.code === "135.293");
        expect(item.status).toBe("MISSING");
        expect((await training.myTraining(pilot)).records[0]).toMatchObject({ programCode: "135.293", approval: "PENDING" });
    });

    it("refuses a future date, a bad date and unknown training", async () => {
        const id = await program("135.297");
        expect(await training.submit(pilot, { programId: id, completionDate: "2026-12-01" })).toEqual({ success: false, message: "The completion date cannot be in the future." });
        expect(await training.submit(pilot, { programId: id, completionDate: "2026-02-30" })).toEqual({ success: false, message: "Enter the date you completed it." });
        expect(await training.submit(pilot, { programId: "nope", completionDate: "2026-01-01" })).toEqual({ success: false, message: "Choose the training you completed." });
    });

    it("lets only managers see and approve records, never their own, and wants a reason to reject", async () => {
        expect(await training.pending(pilot)).toEqual({ success: false, message: "Only a manager can approve training." });
        const list = await training.pending(manager);
        expect(list.records).toHaveLength(1);
        expect(list.records[0]).toMatchObject({ username: "pilot1", programCode: "135.293", own: false });
        const id = list.records[0].id;
        expect(await training.review(manager, id, false, "")).toEqual({ success: false, message: "Say why it is rejected, so the person can fix it." });
        expect(await training.review(manager, id, true)).toEqual({ success: true, message: "Approved." });
        expect(await training.review(manager, id, true)).toEqual({ success: false, message: "This record has already been reviewed." });
        expect(await db.prisma.auditLog.count({ where: { action: "TRAINING_APPROVED", entityId: id } })).toBe(1);

        const tmOwn = await training.submit(manager, { programId: await program("HUET_COURSE"), completionDate: "2026-01-05" });
        expect(tmOwn.success).toBe(true);
        const own = (await training.pending(manager)).records.find((r: any) => r.own);
        expect(await training.review(manager, own.id, true)).toEqual({ success: false, message: "You cannot approve your own training. Ask another manager." });
    });

    it("counts the approved check, due at the end of the month a year later", async () => {
        const item = (await statusOf("PIC")).items.find((i: any) => i.code === "135.293");
        expect(item).toMatchObject({ code: "135.293", status: "CURRENT" });
        expect(item.dueDate.toISOString().slice(0, 10)).toBe("2027-03-31");
    });

    it("lets a person withdraw a record that is still waiting, but not after review", async () => {
        const id = await record("135.299", "2026-05-01");
        expect(await training.withdraw(pilot, id)).toEqual({ success: true, message: "Withdrawn." });
        const approved = (await db.prisma.userTrainingRecord.findFirstOrThrow({ where: { approval: "APPROVED" } })).id;
        expect(await training.withdraw(pilot, approved)).toEqual({ success: false, message: "Only a record waiting for approval can be withdrawn." });
        expect(await training.withdraw(manager, approved)).toEqual({ success: false, message: "Record not found." });
    });
});

describe("qualification status from requirements", () => {
    it("becomes current once every requirement is, and expires with the first one", async () => {
        for (const [code, date] of [["135.299", "2026-01-20"], ["COMPANY_RECURRENT", "2026-06-15"], ["CRM_INITIAL", "2019-04-01"], ["CRM_RECURRENT", "2026-02-10"]]) {
            const id = await record(code, date);
            expect((await training.review(manager, id, true)).success).toBe(true);
        }
        const pic = await statusOf("PIC");
        expect(pic.status).toBe("CURRENT");
        // 135.299 done January 2026 is the first due: end of January 2027.
        expect(pic.dueDate.toISOString().slice(0, 10)).toBe("2027-01-31");
        expect(pic.graceEnd.toISOString().slice(0, 10)).toBe("2027-02-28");
        const ifr = await statusOf("IFR");
        expect(ifr.items.find((i: any) => i.code === "PIC").status).toBe("CURRENT");
        expect(ifr.status).toBe("INCOMPLETE"); // 135.297 not done yet
    });

    it("shows suspended when the assignment is suspended", async () => {
        const q = await db.prisma.qualification.findUniqueOrThrow({ where: { code: "PIC" } });
        await db.prisma.userQualification.updateMany({ where: { userId: pilot, qualificationId: q.id }, data: { suspended: true } });
        expect((await statusOf("PIC")).status).toBe("SUSPENDED");
        await db.prisma.userQualification.updateMany({ where: { userId: pilot, qualificationId: q.id }, data: { suspended: false } });
    });
});

describe("the requirements editor", () => {
    it("is only for a Training Manager or Administrator", async () => {
        expect(await training.requirementsEditor(pilot)).toEqual({ success: false, message: "Only a Training Manager or Administrator can change requirements." });
        const editor = await training.requirementsEditor(manager);
        expect(editor.success).toBe(true);
        expect(editor.qualifications.find((q: any) => q.code === "HUET").requirements).toEqual([{ type: "TRAINING", ref: "HUET_COURSE" }]);
    });

    it("saves a new list, drops duplicates and audits the change", async () => {
        const huet = await db.prisma.qualification.findUniqueOrThrow({ where: { code: "HUET" } });
        const items = [{ type: "TRAINING", ref: "HUET_COURSE" }, { type: "QUALIFICATION", ref: "CRM" }, { type: "TRAINING", ref: "HUET_COURSE" }];
        expect(await training.setRequirements(manager, huet.id, items)).toEqual({ success: true, message: "Saved requirements for HUET." });
        expect(await db.prisma.qualificationRequirement.count({ where: { qualificationId: huet.id } })).toBe(2);
        expect(await db.prisma.auditLog.count({ where: { action: "REQUIREMENTS_CHANGED", entityId: huet.id } })).toBe(1);
    });

    it("refuses unknown items and a loop between qualifications", async () => {
        const pic = await db.prisma.qualification.findUniqueOrThrow({ where: { code: "PIC" } });
        expect((await training.setRequirements(manager, pic.id, [{ type: "TRAINING", ref: "NOPE" }])).message).toBe("Unknown training: NOPE.");
        expect((await training.setRequirements(manager, pic.id, [{ type: "QUALIFICATION", ref: "IFR" }])).message).toBe("IFR already needs PIC, so PIC cannot need IFR.");
        expect((await training.setRequirements(manager, pic.id, [{ type: "QUALIFICATION", ref: "PIC" }])).message).toBe("PIC already needs PIC, so PIC cannot need PIC.");
    });

    it("changes how often a training repeats", async () => {
        const id = await program("COMPANY_RECURRENT");
        expect((await training.setRenewal(manager, id, "24")).success).toBe(true);
        expect((await db.prisma.trainingProgram.findUniqueOrThrow({ where: { id } })).renewalMonths).toBe(24);
        expect((await training.setRenewal(manager, id, "")).message).toBe("Company recurrent training: once.");
        expect((await training.setRenewal(manager, id, "0")).success).toBe(false);
        await training.setRenewal(manager, id, 12);
    });

    it("shows a pending record as waiting on the requirement", async () => {
        await record("135.297", "2026-04-02");
        const item = (await statusOf("IFR")).items.find((i: any) => i.code === "135.297");
        expect(item).toMatchObject({ status: "MISSING", waiting: true });
    });
});

describe("the Qualifications page", () => {
    it("takes a holder's status from their training when requirements are set", async () => {
        const { createQualificationRepository } = require(path.resolve(__dirname, "../../electron/main/qualification-repository.js"));
        const repo = createQualificationRepository(db.prisma, { now });
        const pic = (await repo.list()).find((q: any) => q.code === "PIC");
        const holder = pic.assignments.find((a: any) => a.userId === pilot);
        expect(holder).toMatchObject({ fromRequirements: true, qualificationStatus: "CURRENT" });
        expect(holder.requirementDueDate.toISOString().slice(0, 10)).toBe("2027-01-31");
        const ifr = (await repo.list()).find((q: any) => q.code === "IFR");
        expect(ifr.assignments.find((a: any) => a.userId === pilot).qualificationStatus).toBe("INCOMPLETE");
    });
});

describe("alerts", () => {
    it("lists what is due, missing or expired for you, and for managers everyone", async () => {
        const mine = await training.alerts(pilot);
        expect(mine.success).toBe(true);
        expect(mine.team).toBeNull();
        expect(mine.windowDays).toBe(90);
        // 135.297 is not approved yet, so IFR shows it as missing and waiting.
        expect(mine.mine.find((a: any) => a.programCode === "135.297")).toMatchObject({ level: "MISSING", waiting: true, qualificationCode: "IFR" });
        expect(mine.mine.filter((a: any) => a.programCode === "135.293")).toHaveLength(0); // approved and current
        const team = await training.alerts(manager);
        expect(team.team.some((a: any) => a.person.username === "pilot1")).toBe(true);
    });

    it("warns 90 days before a due date, and less when Settings turn the 90 and 60 day alerts off", async () => {
        // 135.299 done January 2026 is due 2027-01-31: 71 days after 2026-11-21.
        const due = (list: any[]) => list.find((a: any) => a.programCode === "135.299" && a.qualificationCode === "PIC");
        expect(due((await training.alerts(pilot)).mine)).toMatchObject({ level: "DUE_SOON", daysLeft: 71 });
        await db.prisma.configuration.upsert({ where: { key: "Alert90Days" }, update: { value: "FALSE" }, create: { key: "Alert90Days", value: "FALSE" } });
        await db.prisma.configuration.upsert({ where: { key: "Alert60Days" }, update: { value: "FALSE" }, create: { key: "Alert60Days", value: "FALSE" } });
        const later = await training.alerts(pilot);
        expect(later.windowDays).toBe(30);
        expect(due(later.mine)).toBeUndefined();
        await db.prisma.configuration.deleteMany({ where: { key: { in: ["Alert90Days", "Alert60Days"] } } });
    });
});

describe("alert rows", () => {
    it("show a training needed by two qualifications once", async () => {
        const other = (await db.prisma.user.create({ data: { username: "pilot2", passwordHash: "x", firstName: "Sam", lastName: "Second", status: "ACTIVE" } })).id;
        for (const code of ["PIC", "IFR"]) {
            const q = await db.prisma.qualification.findUniqueOrThrow({ where: { code } });
            await db.prisma.userQualification.create({ data: { userId: other, qualificationId: q.id } });
        }
        const rows = (await training.alerts(other)).mine.filter((a: any) => a.programCode === "135.293");
        expect(rows).toHaveLength(1);
        expect(rows[0].qualifications.sort()).toEqual(["IFR", "PIC"]);
    });
});

describe("waivers and overrides", () => {
    let admin: string;
    let dir: string;
    beforeAll(async () => {
        const roleId = async (name: string) => (await db.prisma.role.findUniqueOrThrow({ where: { roleName: name } })).id;
        admin = (await db.prisma.user.create({ data: { username: "adm2", passwordHash: "x", firstName: "A", lastName: "D", status: "ACTIVE", userRoles: { create: { roleId: await roleId("Administrator") } } } })).id;
        dir = (await db.prisma.user.create({ data: { username: "do1", passwordHash: "x", firstName: "D", lastName: "O", status: "ACTIVE", userRoles: { create: { roleId: await roleId("Director_of_Operations") } } } })).id;
    });
    const ifrItem = async (code: string) => (await statusOf("IFR")).items.find((i: any) => i.code === code);

    it("lets only the Director of Operations or an Administrator waive, and only an Administrator override", async () => {
        const input = { userId: pilot, targetType: "TRAINING", targetRef: "135.297", reason: "Simulator down", expiresAt: "2027-01-15" };
        expect((await training.grantWaiver(manager, input)).message).toBe("Only the Director of Operations or an Administrator can waive a requirement.");
        expect((await training.grantWaiver(dir, { ...input, targetType: "QUALIFICATION", targetRef: "IFR" })).message).toBe("Only an Administrator can override a qualification.");
        expect((await training.waiverView(manager, pilot, "IFR")).message).toBe("Only the Director of Operations or an Administrator can grant waivers.");
    });

    it("needs a reason and an end date after today, at most 2 years ahead", async () => {
        const input = { userId: pilot, targetType: "TRAINING", targetRef: "135.297", reason: "Simulator down", expiresAt: "2027-01-15" };
        expect((await training.grantWaiver(dir, { ...input, reason: " " })).message).toBe("Give the reason. It is required for every waiver and override.");
        expect((await training.grantWaiver(dir, { ...input, expiresAt: "2026-11-21" })).message).toBe("The end date must be after today.");
        expect((await training.grantWaiver(dir, { ...input, expiresAt: "2029-01-01" })).message).toBe("A waiver can last at most 2 years.");
    });

    it("makes a waived training count as current until the end date, and audits it", async () => {
        expect((await ifrItem("135.297")).status).toBe("MISSING");
        expect(await training.grantWaiver(dir, { userId: pilot, targetType: "TRAINING", targetRef: "135.297", reason: "Simulator down", documentation: "Email from DO", expiresAt: "2027-01-15" })).toEqual({ success: true, message: "Requirement waived." });
        const item = await ifrItem("135.297");
        expect(item).toMatchObject({ status: "CURRENT", waived: { reason: "Simulator down" } });
        expect(item.dueDate.toISOString().slice(0, 10)).toBe("2027-01-15");
        expect(await db.prisma.auditLog.count({ where: { action: "REQUIREMENT_WAIVED" } })).toBe(1);
        expect((await training.grantWaiver(dir, { userId: pilot, targetType: "TRAINING", targetRef: "135.297", reason: "Again", expiresAt: "2027-01-20" })).message).toBe("There is already an active one. Revoke it first to change it.");
    });

    it("lets an Administrator override a whole qualification, and revoking it restores the real status", async () => {
        const huet = await db.prisma.qualification.findUniqueOrThrow({ where: { code: "HUET" } });
        await db.prisma.userQualification.create({ data: { userId: pilot, qualificationId: huet.id } });
        expect((await statusOf("HUET")).status).toBe("INCOMPLETE");
        expect((await training.grantWaiver(admin, { userId: pilot, targetType: "QUALIFICATION", targetRef: "HUET", reason: "Course cancelled by vendor", expiresAt: "2026-12-10" })).success).toBe(true);
        // Ends within 30 days, so it shows as due soon.
        expect(await statusOf("HUET")).toMatchObject({ status: "EXPIRING", overridden: { reason: "Course cancelled by vendor" } });
        const view = await training.waiverView(admin, pilot, "HUET");
        expect(view).toMatchObject({ canWaive: true, canOverride: true });
        const id = view.waivers.find((w: any) => w.targetType === "QUALIFICATION").id;
        expect((await training.revokeWaiver(dir, id, "x")).message).toBe("You cannot revoke this.");
        expect((await training.revokeWaiver(admin, id, "")).message).toBe("Give the reason for revoking.");
        expect(await training.revokeWaiver(admin, id, "Course rebooked")).toEqual({ success: true, message: "Revoked." });
        expect((await statusOf("HUET")).status).toBe("INCOMPLETE");
        expect((await training.waiverView(admin, pilot, "HUET")).waivers[0]).toMatchObject({ revokeReason: "Course rebooked", revokedBy: "adm2" });
    });
});
