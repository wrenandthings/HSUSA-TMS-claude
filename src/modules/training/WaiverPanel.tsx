import { useEffect, useState } from "react";
import { StatusBadge, day } from "./trainingLabels";

// Waivers and overrides for one person's qualification (Rules Matrix
// "Administrative Override Rules", Approval Matrix "Qualification Waivers").
// Waive one training: Director of Operations or Administrator.
// Override the whole qualification: Administrator. Reason and end date required.

export default function WaiverPanel(props: { userId: string; username: string; code: string; onClose: () => void; onChanged: () => void }) {
    const [data, setData] = useState<any>(null);
    const [problem, setProblem] = useState("");
    const [message, setMessage] = useState("");
    const [granting, setGranting] = useState<{ targetType: "TRAINING" | "QUALIFICATION"; targetRef: string; name: string } | null>(null);
    const [reason, setReason] = useState("");
    const [documentation, setDocumentation] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [revoking, setRevoking] = useState<string | null>(null);
    const [revokeReason, setRevokeReason] = useState("");

    async function load() {
        const result = await window.hsusa.getWaivers(props.userId, props.code);
        if (result?.success) { setData(result); setProblem(""); } else setProblem(result?.message ?? "Unable to load.");
    }
    useEffect(() => { void load(); }, [props.userId, props.code]);

    function startGrant(targetType: "TRAINING" | "QUALIFICATION", targetRef: string, name: string) {
        setGranting({ targetType, targetRef, name });
        setReason(""); setDocumentation(""); setExpiresAt(""); setProblem(""); setMessage("");
    }

    async function grant() {
        if (!granting) return;
        const result = await window.hsusa.grantWaiver({ userId: props.userId, ...granting, reason, documentation, expiresAt });
        if (result?.success) { setGranting(null); setMessage(result.message); await load(); props.onChanged(); }
        else setProblem(result?.message ?? "Unable to save.");
    }

    async function revoke(id: string) {
        const result = await window.hsusa.revokeWaiver(id, revokeReason);
        if (result?.success) { setRevoking(null); setRevokeReason(""); setMessage(result.message); await load(); props.onChanged(); }
        else setProblem(result?.message ?? "Unable to revoke.");
    }

    const q = data?.qualification;
    const activeFor = (ref: string) => data?.waivers.find((w: any) => w.targetRef === ref && !w.revokedAt && new Date(w.expiresAt) >= new Date(new Date().toDateString()));

    return (
        <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <h2 style={{ margin: 0 }}>Waivers for {props.username}</h2>
                <button onClick={props.onClose}>Close</button>
            </div>
            {!data && !problem && <p className="muted">Loading...</p>}
            {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}
            {message && <p className="badge good" role="status" style={{ margin: 0, alignSelf: "flex-start" }}>{message}</p>}
            {q && (
                <>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <strong>{q.name}</strong> <StatusBadge status={q.status} />
                        {q.overridden && <span className="muted" style={{ fontSize: "14px" }}>Overridden until {day(q.overridden.expiresAt)}: {q.overridden.reason}</span>}
                        {data.canOverride && !activeFor(props.code) && <button onClick={() => startGrant("QUALIFICATION", props.code, `the whole ${q.name} qualification`)}>Override qualification</button>}
                    </div>
                    <table style={{ width: "100%", border: "none" }}>
                        <thead><tr><th>Needs</th><th>Status</th><th>Due</th><th></th></tr></thead>
                        <tbody>
                            {q.items.map((item: any) => (
                                <tr key={`${item.type}:${item.code}`}>
                                    <td>{item.name}{item.type === "QUALIFICATION" && <span className="muted"> (qualification)</span>}</td>
                                    <td><StatusBadge status={item.status} />{item.waived && <div className="muted" style={{ fontSize: "13px" }}>Waived: {item.waived.reason}</div>}</td>
                                    <td>{day(item.dueDate)}</td>
                                    <td style={{ textAlign: "right" }}>
                                        {item.type === "TRAINING" && data.canWaive && !activeFor(item.code) && <button onClick={() => startGrant("TRAINING", item.code, item.name)}>Waive</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {granting && (
                <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--surface-alt, #F6F8FB)" }}>
                    <strong>{granting.targetType === "TRAINING" ? "Waive" : "Override"} {granting.name}</strong>
                    <div className="quiz-filters">
                        <label style={{ flex: 1 }}>Reason (required)<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                        <label>Ends on<input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label>
                    </div>
                    <div className="quiz-filters">
                        <label style={{ flex: 1 }}>Supporting documentation (optional)<input value={documentation} placeholder="For example: DO email of 21 Nov" onChange={(e) => setDocumentation(e.target.value)} /></label>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button className="primary" onClick={() => void grant()}>Save</button>
                        <button onClick={() => setGranting(null)}>Cancel</button>
                    </div>
                </div>
            )}

            {data && data.waivers.length > 0 && (
                <>
                    <h3 style={{ margin: "8px 0 0" }}>History</h3>
                    <table style={{ width: "100%", border: "none" }}>
                        <thead><tr><th>What</th><th>Reason</th><th>From</th><th>Ends</th><th>Approved by</th><th></th></tr></thead>
                        <tbody>
                            {data.waivers.map((w: any) => (
                                <tr key={w.id}>
                                    <td>{w.targetType === "QUALIFICATION" ? `Override ${w.targetRef}` : `Waive ${w.targetRef}`}</td>
                                    <td>{w.reason}{w.documentation && <div className="muted" style={{ fontSize: "13px" }}>{w.documentation}</div>}</td>
                                    <td>{day(w.issuedAt)}</td>
                                    <td>{day(w.expiresAt)}</td>
                                    <td>{w.approvedBy}</td>
                                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                        {w.revokedAt ? <span className="muted" style={{ fontSize: "13px" }}>Revoked by {w.revokedBy}: {w.revokeReason}</span>
                                            : revoking === w.id ? (
                                                <span style={{ display: "inline-flex", gap: "6px" }}>
                                                    <input placeholder="Reason" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} aria-label="Reason for revoking" />
                                                    <button className="danger" onClick={() => void revoke(w.id)}>Revoke</button>
                                                    <button onClick={() => setRevoking(null)}>Cancel</button>
                                                </span>
                                            ) : ((w.targetType === "TRAINING" ? data.canWaive : data.canOverride) && <button onClick={() => { setRevoking(w.id); setRevokeReason(""); }}>Revoke...</button>)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </section>
    );
}
