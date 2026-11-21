import { useState } from "react";
import LoginForm from "./LoginForm";
import ChangePasswordForm from "../users/ChangePasswordForm";

interface Props {
    onLoginSuccess: (username: string, sessionTimeoutMinutes: number) => void;
    // Shown above the form, for example after an idle sign-out.
    notice?: string;
}

export default function LoginPage(props: Props) {
    const [message, setMessage] = useState("");
    const [loggedIn, setLoggedIn] = useState(false);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    // Set when the account must choose a new password before going on.
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [timeoutMinutes, setTimeoutMinutes] = useState(30);

    async function login(username: string, password: string) {
        const result = await window.hsusa.login(username, password);
        setMessage(result.message);

        if (result.success) {
            const minutes = Number(result.sessionTimeoutMinutes) || 30;
            setTimeoutMinutes(minutes);
            setCurrentUserName(result.user?.username ?? username);
            if (result.mustChangePassword) {
                setMustChangePassword(true);
                return;
            }
            setLoggedIn(true);
            props.onLoginSuccess(result.user?.username ?? username, minutes);
        }
    }

    async function changePassword(newPassword: string, currentPassword: string) {
        const result = await window.hsusa.changeOwnPassword(currentPassword, newPassword);
        if (!result.success) return result.message ?? "Unable to change password.";
        setMustChangePassword(false);
        setMessage("");
        setLoggedIn(true);
        props.onLoginSuccess(currentUserName ?? "", timeoutMinutes);
        return null;
    }

    async function cancelPasswordChange() {
        await window.hsusa.logout?.();
        setMustChangePassword(false);
        setCurrentUserName(null);
        setMessage("Sign-in cancelled. You must choose a new password to continue.");
    }

    function logout() {
        setLoggedIn(false);
        setCurrentUserName(null);
        setMessage("");
    }

    if (mustChangePassword) {
        return (
            <ChangePasswordForm
                title="Choose a New Password"
                intro={`Welcome, ${currentUserName}. Before you continue, replace the temporary password with one only you know.`}
                requireCurrentPassword
                onChange={changePassword}
                onCancel={() => void cancelPasswordChange()}
                cancelLabel="Sign Out"
            />
        );
    }

    if (loggedIn) {
        // The app shell (App.tsx) takes over once onLoginSuccess has run.
        return null;
    }

    return (
        <div className="signin">
            <section className="signin-brand" aria-label="About">
                <div className="brand">
                    <div className="brand-name">HSUSA <span>TMS</span></div>
                    <div className="brand-sub">Training Management System</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div className="signin-stripe" aria-hidden="true"><span></span><span></span></div>
                    <h1>Every crew member current. Every record ready.</h1>
                    <p>Qualifications, recurrent training and knowledge checks for offshore, HEMS and maintenance crews, in one place.</p>
                </div>
                <div className="signin-foot">HeliService USA · North Kingstown, Rhode Island</div>
            </section>
            <main className="signin-main">
                <LoginForm onLogin={login} message={message} notice={message ? undefined : props.notice} />
            </main>
        </div>
    );
}
