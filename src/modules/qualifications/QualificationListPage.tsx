import { useEffect, useState } from "react";
import { Assignment, Qualification, QualificationInput, QualificationService } from "./QualificationService";
import QualificationStatusBadge from "./QualificationStatusBadge";
import { formatQualificationDate, statusDisplay } from "./qualificationStatusDisplay";

interface Props { onBack: () => void; }
type User = { id: string; username: string };
type DateDraft = { awardedDate: string; expirationDate: string };

const service = new QualificationService();
const emptyForm = (): QualificationInput => ({ code: "", name: "", description: "", renewalMonths: "", active: true });
const WARNING_STATUSES = ["EXPIRING", "EXPIRING_CRITICAL", "EXPIRED", "SUSPENDED"] as const;

// Dates are stored as UTC midnight, so the UTC date is the day that was picked.
function dateInputValue(value?: string | Date | null): string {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function toForm(item: Qualification): QualificationInput {
    return {
        code: item.code,
        name: item.name,
        description: item.description ?? "",
        renewalMonths: item.renewalMonths ? String(item.renewalMonths) : "",
        active: item.active
    };
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unable to save qualification.";
}

function renewalText(item: Qualification) {
    return item.renewalMonths ? `${item.renewalMonths} months` : "Does not expire";
}

function activeAssignments(item: Qualification): Assignment[] {
    return (item.assignments ?? []).filter(a => a.status === "ACTIVE");
}

// Counts of active assignments that need attention, for the list view.
function WarningSummary(props: { item: Qualification }) {
    const active = activeAssignments(props.item);
    const parts = WARNING_STATUSES
        .map(status => ({ status, count: active.filter(a => a.qualificationStatus === status).length }))
        .filter(p => p.count > 0);
    if (parts.length === 0) return <span>None</span>;
    return <>{parts.map(p => <span key={p.status} style={{ marginRight: 6 }}><QualificationStatusBadge status={p.status} /> {p.count}</span>)}</>;
}

export default function QualificationListPage(props: Props) {
    const [items, setItems] = useState<Qualification[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selected, setSelected] = useState<Qualification | null>(null);
    const [form, setForm] = useState<QualificationInput>(emptyForm());
    const [editing, setEditing] = useState(false);
    const [message, setMessage] = useState("");
    const [newAssignment, setNewAssignment] = useState<{ userId: string } & DateDraft>({ userId: "", awardedDate: "", expirationDate: "" });
    const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
    const [dateDraft, setDateDraft] = useState<DateDraft>({ awardedDate: "", expirationDate: "" });

    async function load() {
        try {
            setItems(await service.getQualifications());
            setUsers(await window.hsusa.getUsers());
        } catch (error) {
            setMessage(errorMessage(error));
        }
    }

    useEffect(() => { void load(); }, []);

    async function refreshSelected(id: string) {
        await load();
        setSelected(await service.getQualificationById(id));
    }

    // Runs a change, shows its error message if it fails, and reloads.
    async function run(action: () => Promise<{ success: boolean; message?: string }>, failure: string) {
        try {
            const result = await action();
            if (!result.success) { setMessage(result.message ?? failure); return false; }
            setMessage("");
            return true;
        } catch (error) {
            setMessage(errorMessage(error));
            return false;
        }
    }

    function startCreate() {
        setSelected(null);
        setForm(emptyForm());
        setMessage("");
        setEditing(true);
    }

    function startEdit(item: Qualification) {
        setSelected(item);
        setForm(toForm(item));
        setMessage("");
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
        setSelected(null);
        setForm(emptyForm());
    }

    async function save() {
        if (!form.code.trim() || !form.name.trim()) {
            setMessage("Qualification code and name are required.");
            return;
        }
        const ok = await run(
            () => selected ? service.updateQualification({ id: selected.id, ...form }) : service.createQualification(form),
            "Unable to save qualification."
        );
        if (!ok) return;
        cancelEdit();
        setMessage("Qualification saved successfully.");
        await load();
    }

    async function openDetails(item: Qualification) {
        try {
            setSelected(await service.getQualificationById(item.id));
            setNewAssignment({ userId: "", awardedDate: "", expirationDate: "" });
            setEditingAssignment(null);
        } catch (error) {
            setMessage(errorMessage(error));
        }
    }

    async function assign() {
        if (!selected || !newAssignment.userId) return;
        const ok = await run(() => service.assignUser({
            qualificationId: selected.id,
            userId: newAssignment.userId,
            awardedDate: newAssignment.awardedDate || undefined,
            expirationDate: newAssignment.expirationDate || undefined
        }), "Unable to assign user.");
        if (ok) setNewAssignment({ userId: "", awardedDate: "", expirationDate: "" });
        await refreshSelected(selected.id);
    }

    function startDateEdit(assignment: Assignment) {
        setEditingAssignment(assignment.id);
        setDateDraft({ awardedDate: dateInputValue(assignment.awardedDate), expirationDate: dateInputValue(assignment.expirationDate) });
    }

    async function saveDates(assignment: Assignment) {
        if (!selected) return;
        const ok = await run(() => service.updateAssignment({
            assignmentId: assignment.id,
            awardedDate: dateDraft.awardedDate || null,
            expirationDate: dateDraft.expirationDate || null
        }), "Unable to update dates.");
        if (ok) setEditingAssignment(null);
        await refreshSelected(selected.id);
    }

    async function setSuspended(assignment: Assignment, suspended: boolean) {
        if (!selected) return;
        const verb = suspended ? "Suspend" : "Reinstate";
        if (!window.confirm(`${verb} ${selected.name} for ${assignment.user.username}?`)) return;
        await run(() => service.updateAssignment({ assignmentId: assignment.id, suspended }), `Unable to ${verb.toLowerCase()}.`);
        await refreshSelected(selected.id);
    }

    async function unassign(assignment: Assignment) {
        if (!selected) return;
        const reason = window.prompt(`Remove ${selected.name} from ${assignment.user.username}? Reason (optional):`, "");
        if (reason === null) return;
        await run(() => service.unassignUser(selected.id, assignment.user.id, reason || undefined), "Unable to remove user.");
        await refreshSelected(selected.id);
    }

    async function remove(item: Qualification) {
        if (!window.confirm(`Delete qualification "${item.name}"?`)) return;
        const ok = await run(() => service.deleteQualification(item.id), "Unable to delete qualification.");
        if (!ok) return;
        setSelected(null);
        await load();
    }

    if (editing) return (
        <div style={{ padding: "40px" }}>
            <button onClick={cancelEdit}>← Cancel</button>
            <h1>{selected ? "Edit Qualification" : "New Qualification"}</h1>
            {message && <p>{message}</p>}
            <label>Code<br /><input autoFocus value={form.code} placeholder="PIC" onChange={e => setForm({ ...form, code: e.target.value })} /></label><br /><br />
            <label>Name<br /><input value={form.name} placeholder="Pilot In Command" onChange={e => setForm({ ...form, name: e.target.value })} /></label><br /><br />
            <label>Description<br /><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><br /><br />
            <label>Renewal (months)<br /><input type="number" min={1} value={form.renewalMonths} placeholder="Leave empty if it does not expire" onChange={e => setForm({ ...form, renewalMonths: e.target.value })} /></label><br />
            <small>Used to work out a person's expiration date from the date it was awarded.</small><br /><br />
            <label><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active</label><br /><br />
            <button onClick={() => void save()}>Save Qualification</button>
        </div>
    );

    if (selected) {
        const active = activeAssignments(selected);
        const history = (selected.assignments ?? []).filter(a => a.status !== "ACTIVE");
        const assignedIds = new Set(active.map(a => a.user.id));
        return (
            <div style={{ padding: "40px" }}>
                <button onClick={() => setSelected(null)}>← Back To Qualifications</button>
                <h1>{selected.name} ({selected.code})</h1>
                {message && <p>{message}</p>}
                <p>{selected.description}</p>
                <p><strong>Renewal:</strong> {renewalText(selected)}{selected.active ? "" : " · Inactive"}</p>
                <button onClick={() => startEdit(selected)}>Edit Qualification</button>

                <h2>Assign a person</h2>
                <select value={newAssignment.userId} onChange={e => setNewAssignment({ ...newAssignment, userId: e.target.value })}>
                    <option value="">Select user</option>
                    {users.filter(user => !assignedIds.has(user.id)).map(user => <option key={user.id} value={user.id}>{user.username}</option>)}
                </select>{" "}
                <label>Awarded <input type="date" value={newAssignment.awardedDate} onChange={e => setNewAssignment({ ...newAssignment, awardedDate: e.target.value })} /></label>{" "}
                <label>Expires <input type="date" value={newAssignment.expirationDate} onChange={e => setNewAssignment({ ...newAssignment, expirationDate: e.target.value })} /></label>{" "}
                <button disabled={!newAssignment.userId} onClick={() => void assign()}>Assign</button><br />
                <small>{selected.renewalMonths ? `Leave Expires empty to use the awarded date plus ${selected.renewalMonths} months.` : "This qualification does not expire unless you set a date."}</small>

                <h2>Assigned People</h2>
                {active.length === 0 ? <p>Nobody is assigned.</p> : (
                    <table border={1} cellPadding={8}>
                        <thead><tr><th>User</th><th>Status</th><th>Awarded</th><th>Expires</th><th>Actions</th></tr></thead>
                        <tbody>{active.map(a => editingAssignment === a.id ? (
                            <tr key={a.id}>
                                <td>{a.user.username}</td>
                                <td><QualificationStatusBadge status={a.qualificationStatus} /></td>
                                <td><input type="date" value={dateDraft.awardedDate} onChange={e => setDateDraft({ ...dateDraft, awardedDate: e.target.value })} /></td>
                                <td><input type="date" value={dateDraft.expirationDate} onChange={e => setDateDraft({ ...dateDraft, expirationDate: e.target.value })} /></td>
                                <td><button onClick={() => void saveDates(a)}>Save</button> <button onClick={() => setEditingAssignment(null)}>Cancel</button></td>
                            </tr>
                        ) : (
                            <tr key={a.id}>
                                <td>{a.user.username}</td>
                                <td><QualificationStatusBadge status={a.qualificationStatus} /></td>
                                <td>{a.awardedDate ? formatQualificationDate(a.awardedDate) : "—"}</td>
                                <td>{formatQualificationDate(a.expirationDate)}</td>
                                <td>
                                    <button onClick={() => startDateEdit(a)}>Edit Dates</button>{" "}
                                    <button onClick={() => void setSuspended(a, !a.suspended)}>{a.suspended ? "Reinstate" : "Suspend"}</button>{" "}
                                    <button onClick={() => void unassign(a)}>Remove</button>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                )}

                <h2>Assignment History</h2>
                {history.length === 0 ? <p>No earlier assignments.</p> : (
                    <ul>{history.map(a => (
                        <li key={a.id}>
                            {a.user.username} — {a.status}{(a.revokedAt ?? a.completedAt) ? ` on ${new Date(a.revokedAt ?? a.completedAt!).toLocaleDateString()}` : ""} — {a.endReason ?? ""}
                        </li>
                    ))}</ul>
                )}
            </div>
        );
    }

    return (
        <div style={{ padding: "40px" }}>
            <button onClick={props.onBack}>← Back To Main Menu</button>
            <h1>Qualifications</h1>
            <button onClick={startCreate}>+ Add Qualification</button>
            {message && <p>{message}</p>}
            <table border={1} cellPadding={10} style={{ marginTop: 20 }}>
                <thead><tr><th>Code</th><th>Name</th><th>Renewal</th><th>Assigned</th><th>Needs attention</th><th>Actions</th></tr></thead>
                <tbody>{items.map(item => <tr key={item.id} style={item.active ? undefined : { opacity: 0.6 }}>
                    <td>{item.code}</td>
                    <td><button onClick={() => void openDetails(item)}>{item.name}</button>{item.active ? "" : " (inactive)"}</td>
                    <td>{renewalText(item)}</td>
                    <td>{activeAssignments(item).length}</td>
                    <td title={WARNING_STATUSES.map(s => statusDisplay(s).label).join(", ")}><WarningSummary item={item} /></td>
                    <td><button onClick={() => startEdit(item)}>Edit</button> <button onClick={() => void remove(item)}>Delete</button></td>
                </tr>)}</tbody>
            </table>
        </div>
    );
}
