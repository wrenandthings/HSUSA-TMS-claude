import { useState } from "react";

interface Props {
    onLogin: (username: string, password: string) => void;
    message?: string;
}

// A real form, so Enter signs in from either field.
export default function LoginForm(props: Props) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    return (
        <form
            className="signin-form"
            onSubmit={(event) => {
                event.preventDefault();
                props.onLogin(username, password);
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <h2>Sign in</h2>
                <p className="hint">Use the username your administrator gave you.</p>
            </div>
            <label className="field">
                Username
                <input autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="field">
                Password
                <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {props.message && <div className="signin-error" role="alert">{props.message}</div>}
            <button type="submit" className="primary">Sign in</button>
            <p className="hint">Forgot your password? Ask your administrator to set a temporary one. You'll choose your own when you next sign in.</p>
        </form>
    );
}
