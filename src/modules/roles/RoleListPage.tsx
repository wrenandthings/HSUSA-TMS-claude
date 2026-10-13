import { useEffect, useState } from "react";
import { RoleService } from "./RoleService";
import RoleDetailPage from "./RoleDetailPage";
import CreateRoleForm from "./CreateRoleForm";

interface Props {
    onBack: () => void;
}

const roleService = new RoleService();

export default function RoleListPage(
    props: Props
) {

    const [roles, setRoles] =
        useState<any[]>([]);

    const [selectedRole, setSelectedRole] =
        useState<string | null>(null);

    const [creating, setCreating] =
        useState(false);

    useEffect(() => {
        loadRoles();
    }, []);

    async function loadRoles() {

        const data =
            await roleService.getRoles();

        setRoles(data);
    }

    async function createRole(
        roleName: string,
        description: string
    ) {

        const result =
            await roleService.createRole(
                roleName,
                description
            );

        console.log(result);

        setCreating(false);

        loadRoles();
    }

    if (creating) {

        return (
            <CreateRoleForm
                onCreate={createRole}
                onCancel={() =>
                    setCreating(false)
                }
            />
        );
    }

    if (selectedRole) {

        return (
            <RoleDetailPage
                roleId={selectedRole}
                onBack={() => {
                    setSelectedRole(null);
                    loadRoles();
                }}
            />
        );
    }

    return (

        <div style={{ padding: "40px" }}>

            <button
                onClick={props.onBack}
                style={{ marginBottom: "20px" }}
            >
                ← Back To Main Menu
            </button>

            <h1>
                Role List
            </h1>

            <button
                onClick={() =>
                    setCreating(true)
                }
                style={{
                    marginBottom: "20px"
                }}
            >
                + Create New Role
            </button>

            <table
                border={1}
                cellPadding={10}
                style={{
                    width: "100%",
                    borderCollapse: "collapse"
                }}
            >

                <thead>

                    <tr>
                        <th>Role Name</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>

                </thead>

                <tbody>

                    {roles?.map(
                        (role) => (

                            <tr key={role.id}>

                                <td>
                                    {role.roleName}
                                </td>

                                <td>
                                    {role.description}
                                </td>

                                <td>

                                    <button
                                        onClick={() =>
                                            setSelectedRole(
                                                role.id
                                            )
                                        }
                                    >
                                        View Details
                                    </button>

                                </td>

                            </tr>

                        )
                    )}

                </tbody>

            </table>

        </div>

    );
}