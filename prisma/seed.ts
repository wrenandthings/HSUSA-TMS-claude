const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../electron/main/passwords");

const prisma = new PrismaClient();

async function main() {

    console.log("Starting seed...");

    const roles = [
        "Administrator",
        "Director_of_Operations",
        "Chief_Pilot",
        "Training_Manager",
        "Check_Airman",
        "Instructor",
        "Pilot",
        "Communications_Specialist",
        "Maintenance",
        "Read_Only",
        // Added 2026-11-19 (owner, question 20): they also manage qualifications.
        "Maintenance_Manager",
        "Quality_Control"
    ];

    for (const role of roles) {

        await prisma.role.upsert({

            where: {
                roleName: role
            },

            update: {},

            create: {
                roleName: role
            }
        });
    }

    const configs = [

        {
            key: "ReadinessKnowledgeWeight",
            value: "70",
            description: "Knowledge contribution"
        },

        {
            key: "ReadinessQualificationWeight",
            value: "30",
            description: "Qualification contribution"
        },

        {
            key: "CoverageThreshold",
            value: "50",
            description: "Knowledge threshold"
        },

        {
            key: "SessionTimeoutMinutes",
            value: "30",
            description: "Session timeout"
        },

        // Added 2026-11-17 from the Seed Data Specification v1.0.
        { key: "Alert90Days", value: "TRUE", description: "Qualification alert 90 days before expiration" },
        { key: "Alert60Days", value: "TRUE", description: "Qualification alert 60 days before expiration" },
        { key: "Alert30Days", value: "TRUE", description: "Qualification alert 30 days before expiration" },
        { key: "Alert7Days", value: "TRUE", description: "Qualification alert 7 days before expiration" },
        { key: "BackupRetentionDays", value: "90", description: "Days to keep backups" },
        { key: "AuditRetentionDays", value: "365", description: "Days to keep audit records" },
        { key: "MinimumPasswordLength", value: "12", description: "Minimum password length" },
        { key: "PasswordComplexityRequired", value: "TRUE", description: "Require complex passwords" },
        // Quiz engine (Phase 4). Defaults chosen by Finch 2026-11-21; admin-adjustable.
        { key: "QuizPassMarkPercent", value: "80", description: "Pass mark for quizzes" },
        { key: "QuizQuestionCount", value: "20", description: "Questions in a practice quiz" },
        { key: "CertificationQuestionCount", value: "50", description: "Questions in a certification quiz" }
    ];

    for (const config of configs) {

        await prisma.configuration.upsert({

            where: {
                key: config.key
            },

            update: {},

            create: config
        });
    }

    const admin = await prisma.user.upsert({

        where: {
            username: "admin"
        },

        update: {},

        create: {

            username: "admin",

            // Test password for a new installation. It is hashed, and the
            // admin must choose a new one at first sign-in.
            passwordHash: await hashPassword("CHANGE_ME"),

            mustChangePassword: true,

            firstName: "System",

            lastName: "Administrator",

            email: "admin@local",

            status: "ACTIVE"
        }
    });

    const adminRole = await prisma.role.findUnique({

        where: {
            roleName: "Administrator"
        }
    });

    if (adminRole) {

        try {

            await prisma.userRole.create({
                data: {
                    userId: admin.id,
                    roleId: adminRole.id
                }
            });

        } catch (err) {

            // ignore duplicate assignment

        }
    }

    await seedQualifications();
    await seedSubjects();
    await seedDocuments();
    await seedPermissions(adminRole);

    console.log("Seed Complete");
} 

// Qualification catalog and renewal months from the Seed Data Specification
// v1.0; names from the Qualification Rules Matrix v1.0. An entry is skipped if
// its code or name already exists, so existing data is never overwritten.
const QUALIFICATIONS = [
    { code: "PIC", name: "PIC", description: "Pilot In Command", renewalMonths: 12 },
    { code: "IFR", name: "IFR", renewalMonths: 6 },
    { code: "OFFSHORE_IFR", name: "Offshore IFR", renewalMonths: 12 },
    { code: "NVG", name: "NVG", renewalMonths: 12 },
    { code: "HAA", name: "HAA", renewalMonths: 24 },
    { code: "SAR", name: "SAR", renewalMonths: 24 },
    { code: "CRM", name: "CRM", renewalMonths: 12 },
    { code: "HUET", name: "HUET", renewalMonths: 48 },
    { code: "COMM_SPEC", name: "Communications Specialist", renewalMonths: 12 },
    { code: "INSTRUCTOR", name: "Instructor", renewalMonths: 24 },
    { code: "CHECK_AIRMAN", name: "Check Airman", renewalMonths: 24 },
    // Placeholder for mechanics (owner, question 32), from the requirements
    // doc: Return to Service authority, OM-A 11.8. Renewal is not set until the
    // owner confirms the rules; the training manager can edit it in the app.
    { code: "RTS", name: "Return to Service", description: "Placeholder: Return to Service authority (OM-A 11.8). Requirements to be confirmed." }
];

// Reference documents from the Seed Data Specification v1.0.
const DOCUMENTS = [
    { code: "OM-A", title: "Operations Manual Part A" },
    { code: "OM-C", title: "Operations Manual Part C" },
    { code: "OM-D", title: "Operations Manual Part D" },
    // Quail, 2026-11-21: the AW169 Aircraft SOP bank.
    { code: "OM-B", title: "Operations Manual Part B (AW169 Aircraft SOP)" },
    // Source documents of the maintenance question banks (Quail, 2026-11-20).
    { code: "AMP", title: "Aircraft Maintenance Program" },
    { code: "AMPI", title: "Aircraft Maintenance Planning Information" }
];

async function seedDocuments() {
    for (const document of DOCUMENTS) {
        await prisma.document.upsert({ where: { code: document.code }, update: {}, create: document });
    }
}

async function seedQualifications() {
    for (const qualification of QUALIFICATIONS) {
        const existing = await prisma.qualification.findFirst({
            where: { OR: [{ code: qualification.code }, { name: qualification.name }] }
        });
        if (!existing) await prisma.qualification.create({ data: qualification });
    }
}

// Permission codes from the Seed Data Specification v1.0. The spec gives the
// Administrator every permission; the other roles' assignments are described
// in business terms ("Question Management") and are not mapped to codes yet.
const PERMISSIONS: Record<string, string[]> = {
    Users: ["USER_VIEW", "USER_CREATE", "USER_EDIT", "USER_DELETE"],
    Roles: ["ROLE_VIEW", "ROLE_CREATE", "ROLE_EDIT", "ROLE_DELETE"],
    Questions: ["QUESTION_VIEW", "QUESTION_CREATE", "QUESTION_EDIT", "QUESTION_DELETE", "QUESTION_IMPORT", "QUESTION_EXPORT"],
    Qualifications: ["QUALIFICATION_VIEW", "QUALIFICATION_ASSIGN", "QUALIFICATION_APPROVE", "QUALIFICATION_RENEW", "QUALIFICATION_SUSPEND", "QUALIFICATION_RESTORE", "QUALIFICATION_OVERRIDE"],
    Reporting: ["REPORT_VIEW", "REPORT_EXPORT"],
    Administration: ["ADMIN_CONFIGURATION", "ADMIN_BACKUP", "ADMIN_RESTORE", "ADMIN_SECURITY"]
};

function permissionName(code: string) {
    return code.split("_").map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(" ");
}

async function seedPermissions(adminRole: { id: string } | null) {
    for (const [category, codes] of Object.entries(PERMISSIONS)) {
        for (const permissionCode of codes) {
            const permission = await prisma.permission.upsert({
                where: { permissionCode },
                update: {},
                create: { permissionCode, name: permissionName(permissionCode), category }
            });
            if (adminRole) {
                await prisma.rolePermission.upsert({
                    where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
                    update: {},
                    create: { roleId: adminRole.id, permissionId: permission.id }
                });
            }
        }
    }
}

// Subject codes from the Seed Data Specification v1.0 (owner question 15:
// subjects have a code and a name). Names are a first pass and can be edited
// in the app. Skipped if the code or name already exists.
const SUBJECTS = [
    { code: "OMA", subjectName: "Operations Manual Part A" },
    { code: "PILOT", subjectName: "Pilot" },
    { code: "COMM", subjectName: "Communications" },
    { code: "MGMT", subjectName: "Management" },
    { code: "MAINT", subjectName: "Maintenance" },
    { code: "CRM", subjectName: "Crew Resource Management" },
    { code: "HAZMAT", subjectName: "Hazardous Materials" },
    { code: "NVG", subjectName: "Night Vision Goggles" },
    { code: "HAA", subjectName: "Helicopter Air Ambulance" },
    { code: "OFFSHORE_IFR", subjectName: "Offshore IFR" },
    { code: "AW169", subjectName: "AW169" },
    // Owner, 2026-11-21: "For now make OM-D its own subject until I get more
    // information from our manuals and processes."
    { code: "OMD", subjectName: "Operations Manual Part D" }
];

async function seedSubjects() {
    for (const subject of SUBJECTS) {
        const existing = await prisma.subject.findFirst({
            where: { OR: [{ code: subject.code }, { subjectName: subject.subjectName }] }
        });
        if (!existing) await prisma.subject.create({ data: subject });
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
