import { useState } from "react";

interface Props {
    // Returns an error message to show, or nothing on success.
    onCreate: (code: string, subjectName: string, description: string) => Promise<string | null | void>;
    onCancel: () => void;
}

export default function CreateSubjectForm(props: Props) {
    const [code, setCode] = useState("");
    const [subjectName, setSubjectName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function save() {
        setSaving(true);
        setError("");
        try {
            const problem = await props.onCreate(code, subjectName, description);
            if (problem) setError(problem);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            <h2>Create Subject</h2>
            {error && <p style={{ color: "darkred" }}>{error}</p>}
            <div>
                <label>
                    Code (for example MAINT)<br />
                    <input value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
            </div>
            <br />
            <div>
                <label>
                    Subject Name<br />
                    <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
                </label>
            </div>
            <br />
            <div>
                <label>
                    Description<br />
                    <input value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
            </div>
            <br />
            <button className="primary" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Subject"}</button>
            <button disabled={saving} onClick={() => props.onCancel()} style={{ marginLeft: "10px" }}>Cancel</button>
        </div>
    );
}
