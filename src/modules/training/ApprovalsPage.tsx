import { useEffect, useState } from "react";
import { RESULT, day } from "./trainingLabels";

// Approvals (owner decision 2026-11-21): any of the six manager roles can
// approve recorded training. Nobody approves their own.

export default function ApprovalsPage(props: { onChanged?: () => void }) {
    const [records, setRecords] = useState<any[] | null>(null);
    const [problem, setProblem] = useState("");
    const [message, setMessage] = useState("");
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    async function load() {
        const result = await window.hsusa.pendingTraining();
        if (result?.success) { setRecords(result.records); setProblem(""); } else setProblem(result?.message ?? "Unable to load approvals.");
    }
    useEffect(() => { void load(); }, []);

    async function review(record: any, approve: boolean) {
        setBusy(true);
        setMessage("");
        setProblem("");
        try {
            const result = await window.hsusa.reviewTraining(record.id, approve, approve ? "" : reason);
            if (result?.success) {
                setMessage(`${approve ? "Approved" : "Rejected"}: ${record.person}, ${record.program}.`);
                setRejecting(null);
                setReason("");
                props.onChanged?.();
                await load();
            } else setProblem(result?.message ?? "Unable to save.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="page page-narrow">
            <h1 style={{ margin: 0 }}>Approvals</h1>
            {message && <p className="badge good" role="status" style={{ margin: 0, alignSelf: "flex-start" }}>{message}</p>}
            {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}
            <section className="panel" style={{ padding: "8px 0 0" }}>
                <h2 style={{ margin: "12px 24px" }}>Training waiting for approval</h2>
                {!records ? <p className="muted" style={{ margin: "0 24px 20px" }}>Loading...</p>
                    : records.length === 0 ? <p className="muted" style={{ margin: "0 24px 20px" }}>Nothing is waiting.</p>
                    : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", border: "none" }}>
                                <thead><tr><th>Person</th><th>Training</th><th>Completed</th><th>Result</th><th></th></tr></thead>
                                <tbody>
                                    {records.map((r) => (
                                        <tr key={r.id}>
                                            <td>{r.person}<div className="muted" style={{ fontSize: "13px" }}>{r.username}</div></td>
                                            <td>
                                                {r.program}
                                                {r.instructorName && <div className="muted" style={{ fontSize: "13px" }}>Instructor: {r.instructorName}</div>}
                                                {r.notes && <div className="muted" style={{ fontSize: "13px" }}>{r.notes}</div>}
                                            </td>
                                            <td>{day(r.completionDate)}</td>
                                            <td>{RESULT[r.result] ?? r.result}</td>
                                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                                {r.own ? <span className="muted">Your own. Another manager approves it.</span>
                                                    : rejecting === r.id ? (
                                                        <span style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                                                            <input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for rejecting" />
                                                            <button className="danger" disabled={busy} onClick={() => void review(r, false)}>Reject</button>
                                                            <button onClick={() => { setRejecting(null); setReason(""); }}>Cancel</button>
                                                        </span>
                                                    ) : (
                                                        <span style={{ display: "inline-flex", gap: "8px" }}>
                                                            <button className="primary" disabled={busy} onClick={() => void review(r, true)}>Approve</button>
                                                            <button disabled={busy} onClick={() => { setRejecting(r.id); setReason(""); }}>Reject...</button>
                                                        </span>
                                                    )}
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
