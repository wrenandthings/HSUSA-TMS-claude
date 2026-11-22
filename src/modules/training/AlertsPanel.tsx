import { useEffect, useState } from "react";
import { day } from "./trainingLabels";

// Home page alerts (owner decision Q23): 90/60/30/7 days before a due date,
// set in Settings, plus anything expired, in grace or not done.

const LEVEL: Record<string, { tone: string; text: (a: any) => string }> = {
    EXPIRED: { tone: "bad", text: () => "Expired" },
    GRACE: { tone: "bad", text: (a) => `Overdue, grace until ${day(a.graceEnd)}` },
    MISSING: { tone: "bad", text: (a) => a.waiting ? "Waiting for approval" : "Not done" },
    DUE_7: { tone: "bad", text: (a) => dueIn(a.daysLeft) },
    DUE_30: { tone: "warn", text: (a) => dueIn(a.daysLeft) },
    DUE_SOON: { tone: "", text: (a) => dueIn(a.daysLeft) }
};

function dueIn(days: number) {
    return days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

export default function AlertsPanel(props: { onOpenTraining: () => void }) {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        void (async () => {
            const result = await window.hsusa.trainingAlerts?.();
            if (result?.success) setData(result);
        })();
    }, []);

    if (!data) return null;
    return (
        <>
            <section className="panel" style={{ padding: "8px 0 0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 24px" }}>
                    <h2 style={{ margin: 0 }}>Your training</h2>
                    <button onClick={props.onOpenTraining}>Open My training</button>
                </div>
                {data.mine.length === 0
                    ? <p className="muted" style={{ margin: "0 24px 20px" }}>Nothing due in the next {data.windowDays} days.</p>
                    : <AlertTable rows={data.mine} showPerson={false} />}
            </section>
            {data.team && (
                <section className="panel" style={{ padding: "8px 0 0" }}>
                    <h2 style={{ margin: "12px 24px" }}>Everyone else</h2>
                    {data.team.length === 0
                        ? <p className="muted" style={{ margin: "0 24px 20px" }}>Nobody has training due in the next {data.windowDays} days.</p>
                        : <AlertTable rows={data.team} showPerson={true} />}
                </section>
            )}
        </>
    );
}

function AlertTable(props: { rows: any[]; showPerson: boolean }) {
    const [all, setAll] = useState(false);
    const rows = all ? props.rows : props.rows.slice(0, 8);
    return (
        <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", border: "none" }}>
                <thead><tr>{props.showPerson && <th>Person</th>}<th>Training</th><th>For</th><th>Status</th><th>Due</th></tr></thead>
                <tbody>
                    {rows.map((a, i) => (
                        <tr key={`${a.person.id}:${a.qualificationCode}:${a.programCode}:${i}`}>
                            {props.showPerson && <td>{a.person.name}</td>}
                            <td>{a.training}</td>
                            <td>{a.qualification}</td>
                            <td><span className={`badge ${LEVEL[a.level].tone}`}>{LEVEL[a.level].text(a)}</span></td>
                            <td>{day(a.dueDate)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {props.rows.length > 8 && (
                <div style={{ margin: "8px 24px 16px" }}>
                    <button onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${props.rows.length}`}</button>
                </div>
            )}
        </div>
    );
}
