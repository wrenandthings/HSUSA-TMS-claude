import { useEffect, useState } from "react";

// Requirements (owner decision 2026-11-21): the Training Manager or an
// Administrator sets what each qualification needs and how often each
// training repeats. A qualification is current only while all of it is.

interface Item { type: "TRAINING" | "QUALIFICATION"; ref: string; }

export default function RequirementsPage() {
    const [data, setData] = useState<any>(null);
    const [problem, setProblem] = useState("");
    const [message, setMessage] = useState("");
    const [selected, setSelected] = useState("");
    const [items, setItems] = useState<Item[]>([]);
    const [adding, setAdding] = useState("");
    const [saving, setSaving] = useState(false);

    async function load(keep?: string) {
        const result = await window.hsusa.getRequirements();
        if (!result?.success) { setProblem(result?.message ?? "Unable to load requirements."); return; }
        setData(result);
        const id = keep || selected || result.qualifications[0]?.id || "";
        choose(id, result);
    }
    useEffect(() => { void load(); }, []);

    function choose(id: string, source = data) {
        setSelected(id);
        setItems(source?.qualifications.find((q: any) => q.id === id)?.requirements ?? []);
        setAdding("");
        setMessage("");
        setProblem("");
    }

    if (!data) return <div className="page">{problem ? <p className="message-error" role="alert">{problem}</p> : <p className="muted">Loading...</p>}</div>;

    const qualification = data.qualifications.find((q: any) => q.id === selected);
    const programByCode = new Map<string, any>(data.programs.map((p: any) => [p.code, p]));
    const nameOf = (item: Item) => item.type === "TRAINING" ? programByCode.get(item.ref)?.name ?? item.ref : data.qualifications.find((q: any) => q.code === item.ref)?.name ?? item.ref;
    const saved = JSON.stringify([...(qualification?.requirements ?? [])].map((i: Item) => `${i.type}:${i.ref}`).sort());
    const changed = saved !== JSON.stringify(items.map((i) => `${i.type}:${i.ref}`).sort());
    const has = (type: string, ref: string) => items.some((i) => i.type === type && i.ref === ref);
    const categories = [...new Set<string>(data.programs.map((p: any) => p.category))];
    // Qualifications that already need this one (directly or not) would make a loop.
    const needs = new Map<string, string[]>(data.qualifications.map((q: any) => [q.code, q.requirements.filter((r: Item) => r.type === "QUALIFICATION").map((r: Item) => r.ref)]));
    const reaches = (code: string, target: string, seen = new Set<string>()): boolean =>
        code === target || (!seen.has(code) && (seen.add(code), (needs.get(code) ?? []).some((ref) => reaches(ref, target, seen))));
    const canAdd = (q: any) => q.id !== selected && !has("QUALIFICATION", q.code) && !reaches(q.code, qualification?.code ?? "");

    function add() {
        if (!adding) return;
        const [type, ref] = adding.split("|") as [Item["type"], string];
        if (!has(type, ref)) setItems([...items, { type, ref }]);
        setAdding("");
    }

    async function save() {
        setSaving(true);
        setProblem("");
        setMessage("");
        try {
            const result = await window.hsusa.setRequirements(selected, items);
            if (result?.success) { setMessage(result.message); await load(selected); setMessage(result.message); }
            else setProblem(result?.message ?? "Unable to save.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="page page-narrow">
            <h1 style={{ margin: 0 }}>Requirements</h1>
            <p className="muted" style={{ margin: 0 }}>A qualification is current only while everything it needs is current.</p>

            <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="quiz-filters">
                    <label>
                        Qualification
                        <select value={selected} onChange={(e) => choose(e.target.value)}>
                            {data.qualifications.map((q: any) => <option key={q.id} value={q.id}>{q.name}</option>)}
                        </select>
                    </label>
                </div>

                {items.length === 0 ? <p className="muted" style={{ margin: 0 }}>This qualification needs nothing yet.</p> : (
                    <table style={{ width: "100%", border: "none" }}>
                        <thead><tr><th>Needs</th><th>Repeats</th><th></th></tr></thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={`${item.type}:${item.ref}`}>
                                    <td>{nameOf(item)}{item.type === "QUALIFICATION" && <span className="muted"> (qualification)</span>}</td>
                                    <td>{item.type === "TRAINING" ? repeats(programByCode.get(item.ref)?.renewalMonths) : <span className="muted">Its own requirements</span>}</td>
                                    <td style={{ textAlign: "right" }}>
                                        <button onClick={() => setItems(items.filter((i) => i !== item))}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 600, fontSize: "14px" }}>
                        Add
                        <select value={adding} onChange={(e) => setAdding(e.target.value)}>
                            <option value="">Choose...</option>
                            {categories.map((c) => (
                                <optgroup key={c} label={`Training: ${c}`}>
                                    {data.programs.filter((p: any) => p.category === c && !has("TRAINING", p.code)).map((p: any) => <option key={p.code} value={`TRAINING|${p.code}`}>{p.name}</option>)}
                                </optgroup>
                            ))}
                            <optgroup label="Another qualification">
                                {data.qualifications.filter(canAdd).map((q: any) => <option key={q.code} value={`QUALIFICATION|${q.code}`}>{q.name}</option>)}
                            </optgroup>
                        </select>
                    </label>
                    <button disabled={!adding} onClick={add}>Add</button>
                </div>

                {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}
                {message && <p className="badge good" role="status" style={{ margin: 0, alignSelf: "flex-start" }}>{message}</p>}
                <div style={{ display: "flex", gap: "8px" }}>
                    <button className="primary" disabled={!changed || saving} onClick={() => void save()}>{saving ? "Saving..." : "Save requirements"}</button>
                    {changed && <button onClick={() => choose(selected)}>Undo changes</button>}
                </div>
            </section>

            <RenewalPanel programs={data.programs} onSaved={() => void load(selected)} />
        </div>
    );
}

function repeats(months: number | null | undefined) {
    if (months == null) return "Once";
    return months % 12 === 0 ? `Every ${months / 12 === 1 ? "year" : `${months / 12} years`}` : `Every ${months} months`;
}

function RenewalPanel(props: { programs: any[]; onSaved: () => void }) {
    const [editing, setEditing] = useState<string | null>(null);
    const [value, setValue] = useState("");
    const [problem, setProblem] = useState("");

    async function save(program: any) {
        const result = await window.hsusa.setTrainingRenewal(program.id, value.trim());
        if (result?.success) { setEditing(null); setProblem(""); props.onSaved(); }
        else setProblem(result?.message ?? "Unable to save.");
    }

    return (
        <section className="panel" style={{ padding: "8px 0 0" }}>
            <h2 style={{ margin: "12px 24px 4px" }}>How often training repeats</h2>
            <p className="muted" style={{ margin: "0 24px 12px" }}>Due at the end of the month, with one more month of grace.</p>
            {problem && <p className="message-error" role="alert" style={{ margin: "0 24px 12px" }}>{problem}</p>}
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", border: "none" }}>
                    <thead><tr><th>Training</th><th>Group</th><th>Repeats</th><th></th></tr></thead>
                    <tbody>
                        {props.programs.map((p) => (
                            <tr key={p.id}>
                                <td>{p.name}{p.description && <div className="muted" style={{ fontSize: "13px" }}>{p.description}</div>}</td>
                                <td>{p.category}</td>
                                <td>
                                    {editing === p.id ? (
                                        <span style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                                            <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: "64px" }} aria-label="Months" />
                                            <span className="muted">months (blank = once)</span>
                                        </span>
                                    ) : repeats(p.renewalMonths)}
                                </td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                    {editing === p.id ? (
                                        <span style={{ display: "inline-flex", gap: "6px" }}>
                                            <button className="primary" onClick={() => void save(p)}>Save</button>
                                            <button onClick={() => { setEditing(null); setProblem(""); }}>Cancel</button>
                                        </span>
                                    ) : <button onClick={() => { setEditing(p.id); setValue(p.renewalMonths == null ? "" : String(p.renewalMonths)); setProblem(""); }}>Change</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
