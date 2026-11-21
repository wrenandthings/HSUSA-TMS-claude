import { useEffect, useState } from "react";
import { askToConfirm } from "../../components/askToConfirm";
import { APPROVAL, RESULT, StatusBadge, day, todayInput } from "./trainingLabels";

// My training (owner decision 2026-11-21): the same view for everyone.
// Each assigned qualification shows what it needs and when each part is due.
// People record their own training; it counts once a manager approves it.

export default function MyTrainingPage() {
    const [data, setData] = useState<any>(null);
    const [problem, setProblem] = useState("");
    const [recording, setRecording] = useState<string | null>(null); // programId, or "" for the empty form

    async function load() {
        const result = await window.hsusa.myTraining();
        if (result?.success) { setData(result); setProblem(""); } else setProblem(result?.message ?? "Unable to load your training.");
    }
    useEffect(() => { void load(); }, []);

    async function withdraw(record: any) {
        if (!(await askToConfirm(`Withdraw your ${record.program} record from ${day(record.completionDate)}?`, "Withdraw"))) return;
        const result = await window.hsusa.withdrawTraining(record.id);
        if (!result?.success) setProblem(result?.message ?? "Unable to withdraw.");
        await load();
    }

    if (!data) return <div className="page">{problem ? <p className="message-error" role="alert">{problem}</p> : <p className="muted">Loading...</p>}</div>;

    return (
        <div className="page page-narrow">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <h1 style={{ margin: 0 }}>My training</h1>
                <button className="primary" onClick={() => setRecording("")}>Record training</button>
            </div>
            {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}

            {recording !== null && (
                <RecordForm programs={data.programs} programId={recording} onCancel={() => setRecording(null)} onSaved={async () => { setRecording(null); await load(); }} />
            )}

            {data.qualifications.length === 0 ? (
                <section className="panel"><p className="muted" style={{ margin: 0 }}>You have no qualifications assigned yet. A manager assigns them from Users.</p></section>
            ) : data.qualifications.map((q: any) => (
                <section key={q.code} className="panel" style={{ padding: "8px 0 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "12px 24px", flexWrap: "wrap" }}>
                        <h2 style={{ margin: 0 }}>{q.name}</h2>
                        <StatusBadge status={q.status} />
                        {q.dueDate && <span className="muted" style={{ fontSize: "14px" }}>Next due {day(q.dueDate)}</span>}
                    </div>
                    {q.items.length === 0 ? (
                        <p className="muted" style={{ margin: "0 24px 20px" }}>No requirements are set for this qualification.</p>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", border: "none" }}>
                                <thead><tr><th>Needs</th><th>Status</th><th>Last done</th><th>Due</th><th></th></tr></thead>
                                <tbody>
                                    {q.items.map((item: any) => (
                                        <tr key={`${item.type}:${item.code}`}>
                                            <td>
                                                {item.name}
                                                {item.type === "QUALIFICATION" && <span className="muted"> (qualification)</span>}
                                                {item.type === "TRAINING" && item.renewalMonths == null && <span className="muted"> (once)</span>}
                                            </td>
                                            <td>
                                                <StatusBadge status={item.status} />
                                                {item.inGrace && <div className="muted" style={{ fontSize: "13px" }}>In grace until {day(item.graceEnd)}</div>}
                                            </td>
                                            <td>{day(item.lastCompleted)}</td>
                                            <td>{day(item.dueDate)}</td>
                                            <td style={{ textAlign: "right" }}>
                                                {item.type === "TRAINING" && item.programId && <button onClick={() => setRecording(item.programId)}>Record</button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            ))}

            <section className="panel" style={{ padding: "8px 0 0" }}>
                <h2 style={{ margin: "12px 24px" }}>Your records</h2>
                {data.records.length === 0 ? (
                    <p className="muted" style={{ margin: "0 24px 20px" }}>Nothing recorded yet.</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", border: "none" }}>
                            <thead><tr><th>Training</th><th>Completed</th><th>Result</th><th>Approval</th><th></th></tr></thead>
                            <tbody>
                                {data.records.map((r: any) => (
                                    <tr key={r.id}>
                                        <td>{r.program}{r.instructorName && <div className="muted" style={{ fontSize: "13px" }}>Instructor: {r.instructorName}</div>}</td>
                                        <td>{day(r.completionDate)}</td>
                                        <td>{RESULT[r.result] ?? r.result}</td>
                                        <td>
                                            <span className={`badge ${APPROVAL[r.approval].tone}`}>{APPROVAL[r.approval].label}</span>
                                            {r.reviewedBy && <div className="muted" style={{ fontSize: "13px" }}>by {r.reviewedBy}{r.reviewNote ? `: ${r.reviewNote}` : ""}</div>}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            {r.approval === "PENDING" && <button onClick={() => void withdraw(r)}>Withdraw</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function RecordForm(props: { programs: any[]; programId: string; onCancel: () => void; onSaved: () => void }) {
    const [programId, setProgramId] = useState(props.programId);
    const [completionDate, setCompletionDate] = useState(todayInput());
    const [result, setResult] = useState("PASS");
    const [instructorName, setInstructorName] = useState("");
    const [notes, setNotes] = useState("");
    const [problem, setProblem] = useState("");
    const [saving, setSaving] = useState(false);
    useEffect(() => setProgramId(props.programId), [props.programId]);

    const categories = [...new Set(props.programs.map((p) => p.category))];

    async function save() {
        setSaving(true);
        setProblem("");
        try {
            const r = await window.hsusa.recordTraining({ programId, completionDate, result, instructorName, notes });
            if (r?.success) props.onSaved(); else setProblem(r?.message ?? "Unable to record.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0 }}>Record training</h2>
            <p className="muted" style={{ margin: 0 }}>It counts once a manager approves it.</p>
            <div className="quiz-filters">
                <label>
                    Training
                    <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
                        <option value="">Choose...</option>
                        {categories.map((c) => (
                            <optgroup key={c} label={c}>
                                {props.programs.filter((p) => p.category === c).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </label>
                <label>
                    Date completed
                    <input type="date" value={completionDate} max={todayInput()} onChange={(e) => setCompletionDate(e.target.value)} />
                </label>
                <label>
                    Result
                    <select value={result} onChange={(e) => setResult(e.target.value)}>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                        <option value="INCOMPLETE">Incomplete</option>
                    </select>
                </label>
            </div>
            <div className="quiz-filters">
                <label>
                    Instructor or check airman (optional)
                    <input value={instructorName} onChange={(e) => setInstructorName(e.target.value)} />
                </label>
                <label style={{ flex: 1 }}>
                    Notes (optional)
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
            </div>
            {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}
            <div style={{ display: "flex", gap: "8px" }}>
                <button className="primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Send for approval"}</button>
                <button onClick={props.onCancel}>Cancel</button>
            </div>
        </section>
    );
}
