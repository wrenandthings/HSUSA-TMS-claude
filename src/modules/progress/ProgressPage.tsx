import { useEffect, useState } from "react";

// Progress (Phase 8; UI spec ANL-001). Knowledge stays hidden until a subject
// is covered enough (Settings > Readiness), per the Master Baseline.

const tone = (value: number | null) => value === null ? "" : value >= 80 ? "good" : value >= 50 ? "warn" : "bad";

export default function ProgressPage() {
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const [data, setData] = useState<any>(null);
    const [everyone, setEveryone] = useState<any[] | null>(null);
    const [problem, setProblem] = useState("");

    useEffect(() => {
        void (async () => {
            const result = await window.hsusa.getProgress(userId);
            if (result?.success) { setData(result); setProblem(""); } else setProblem(result?.message ?? "Unable to load progress.");
            if (result?.canSeeOthers && everyone === null) {
                const all = await window.hsusa.getEveryoneProgress();
                if (all?.success) setEveryone(all.people);
            }
        })();
    }, [userId]);

    if (!data) return <div className="page">{problem ? <p className="message-error" role="alert">{problem}</p> : <p className="muted">Loading...</p>}</div>;
    const w = data.weights;

    return (
        <div className="page page-narrow">
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ margin: 0 }}>Progress</h1>
                    {data.canSeeOthers && <div className="muted" style={{ fontSize: "14px" }}>{data.person.name}</div>}
                </div>
                {data.canSeeOthers && everyone && (
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", fontWeight: 600 }}>
                        Person
                        <select value={data.person.id} onChange={(e) => setUserId(e.target.value)}>
                            {everyone.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.username})</option>)}
                        </select>
                    </label>
                )}
            </div>
            {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}

            <section className="panel" style={{ display: "flex", flexWrap: "wrap", gap: "40px" }}>
                <Figure label="Readiness" value={data.readiness} hint={data.readiness === null ? `Shown once a subject is ${w.threshold}% covered` : data.qualifications.score === null ? "Knowledge only: no qualifications assigned" : `Knowledge ${w.knowledge}% + qualifications ${w.qualification}%`} />
                <Figure label="Knowledge" value={data.knowledge} hint={data.knowledge === null ? `Shown once a subject is ${w.threshold}% covered` : "Latest quiz answer right, in covered subjects"} />
                <Figure label="Qualifications" value={data.qualifications.score} hint={data.qualifications.assigned ? `${data.qualifications.current} of ${data.qualifications.assigned} current` : "None assigned"} />
                <Figure label="Coverage" value={data.coverage} hint={`${data.seen} of ${data.totalQuestions} questions answered in quizzes`} plain />
            </section>

            <section className="panel" style={{ padding: "8px 0 0" }}>
                <h2 style={{ margin: "12px 24px 4px" }}>By subject</h2>
                <p className="muted" style={{ margin: "0 24px 12px" }}>Knowledge shows once {w.threshold}% of a subject's questions have been answered in quizzes.</p>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", border: "none" }}>
                        <thead><tr><th>Subject</th><th style={{ width: "40%" }}>Coverage</th><th>Knowledge</th></tr></thead>
                        <tbody>
                            {data.subjects.map((s: any) => (
                                <tr key={s.code}>
                                    <td>{s.code}<div className="muted" style={{ fontSize: "13px" }}>{s.name}</div></td>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <div className="progress" style={{ flex: 1 }} role="progressbar" aria-label={`${s.code} coverage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.coverage}>
                                                <span style={{ width: `${s.coverage}%` }}></span>
                                            </div>
                                            <span style={{ fontSize: "13px", minWidth: "96px" }}>{s.coverage}% · {s.seen} of {s.total}</span>
                                        </div>
                                    </td>
                                    <td>{s.knowledgeVisible ? <span className={`badge ${tone(s.knowledge)}`}>{s.knowledge}%</span> : <span className="muted" style={{ fontSize: "13px" }}>Not yet</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="panel" style={{ padding: "8px 0 0" }}>
                <h2 style={{ margin: "12px 24px 4px" }}>Weak areas</h2>
                <p className="muted" style={{ margin: "0 24px 12px" }}>Sections with at least 3 questions answered, lowest score first. A Weak areas quiz or flashcards bring these questions back.</p>
                {data.weakAreas.length === 0 ? <p className="muted" style={{ margin: "0 24px 20px" }}>None yet.</p> : (
                    <table style={{ width: "100%", border: "none" }}>
                        <thead><tr><th>Subject</th><th>Section</th><th>Answered</th><th>Score</th></tr></thead>
                        <tbody>
                            {data.weakAreas.map((a: any) => (
                                <tr key={`${a.subject}|${a.section}`}>
                                    <td>{a.subject}</td><td>{a.section}</td><td>{a.answered}</td>
                                    <td><span className={`badge ${tone(a.score)}`}>{a.score}%</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <section className="panel" style={{ padding: "8px 0 0" }}>
                <h2 style={{ margin: "12px 24px" }}>Qualifications</h2>
                {data.qualifications.items.length === 0 ? <p className="muted" style={{ margin: "0 24px 20px" }}>None assigned.</p> : (
                    <table style={{ width: "100%", border: "none" }}>
                        <thead><tr><th>Qualification</th><th>Status</th><th>Counts toward readiness</th></tr></thead>
                        <tbody>
                            {data.qualifications.items.map((q: any) => (
                                <tr key={q.code}>
                                    <td>{q.name}</td>
                                    <td>{statusLabel(q.status)}</td>
                                    <td>{q.counts ? <span className="badge good">Yes</span> : <span className="badge bad">No</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {data.canSeeOthers && everyone && (
                <section className="panel" style={{ padding: "8px 0 0" }}>
                    <h2 style={{ margin: "12px 24px" }}>Everyone</h2>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", border: "none" }}>
                            <thead><tr><th>Person</th><th>Readiness</th><th>Knowledge</th><th>Qualifications</th><th>Coverage</th><th></th></tr></thead>
                            <tbody>
                                {everyone.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.name}<div className="muted" style={{ fontSize: "13px" }}>{p.roles.join(", ") || p.username}</div></td>
                                        <td>{cell(p.readiness)}</td>
                                        <td>{cell(p.knowledge)}</td>
                                        <td>{p.qualificationsAssigned ? cell(p.qualificationScore) : <span className="muted">None</span>}</td>
                                        <td>{p.coverage}%</td>
                                        <td style={{ textAlign: "right" }}><button onClick={() => { setUserId(p.id); window.scrollTo(0, 0); }}>Open</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}

function cell(value: number | null) {
    return value === null ? <span className="muted">Not yet</span> : <span className={`badge ${tone(value)}`}>{value}%</span>;
}

function statusLabel(status: string) {
    return ({ CURRENT: "Current", EXPIRING: "Due soon", EXPIRED: "Expired", INCOMPLETE: "Not complete", MISSING: "Not complete", SUSPENDED: "Suspended" } as Record<string, string>)[status] ?? status;
}

function Figure(props: { label: string; value: number | null; hint: string; plain?: boolean }) {
    return (
        <div style={{ minWidth: "150px" }}>
            <div className="eyebrow">{props.label}</div>
            <div className="score" style={{ fontSize: "44px", color: props.value === null ? "var(--slate)" : undefined }}>{props.value === null ? "—" : `${props.value}%`}</div>
            <div className="muted" style={{ fontSize: "13px", marginTop: "6px", maxWidth: "190px" }}>{props.hint}</div>
        </div>
    );
}
