import { useEffect, useState } from "react";
import { UserService } from "./UserService";
import ChangePasswordForm from "./ChangePasswordForm";
import EditUserForm from "./EditUserForm";
import { QualificationService } from "../qualifications/QualificationService";

interface Props {
    userId: string;
    onBack: () => void;
}

type UserStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

const userService = new UserService();
const qualificationService = new QualificationService();

function getActiveQualificationIds(userId: string, qualifications: any[]) {
    return (qualifications ?? [])
        .filter((qualification) =>
            qualification.assignments?.some(
                (assignment: any) => assignment.user?.id === userId && assignment.status === "ACTIVE"
            )
        )
        .map((qualification) => qualification.id);
}

function formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return "Unable to complete the request.";
}

export default function UserDetailPage(props: Props) {
    const [user, setUser] = useState<any>(null);
    const [allQualifications, setAllQualifications] = useState<any[]>([]);
    const [message, setMessage] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editingQualifications, setEditingQualifications] = useState(false);
    const [qualificationDraft, setQualificationDraft] = useState<string[]>([]);
    const [originalQualificationIds, setOriginalQualificationIds] = useState<string[]>([]);
    const [savingQualifications, setSavingQualifications] = useState(false);

    async function load() {
        const [loadedUser, loadedQualifications] = await Promise.all([
            userService.getUserById(props.userId),
            qualificationService.getQualifications()
        ]);

        setUser(loadedUser);
        setAllQualifications(loadedQualifications ?? []);

        const activeIds = getActiveQualificationIds(props.userId, loadedQualifications ?? []);
        setOriginalQualificationIds(activeIds);
        setQualificationDraft(activeIds);
    }

    useEffect(() => {
        void load();
    }, [props.userId]);

    async function updateUser(
        username: string,
        firstName: string,
        lastName: string,
        email: string,
        status: UserStatus
    ) {
        try {
            const result = await userService.updateUser({
                id: props.userId,
                username,
                firstName,
                lastName,
                email,
                status
            });

            if (!result?.success) {
                setMessage(result?.message ?? "Unable to update user.");
                return;
            }

            setEditing(false);
            setMessage("User updated successfully.");
            await load();
        } catch (error) {
            setMessage(formatError(error));
        }
    }

    function beginQualificationEdit() {
        const activeIds = getActiveQualificationIds(props.userId, allQualifications);
        setOriginalQualificationIds(activeIds);
        setQualificationDraft(activeIds);
        setEditingQualifications(true);
        setMessage("");
    }

    function toggleQualificationSelection(qualificationId: string) {
        setQualificationDraft((current) =>
            current.includes(qualificationId)
                ? current.filter((id) => id !== qualificationId)
                : [...current, qualificationId]
        );
    }

    async function saveQualifications() {
        try {
            setSavingQualifications(true);
            setMessage("");

            const originalSet = new Set(originalQualificationIds);
            const draftSet = new Set(qualificationDraft);

            const additions = qualificationDraft.filter((id) => !originalSet.has(id));
            const removals = originalQualificationIds.filter((id) => !draftSet.has(id));

            for (const qualificationId of additions) {
                const result = await qualificationService.assignUser(qualificationId, props.userId);
                if (!result?.success) {
                    throw new Error(result?.message ?? "Unable to assign qualification.");
                }
            }

            for (const qualificationId of removals) {
                const result = await qualificationService.unassignUser(
                    qualificationId,
                    props.userId,
                    "Updated from user detail"
                );
                if (!result?.success) {
                    throw new Error(result?.message ?? "Unable to remove qualification.");
                }
            }

            setEditingQualifications(false);
            setMessage("Qualifications updated successfully.");
            await load();
        } catch (error) {
            setMessage(formatError(error));
        } finally {
            setSavingQualifications(false);
        }
    }

    if (!user) {
        return <div style={{ padding: "40px" }}>Loading...</div>;
    }

    const assignedIds = new Set(
        getActiveQualificationIds(props.userId, allQualifications)
    );

    if (changingPassword) {
        return (
            <ChangePasswordForm
                onChange={async (password) => {
                    try {
                        const result = await userService.changePassword(props.userId, password);
                        if (!result?.success) {
                            setMessage(result?.message ?? "Unable to change password.");
                            return;
                        }
                        setMessage("Password changed successfully.");
                        setChangingPassword(false);
                        await load();
                    } catch (error) {
                        setMessage(formatError(error));
                    }
                }}
                onCancel={() => {
                    setChangingPassword(false);
                    setMessage("");
                }}
            />
        );
    }

    if (editing) {
        return (
            <EditUserForm
                username={user.username}
                firstName={user.firstName}
                lastName={user.lastName}
                email={user.email ?? ""}
                status={user.status}
                onUpdate={updateUser}
                onCancel={() => {
                    setEditing(false);
                    setMessage("");
                }}
            />
        );
    }

    if (editingQualifications) {
        return (
            <div style={{ padding: "40px" }}>
                <button onClick={() => setEditingQualifications(false)} style={{ marginBottom: "20px" }}>
                    ← Cancel
                </button>

                <h1>Edit Qualifications</h1>
                {message && <p style={{ color: "darkred" }}>{message}</p>}

                <div style={{ marginBottom: "20px" }}>
                    {allQualifications.length === 0 ? (
                        <p>No qualifications available.</p>
                    ) : (
                        allQualifications.map((qualification) => (
                            <label
                                key={qualification.id}
                                style={{ display: "block", marginBottom: "8px" }}
                            >
                                <input
                                    type="checkbox"
                                    checked={qualificationDraft.includes(qualification.id)}
                                    onChange={() => toggleQualificationSelection(qualification.id)}
                                />
                                {" "}
                                {qualification.name}
                            </label>
                        ))
                    )}
                </div>

                <button onClick={() => void saveQualifications()} disabled={savingQualifications}>
                    {savingQualifications ? "Updating..." : "Update Qualifications"}
                </button>
                <button onClick={() => setEditingQualifications(false)} style={{ marginLeft: "10px" }}>
                    Cancel
                </button>
            </div>
        );
    }

    const activeQualifications = allQualifications.filter((qualification) =>
        assignedIds.has(qualification.id)
    );

    return (
        <div style={{ padding: "40px" }}>
            <h1>User Detail</h1>
            <button onClick={props.onBack}>Back To User List</button>
            {message && <p>{message}</p>}

            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>Name:</strong> {user.firstName} {user.lastName}</p>
            <p><strong>Email:</strong> {user.email ?? "N/A"}</p>
            <p><strong>Status:</strong> {user.status}</p>

            <h2>Assigned Qualifications</h2>
            {activeQualifications.length === 0 ? (
                <p>No qualifications assigned.</p>
            ) : (
                <ul>
                    {activeQualifications.map((qualification) => (
                        <li key={qualification.id}>{qualification.name}</li>
                    ))}
                </ul>
            )}

            <div style={{ marginTop: "20px" }}>
                <button onClick={() => setEditing(true)}>Edit User</button>
                <button onClick={() => setChangingPassword(true)} style={{ marginLeft: "10px" }}>
                    Change Password
                </button>
                <button onClick={beginQualificationEdit} style={{ marginLeft: "10px" }}>
                    Edit Qualifications
                </button>
            </div>
        </div>
    );
}
