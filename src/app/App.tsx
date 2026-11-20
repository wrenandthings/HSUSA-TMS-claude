import { useState } from "react";
import LoginPage from "../modules/auth/LoginPage";
import UserListPage from "../modules/users/UserListPage";
import RoleListPage from "../modules/roles/RoleListPage";
import SubjectListPage from "../modules/subjects/SubjectListPage";
import QuestionListPage from "../modules/question/QuestionListPage";
import QualificationListPage from "../modules/qualifications/QualificationListPage";

export default function App() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [selectedModule, setSelectedModule] = useState("");
    const backToMenu = () => setSelectedModule("");

    // Clears the main-process session too, so permission checks see nobody.
    async function signOut() {
        await window.hsusa.logout?.();
        setSelectedModule("");
        setUsername("");
        setLoggedIn(false);
    }

    if (!loggedIn) return <LoginPage onLoginSuccess={(name) => { setUsername(name); setLoggedIn(true); }} />;
    if (selectedModule === "users") return <UserListPage onBack={backToMenu} />;
    if (selectedModule === "roles") return <RoleListPage onBack={backToMenu} />;
    if (selectedModule === "subjects") return <SubjectListPage onBack={backToMenu} />;
    if (selectedModule === "questions") return <QuestionListPage onBack={backToMenu} />;
    if (selectedModule === "qualifications") return <QualificationListPage onBack={backToMenu} />;

    return (
        <main style={{ padding: "40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0 }}>HSUSA Training Management System</h1>
                <div>
                    {username && <span style={{ marginRight: "12px" }}>Signed in as {username}</span>}
                    <button onClick={() => void signOut()}>Sign Out</button>
                </div>
            </div>
            <h2>Main Menu</h2>
            <button onClick={() => setSelectedModule("users")}>Users</button><br /><br />
            <button onClick={() => setSelectedModule("roles")}>Roles</button><br /><br />
            <button onClick={() => setSelectedModule("subjects")}>Subjects</button><br /><br />
            <button onClick={() => setSelectedModule("questions")}>Question Bank</button><br /><br />
            <button onClick={() => setSelectedModule("qualifications")}>Qualifications</button>
        </main>
    );
}
