const { ipcMain } = require("electron");
const { getPrisma } = require("./prisma-client");

const { guarded } = require("./require-role");

const prisma = getPrisma();
const ADMIN_ONLY = "Only an Administrator can change roles.";
// The Administrator role keeps the app manageable; it cannot be renamed or deleted.
const PROTECTED_ROLES = ["Administrator"];

function registerRoleHandlers() {
    const WRITE = new Set(["roles-create", "roles-update", "roles-delete"]);
    const ipc = {
        handle: (channel, fn) => ipcMain.handle(channel, WRITE.has(channel) ? guarded(prisma, ["Administrator"], ADMIN_ONLY, fn) : fn)
    };

    ipc.handle(
        "roles-get-all",

        async () => {

            return await prisma.role.findMany({

                orderBy: {
                    roleName: "asc"
                }
            });
        }
    );

    ipc.handle(
        "roles-get-by-id",

        async (
            event,
            roleId
        ) => {

            return await prisma.role.findUnique({

                where: {
                    id: roleId
                },

                include: {
                    userRoles: true
                }
            });
        }
    );
    ipc.handle(
        "roles-create",

        async (
           event,
           role
    ) => {

            const existing =
                await prisma.role.findFirst({

                    where: {
                        roleName:
                            role.roleName
                    }
                });

            if (existing) {

                return {
                    success: false,
                    message:
                        "Role already exists"
                };
            }

        const createdRole =
            await prisma.role.create({

                data: {
                    roleName:
                        role.roleName,

                    description:
                        role.description
                }
            });

        return {

            success: true,

            message:
                "Role created",

            role:
                createdRole
        };
    }

    );

    ipc.handle(
        "roles-update",

        async (
            event,
            role
        ) => {

        const current = await prisma.role.findUnique({ where: { id: role?.id } });
        if (!current) return { success: false, message: "Role not found" };
        if (PROTECTED_ROLES.includes(current.roleName) && role.roleName !== current.roleName) {
            return { success: false, message: "The Administrator role cannot be renamed." };
        }

        const updatedRole =
            await prisma.role.update({

                where: {
                    id: role.id
                },

                data: {
                    roleName:
                        role.roleName,

                    description:
                        role.description
                }
            });

        return {
            success: true,
            role: updatedRole
        };
        }
    );
        ipc.handle(
            "roles-delete",

            async (
                event,
                roleId
            ) => {

                const current = await prisma.role.findUnique({ where: { id: roleId }, include: { userRoles: true } });
                if (!current) return { success: false, message: "Role not found" };
                if (PROTECTED_ROLES.includes(current.roleName)) return { success: false, message: "The Administrator role cannot be deleted." };
                if (current.userRoles.length > 0) return { success: false, message: `Remove this role from its ${current.userRoles.length} ${current.userRoles.length === 1 ? "person" : "people"} first.` };

                await prisma.role.delete({

                    where: {
                        id: roleId
                    }
                });

                return {
                    success: true
                };
            }
        );
 
    };  
module.exports = {
    registerRoleHandlers
};