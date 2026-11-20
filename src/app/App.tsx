import { useState } from "react";
import LoginPage from "../modules/auth/LoginPage";
import UserListPage from "../modules/users/UserListPage";
import RoleListPage from "../modules/roles/RoleListPage";
import SubjectListPage from "../modules/subjects/SubjectListPage";
import QuestionListPage from "../modules/question/QuestionListPage";
import QualificationListPage from "../modules/qualifications/QualificationListPage";

type Section = "home" | "qualifications" | "questions" | "subjects" | "users" | "roles";

// The sidebar, in the order of the approved design (2026-11-20).
const SECTIONS: { id: Section; label: string; description: string }[] = [
    { id: "home", label: "Home", description: "" },
    { id: "qualifications", label: "Qualifications", description: "Who holds what, when it expires, and the history of every change." },
    { id: "questions", label: "Question Bank", description: "Questions by subject, with answers and manual references. Import banks from CSV." },
    { id: "subjects", label: "Subjects", description: "The subjects questions belong to, such as MAINT or OMA." },
    { id: "users", label: "Users", description: "Accounts, roles, temporary passwords and each person's qualifications." },
    { id: "roles", label: "Roles", description: "The roles that decide what each person may change." }
];

export default function App() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [section, setSection] = useState<Section>("home");
    // Changing this remounts the page, so clicking its sidebar item again
    // returns to the top of that section (out of a detail or edit view).
    const [visit, setVisit] = useState(0);
    const goHome = () => open("home");

    function open(next: Section) {
        setSection(next);
        setVisit((count) => count + 1);
    }

    // Clears the main-process session too, so permission checks see nobody.
    async function signOut() {
        await window.hsusa.logout?.();
        setSection("home");
        setUsername("");
        setLoggedIn(false);
    }

    if (!loggedIn) return <LoginPage onLoginSuccess={(name) => { setUsername(name); setLoggedIn(true); }} />;

    let page;
    if (section === "users") page = <UserListPage key={visit} onBack={goHome} />;
    else if (section === "roles") page = <RoleListPage key={visit} onBack={goHome} />;
    else if (section === "subjects") page = <SubjectListPage key={visit} onBack={goHome} />;
    else if (section === "questions") page = <QuestionListPage key={visit} onBack={goHome} />;
    else if (section === "qualifications") page = <QualificationListPage key={visit} onBack={goHome} />;
    else page = <Home username={username} onOpen={open} />;

    return (
        <div className="app-shell">
            <nav className="sidebar" aria-label="Main">
                <div className="brand">
                    <div className="brand-name">HSUSA <span>TMS</span></div>
                    <div className="brand-sub">Training Management</div>
                    <div className="brand-stripe" aria-hidden="true"><span></span><span></span></div>
                </div>
                <div className="nav">
                    {SECTIONS.map((item) => (
                        <button
                            key={item.id}
                            aria-current={section === item.id ? "page" : undefined}
                            onClick={() => open(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="account">
                    <div className="avatar" aria-hidden="true">{username.slice(0, 2)}</div>
                    <div>
                        <div className="account-name">{username}</div>
                        <button className="link" onClick={() => void signOut()}>Sign out</button>
                    </div>
                </div>
            </nav>
            <main className="content">
                <div className="stripe" aria-hidden="true"><span></span><span></span></div>
                {page}
            </main>
        </div>
    );
}

function Home(props: { username: string; onOpen: (section: Section) => void }) {
    const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return (
        <div className="home">
            <div>
                <h1>Welcome, {props.username}</h1>
                <div className="home-sub">{today}</div>
            </div>
            <div className="cards">
                {SECTIONS.filter((item) => item.id !== "home").map((item) => (
                    <button key={item.id} className="card" onClick={() => props.onOpen(item.id)}>
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
