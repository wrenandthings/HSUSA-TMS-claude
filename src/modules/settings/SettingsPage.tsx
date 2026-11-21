import { useEffect, useState } from "react";

interface Setting {
    key: string;
    group: string;
    label: string;
    kind: "boolean" | "integer";
    min?: number;
    max?: number;
    unit?: string;
    value: string;
}

interface Props {
    // Lets the app apply a new idle sign-out time straight away.
    onTimeoutChanged: (minutes: number) => void;
}

// Administrators change settings here; everyone else sees them read-only.
export default function SettingsPage(props: Props) {
    const [settings, setSettings] = useState<Setting[]>([]);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [canEdit, setCanEdit] = useState(false);
    const [message, setMessage] = useState("");
    const [problem, setProblem] = useState("");
    const [saving, setSaving] = useState(false);

    function show(list: Setting[]) {
        setSettings(list);
        setDraft(Object.fromEntries(list.map((s) => [s.key, s.value])));
    }

    useEffect(() => {
        void (async () => {
            const result = await window.hsusa.getSettings();
            if (!result?.success) { setProblem(result?.message ?? "Unable to load settings."); return; }
            setCanEdit(Boolean(result.canEdit));
            show(result.settings);
        })();
    }, []);

    const changed = settings.filter((s) => draft[s.key] !== s.value);

    async function save() {
        setSaving(true);
        setMessage("");
        setProblem("");
        try {
            const result = await window.hsusa.saveSettings(Object.fromEntries(changed.map((s) => [s.key, draft[s.key]])));
            if (!result?.success) { setProblem(result?.message ?? "Unable to save settings."); return; }
            show(result.settings);
            setMessage(result.message);
            const timeout = result.settings.find((s: Setting) => s.key === "SessionTimeoutMinutes");
            if (timeout) props.onTimeoutChanged(Number(timeout.value));
        } finally {
            setSaving(false);
        }
    }

    const groups = [...new Set(settings.map((s) => s.group))];

    return (
        <div style={{ padding: "40px", maxWidth: "820px" }}>
            <h1>Settings</h1>
            {!canEdit && settings.length > 0 && (
                <p style={{ color: "var(--slate)", marginTop: "-6px" }}>Only an administrator can change these settings.</p>
            )}
            {problem && <p role="alert" style={{ color: "var(--red-dark)", fontWeight: 600 }}>{problem}</p>}
            {message && <p role="status" style={{ color: "var(--green-dark)", fontWeight: 600 }}>{message}</p>}

            {groups.map((group) => (
                <section key={group} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "8px 20px", marginBottom: "16px" }}>
                    <h2 style={{ fontSize: "17px", margin: "12px 0 4px" }}>{group}</h2>
                    {settings.filter((s) => s.group === group).map((s) => (
                        <div key={s.key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "12px 0", borderTop: "1px solid var(--line-soft)" }}>
                            <label htmlFor={`setting-${s.key}`} style={{ flex: "1 1 320px" }}>{s.label}</label>
                            {s.kind === "boolean" ? (
                                <input
                                    id={`setting-${s.key}`}
                                    type="checkbox"
                                    disabled={!canEdit}
                                    checked={draft[s.key] === "TRUE"}
                                    onChange={(e) => setDraft({ ...draft, [s.key]: e.target.checked ? "TRUE" : "FALSE" })}
                                />
                            ) : (
                                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <input
                                        id={`setting-${s.key}`}
                                        inputMode="numeric"
                                        disabled={!canEdit}
                                        value={draft[s.key] ?? ""}
                                        onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                                        style={{ width: "96px", textAlign: "right" }}
                                        aria-describedby={`setting-${s.key}-range`}
                                    />
                                    <span id={`setting-${s.key}-range`} style={{ color: "var(--slate)", fontSize: "13px", minWidth: "150px" }}>
                                        {s.unit} ({s.min}–{s.max})
                                    </span>
                                </span>
                            )}
                        </div>
                    ))}
                </section>
            ))}

            {canEdit && (
                <div style={{ display: "flex", gap: "8px" }}>
                    <button className="primary" disabled={changed.length === 0 || saving} onClick={() => void save()}>
                        {saving ? "Saving..." : changed.length > 1 ? `Save ${changed.length} changes` : "Save changes"}
                    </button>
                    <button disabled={changed.length === 0 || saving} onClick={() => { show(settings); setProblem(""); }}>Undo changes</button>
                </div>
            )}
        </div>
    );
}
