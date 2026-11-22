import { useEffect, useRef, useState } from "react";
import LoginPage from "../modules/auth/LoginPage";
import UserListPage from "../modules/users/UserListPage";
import RoleListPage from "../modules/roles/RoleListPage";
import SubjectListPage from "../modules/subjects/SubjectListPage";
import QuestionListPage from "../modules/question/QuestionListPage";
import QualificationListPage from "../modules/qualifications/QualificationListPage";
import SettingsPage from "../modules/settings/SettingsPage";
import QuizzesPage from "../modules/quizzes/QuizzesPage";
import MyTrainingPage from "../modules/training/MyTrainingPage";
import ApprovalsPage from "../modules/training/ApprovalsPage";
import RequirementsPage from "../modules/training/RequirementsPage";

type Section = "home" | "training" | "approvals" | "requirements" | "quizzes" | "qualifications" | "questions" | "subjects" | "users" | "roles" | "settings";

// The sidebar, in the order of the approved design (2026-11-20).
const SECTIONS: { id: Section; label: string; description: string }[] = [
    { id: "home", label: "Home", description: "" },
    { id: "training", label: "My training", description: "What each of your qualifications needs, when it is due, and your recorded training." },
    { id: "approvals", label: "Approvals", description: "Training people have recorded, waiting for a manager to approve." },
    { id: "requirements", label: "Requirements", description: "What each qualification needs and how often each training repeats." },
    { id: "quizzes", label: "Quizzes", description: "Practice by subject or manual, find your weak areas, or take a certification quiz." },
    { id: "qualifications", label: "Qualifications", description: "Who holds what, when it expires, and the history of every change." },
    { id: "questions", label: "Question Bank", description: "Questions by subject, with answers and manual references. Import banks from CSV." },
    { id: "subjects", label: "Subjects", description: "The subjects questions belong to, such as MAINT or OMA." },
    { id: "users", label: "Users", description: "Accounts, roles, temporary passwords and each person's qualifications." },
    { id: "roles", label: "Roles", description: "The roles that decide what each person may change." },
    { id: "settings", label: "Settings", description: "Sign-out time, password rules, alerts and record keeping. Administrators can change them." }
];

export default function App() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [section, setSection] = useState<Section>("home");
    // Changing this remounts the page, so clicking its sidebar item again
    // returns to the top of that section (out of a detail or edit view).
    const [visit, setVisit] = useState(0);
    const [timeoutMinutes, setTimeoutMinutes] = useState(30);
    const [notice, setNotice] = useState("");
    useIdleSignOut(loggedIn, timeoutMinutes, () => void signOut("idle"));
    const goHome = () => open("home");
    // Managers see Approvals, with a count of records waiting.
    const [canApprove, setCanApprove] = useState(false);
    const [canEditRequirements, setCanEditRequirements] = useState(false);
    const [waiting, setWaiting] = useState(0);
    async function refreshTraining() {
        const result = await window.hsusa.myTraining?.();
        setCanApprove(Boolean(result?.canApprove));
        setCanEditRequirements(Boolean(result?.canEditRequirements));
        setWaiting(result?.pendingToReview ?? 0);
    }
    useEffect(() => { if (loggedIn) void refreshTraining(); }, [loggedIn, section]);
    const visible = SECTIONS.filter((item) => (item.id !== "approvals" || canApprove) && (item.id !== "requirements" || canEditRequirements));

    function open(next: Section) {
        setSection(next);
        setVisit((count) => count + 1);
    }

    // Clears the main-process session too, so permission checks see nobody.
    async function signOut(reason?: "idle") {
        await window.hsusa.logout?.(reason ? { reason } : undefined);
        setNotice(reason === "idle"
            ? `You were signed out after ${timeoutMinutes} minutes without activity. Sign in again to continue.`
            : "");
        setSection("home");
        setUsername("");
        setLoggedIn(false);
    }

    if (!loggedIn) {
        return (
            <LoginPage
                notice={notice}
                onLoginSuccess={(name, minutes) => { setUsername(name); setTimeoutMinutes(minutes); setNotice(""); setLoggedIn(true); }}
            />
        );
    }

    let page;
    if (section === "users") page = <UserListPage key={visit} onBack={goHome} />;
    else if (section === "roles") page = <RoleListPage key={visit} onBack={goHome} />;
    else if (section === "subjects") page = <SubjectListPage key={visit} onBack={goHome} />;
    else if (section === "questions") page = <QuestionListPage key={visit} onBack={goHome} />;
    else if (section === "qualifications") page = <QualificationListPage key={visit} onBack={goHome} />;
    else if (section === "quizzes") page = <QuizzesPage key={visit} />;
    else if (section === "requirements") page = <RequirementsPage key={visit} />;
    else if (section === "training") page = <MyTrainingPage key={visit} />;
    else if (section === "approvals") page = <ApprovalsPage key={visit} onChanged={() => void refreshTraining()} />;
    else if (section === "settings") page = <SettingsPage key={visit} onTimeoutChanged={setTimeoutMinutes} />;
    else page = <Home username={username} sections={visible} onOpen={open} />;

    return (
        <div className="app-shell">
            <nav className="sidebar" aria-label="Main">
                <div className="brand">
                    <div className="brand-name">HSUSA <span>TMS</span></div>
                    <div className="brand-sub">Training Management</div>
                    <div className="brand-stripe" aria-hidden="true"><span></span><span></span></div>
                </div>
                <div className="nav">
                    {visible.map((item) => (
                        <button
                            key={item.id}
                            aria-current={section === item.id ? "page" : undefined}
                            onClick={() => open(item.id)}
                        >
                            {item.label}
                            {item.id === "approvals" && waiting > 0 && <span className="nav-count" aria-label={`${waiting} waiting`}>{waiting}</span>}
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

function Home(props: { username: string; sections: typeof SECTIONS; onOpen: (section: Section) => void }) {
    const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return (
        <div className="home">
            <div>
                <h1>Welcome, {props.username}</h1>
                <div className="home-sub">{today}</div>
            </div>
            <div className="cards">
                {props.sections.filter((item) => item.id !== "home").map((item) => (
                    <button key={item.id} className="card" onClick={() => props.onOpen(item.id)}>
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Signs out after `minutes` with no mouse, keyboard, scroll or touch activity
// (owner decision, question 18: admin-adjustable, default 30 minutes).
function useIdleSignOut(active: boolean, minutes: number, onIdle: () => void) {
    const onIdleRef = useRef(onIdle);
    onIdleRef.current = onIdle;

    useEffect(() => {
        if (!active) return;
        const limit = Math.max(1, minutes) * 60 * 1000;
        let timer = window.setTimeout(() => onIdleRef.current(), limit);
        const restart = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => onIdleRef.current(), limit);
        };
        const events = ["mousemove", "mousedown", "keydown", "wheel", "touchstart"];
        events.forEach((name) => window.addEventListener(name, restart, { passive: true }));
        return () => {
            window.clearTimeout(timer);
            events.forEach((name) => window.removeEventListener(name, restart));
        };
    }, [active, minutes]);
}
