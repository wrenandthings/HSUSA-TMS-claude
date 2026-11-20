import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, TestDatabase } from "./testDatabase";
import { createQualificationRepository, addMonths } from "../../electron/main/qualification-repository";

let db: TestDatabase;
let repo: ReturnType<typeof createQualificationRepository>;
let pilotId: string;
let adminId: string;
const now = new Date(2026, 10, 17, 12, 0); // Nov 17, 2026, noon local time

beforeAll(async () => {
    db = createTestDatabase();
    repo = createQualificationRepository(db.prisma, { now: () => now });
    adminId = (await db.prisma.user.create({ data: { username: "admin", passwordHash: "secret-hash", firstName: "A", lastName: "Admin", status: "ACTIVE" } })).id;
    pilotId = (await db.prisma.user.create({ data: { username: "pilot", passwordHash: "secret-hash", firstName: "P", lastName: "Pilot", status: "ACTIVE" } })).id;
});
afterAll(async () => { await db.cleanup(); });
beforeEach(async () => {
    await db.prisma.auditLog.deleteMany();
    await db.prisma.userQualification.deleteMany();
    await db.prisma.qualification.deleteMany();
});

const pic = () => repo.create({ code: "pic", name: "Pilot In Command", renewalMonths: 12 }, adminId);

describe("addMonths", () => {
    it("adds months in UTC and clamps to the end of shorter months", () => {
        expect(addMonths(new Date("2026-01-15"), 12).toISOString().slice(0, 10)).toBe("2027-01-15");
        expect(addMonths(new Date("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
        expect(addMonths(new Date("2027-11-30"), 6).toISOString().slice(0, 10)).toBe("2028-05-30");
    });
});

describe("qualification catalog", () => {
    it("normalizes the code and requires name and code", async () => {
        expect((await pic()).code).toBe("PIC");
        await expect(repo.create({ code: "", name: "X" }, adminId)).rejects.toThrow("code is required");
        await expect(repo.create({ code: "X", name: " " }, adminId)).rejects.toThrow("name is required");
        await expect(repo.create({ code: "X", name: "X", renewalMonths: 0 }, adminId)).rejects.toThrow("Renewal months");
    });

    it("deletes a qualification with no history, but refuses once anyone was assigned", async () => {
        const unused = await repo.create({ code: "SAR", name: "Search and Rescue" }, adminId);
        await repo.remove(unused.id, adminId);
        expect(await repo.getById(unused.id)).toBeNull();

        const q = await pic();
        await repo.assign({ qualificationId: q.id, userId: pilotId }, adminId);
        await repo.unassign({ qualificationId: q.id, userId: pilotId }, adminId);
        await expect(repo.remove(q.id, adminId)).rejects.toThrow("Mark it inactive instead");
    });

    it("never sends password data to the renderer", async () => {
        const q = await pic();
        await repo.assign({ qualificationId: q.id, userId: pilotId }, adminId);
        const listed = JSON.stringify(await repo.list());
        expect(listed).toContain("pilot");
        expect(listed).not.toContain("secret-hash");
        expect(listed).not.toContain("passwordHash");
    });
});

describe("hiding a qualification created in error", () => {
    it("keeps it and its history, leaves it out of lists, and can be undone", async () => {
        const q = await pic();
        await repo.assign({ qualificationId: q.id, userId: pilotId }, adminId);
        await repo.setHidden(q.id, true, adminId);
        expect((await repo.list()).map(x => x.code)).not.toContain("PIC");
        const hidden = (await repo.list({ includeHidden: true })).find(x => x.code === "PIC")!;
        expect(hidden.hidden).toBe(true);
        expect(hidden.assignments).toHaveLength(1);
        await repo.setHidden(q.id, false, adminId);
        expect((await repo.list()).map(x => x.code)).toContain("PIC");
        const actions = (await db.prisma.auditLog.findMany()).map(e => e.action);
        expect(actions).toEqual(expect.arrayContaining(["QUALIFICATION_HIDDEN", "QUALIFICATION_UNHIDDEN"]));
    });
});

describe("per-person assignments", () => {
    it("works out the expiration from the awarded date and renewal months", async () => {
        const q = await pic();
        const a = await repo.assign({ qualificationId: q.id, userId: pilotId, awardedDate: "2026-01-15" }, adminId);
        expect(a.expirationDate?.toISOString().slice(0, 10)).toBe("2027-01-15");
        expect(a.qualificationStatus).toBe("CURRENT");
    });

    it("uses an expiration date given explicitly, and gives each person their own status", async () => {
        const q = await pic();
        const other = await db.prisma.user.create({ data: { username: "pilot2", passwordHash: "x", firstName: "Q", lastName: "Two", status: "ACTIVE" } });
        await repo.assign({ qualificationId: q.id, userId: pilotId, awardedDate: "2026-01-15", expirationDate: "2026-11-20" }, adminId);
        await repo.assign({ qualificationId: q.id, userId: other.id, awardedDate: "2026-06-01" }, adminId);
        const statuses = Object.fromEntries((await repo.getById(q.id))!.assignments.map(a => [a.user.username, a.qualificationStatus]));
        expect(statuses).toEqual({ pilot: "EXPIRING_CRITICAL", pilot2: "CURRENT" });
        await db.prisma.user.delete({ where: { id: other.id } });
    });

    it("treats an assignment with no expiration date as CURRENT", async () => {
        const q = await repo.create({ code: "HUET", name: "HUET" }, adminId);
        expect((await repo.assign({ qualificationId: q.id, userId: pilotId }, adminId)).qualificationStatus).toBe("CURRENT");
    });

    it("does not create a second active assignment for the same person", async () => {
        const q = await pic();
        await repo.assign({ qualificationId: q.id, userId: pilotId }, adminId);
        await repo.assign({ qualificationId: q.id, userId: pilotId }, adminId);
        expect(await db.prisma.userQualification.count({ where: { status: "ACTIVE" } })).toBe(1);
    });

    it("suspends and reinstates one person, overriding the date-based status", async () => {
        const q = await pic();
        const a = await repo.assign({ qualificationId: q.id, userId: pilotId, awardedDate: "2026-01-15" }, adminId);
        expect((await repo.updateAssignment({ assignmentId: a.id, suspended: true }, adminId)).qualificationStatus).toBe("SUSPENDED");
        expect((await repo.updateAssignment({ assignmentId: a.id, suspended: false }, adminId)).qualificationStatus).toBe("CURRENT");
        const actions = (await db.prisma.auditLog.findMany({ orderBy: { timestamp: "asc" } })).map(e => e.action);
        expect(actions).toEqual(expect.arrayContaining(["QUALIFICATION_SUSPENDED", "QUALIFICATION_REINSTATED"]));
    });

    it("renews by changing dates, and records before and after in the audit log", async () => {
        const q = await pic();
        const a = await repo.assign({ qualificationId: q.id, userId: pilotId, awardedDate: "2025-11-01" }, adminId);
        expect(a.qualificationStatus).toBe("EXPIRED");
        const renewed = await repo.updateAssignment({ assignmentId: a.id, awardedDate: "2026-11-01", expirationDate: "2027-11-01" }, adminId);
        expect(renewed.qualificationStatus).toBe("CURRENT");
        const entry = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "QUALIFICATION_UPDATED" } });
        expect(entry.userId).toBe(adminId);
        expect(JSON.parse(entry.oldValue!).expirationDate).toContain("2026-11-01");
        expect(JSON.parse(entry.newValue!).expirationDate).toContain("2027-11-01");
    });
});

describe("assignment history", () => {
    it("keeps every revoked assignment when a person is unassigned and reassigned repeatedly", async () => {
        const q = await pic();
        for (let i = 0; i < 3; i++) {
            await repo.assign({ qualificationId: q.id, userId: pilotId }, adminId);
            await repo.unassign({ qualificationId: q.id, userId: pilotId, reason: `round ${i}` }, adminId);
        }
        const history = await db.prisma.userQualification.findMany({ where: { qualificationId: q.id }, orderBy: { endReason: "asc" } });
        expect(history.map(h => [h.status, h.endReason])).toEqual([["REVOKED", "round 0"], ["REVOKED", "round 1"], ["REVOKED", "round 2"]]);
    });

    it("refuses to change an assignment that is no longer active", async () => {
        const q = await pic();
        const a = await repo.assign({ qualificationId: q.id, userId: pilotId }, adminId);
        await repo.unassign({ qualificationId: q.id, userId: pilotId }, adminId);
        await expect(repo.updateAssignment({ assignmentId: a.id, suspended: true }, adminId)).rejects.toThrow("Only active");
    });

    it("records who made each change", async () => {
        const q = await pic();
        await repo.assign({ qualificationId: q.id, userId: pilotId }, adminId);
        await repo.unassign({ qualificationId: q.id, userId: pilotId }, adminId);
        const entries = await db.prisma.auditLog.findMany();
        expect(entries.map(e => e.action).sort()).toEqual(["QUALIFICATION_ASSIGNED", "QUALIFICATION_CREATED", "QUALIFICATION_UNASSIGNED"]);
        expect(entries.every(e => e.userId === adminId && e.entityId === q.id)).toBe(true);
    });
});
