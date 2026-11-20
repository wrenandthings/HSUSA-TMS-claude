import { useState } from "react";
import LoginForm from "./LoginForm";
import MainMenu from "./MainMenu";
import ChangePasswordForm from "../users/ChangePasswordForm";

interface Props {
    onLoginSuccess: () => void;
}

export default function LoginPage(props: Props) {
    const [message, setMessage] = useState("");
    const [loggedIn, setLoggedIn] = useState(false);
    const [currentUserName, setCurrentUserName] = useState<string | null>(null);
    // Set when the account must choose a new password before going on.
    const [mustChangePassword, setMustChangePassword] = useState(false);

    async function login(username: string, password: string) {
        const result = await window.hsusa.login(username, password);
        setMessage(result.message);

        if (result.success) {
            setCurrentUserName(result.user?.username ?? username);
            if (result.mustChangePassword) {
                setMustChangePassword(true);
                return;
            }
            setLoggedIn(true);
            props.onLoginSuccess();
        }
    }

    async function changePassword(newPassword: string, currentPassword: string) {
        const result = await window.hsusa.changeOwnPassword(currentPassword, newPassword);
        if (!result.success) return result.message ?? "Unable to change password.";
        setMustChangePassword(false);
        setMessage("");
        setLoggedIn(true);
        props.onLoginSuccess();
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
        return <MainMenu onLogout={logout} currentUserName={currentUserName} />;
    }

    return (
        <div style={{ padding: "40px" }}>
            <h1>HSUSA TMS</h1>
            <h2>Login</h2>
            <LoginForm onLogin={login} />
            {message && <div style={{ marginTop: 12 }}>{message}</div>}
        </div>
    );
}
