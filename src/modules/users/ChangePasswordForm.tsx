import { useEffect, useState } from "react";

// The password rules in words, as an administrator set them in Settings.
export function usePasswordRulesText(): string {
    const [text, setText] = useState("");
    useEffect(() => {
        let live = true;
        Promise.resolve(window.hsusa.passwordRules?.())
            .then((result) => { if (live && result?.success) setText(result.text); })
            .catch(() => undefined);
        return () => { live = false; };
    }, []);
    return text;
}

interface Props {
    title?: string;
    intro?: string;
    // Ask for the current password too (when users change their own).
    requireCurrentPassword?: boolean;
    // Returns an error message to show, or nothing on success.
    onChange: (newPassword: string, currentPassword: string) => Promise<string | null | void> | string | null | void;
    onCancel?: () => void;
    cancelLabel?: string;
}

export default function ChangePasswordForm(props: Props) {
    const [current, setCurrent] = useState("");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const rulesText = usePasswordRulesText();

    async function submit() {
        if (props.requireCurrentPassword && !current) {
            setError("Enter your current password.");
            return;
        }
        if (!password) {
            setError("Password is required.");
            return;
        }
        if (password !== confirmation) {
            setError("Passwords do not match.");
            return;
        }
        setSaving(true);
        try {
            const problem = await props.onChange(password, current);
            setError(problem || "");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to change password.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ padding: "40px" }}>
            <h2>{props.title ?? "Change Password"}</h2>
            {props.intro && <p>{props.intro}</p>}
            {props.requireCurrentPassword && (
                <><label>Current Password<br /><input type="password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} /></label><br /><br /></>
            )}
            <label>New Password<br /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><br />
            <small>{rulesText}</small><br /><br />
            <label>Confirm Password<br /><input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label><br /><br />
            {error && <p style={{ color: "darkred" }}>{error}</p>}
            <button className="primary" onClick={() => void submit()} disabled={saving}>Save Password</button>
            {props.onCancel && <button onClick={props.onCancel} style={{ marginLeft: "10px" }}>{props.cancelLabel ?? "Cancel"}</button>}
        </div>
    );
}
