import { useEffect, useState } from "react";

// Flashcards (Phase 5; UI spec FLASH-001 dashboard, FLASH-002 review).

type Mode = "SUBJECT" | "WEAK_AREA";
const MODES: { id: Mode; title: string; text: string }[] = [
    { id: "SUBJECT", title: "By subject or manual", text: "Cards you missed come first, then unsure, then new ones." },
    { id: "WEAK_AREA", title: "Weak areas", text: "Cards you marked Missed or Unsure, and questions you missed in quizzes." }
];
const RATINGS = [
    { id: "MISSED", label: "Missed", key: "1", className: "danger" },
    { id: "UNSURE", label: "Unsure", key: "2", className: "" },
    { id: "KNOW_IT", label: "Know it", key: "3", className: "primary" }
] as const;

export default function FlashcardsPage(props: { initialSessionId?: string | null; initialNote?: string }) {
    const [sessionId, setSessionId] = useState<string | null>(props.initialSessionId ?? null);
    const [note, setNote] = useState(props.initialNote ?? "");
    if (sessionId) return <Review sessionId={sessionId} note={note} onLeave={() => { setSessionId(null); setNote(""); }} />;
    return <FlashcardHome onOpen={(id, n) => { setSessionId(id); setNote(n ?? ""); }} />;
}

function FlashcardHome(props: { onOpen: (sessionId: string, note?: string) => void }) {
    const [quizOptions, setQuizOptions] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [retention, setRetention] = useState<any>(null);
    const [mode, setMode] = useState<Mode>("SUBJECT");
    const [subjectId, setSubjectId] = useState("");
    const [documentId, setDocumentId] = useState("");
    const [count, setCount] = useState("");
    const [problem, setProblem] = useState("");
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        void (async () => {
            const [q, o, h, r] = await Promise.all([window.hsusa.quizOptions(), window.hsusa.flashcardOptions(), window.hsusa.flashcardHistory(), window.hsusa.flashcardRetention()]);
            if (q?.success !== false) setQuizOptions(q);
            if (o?.success) setCount(String(o.cardCount));
            if (h?.success) setHistory(h.sessions);
            if (r?.success) setRetention(r);
        })();
    }, []);

    async function start() {
        setStarting(true);
        setProblem("");
        try {
            const result = await window.hsusa.startFlashcards({ mode, subjectId: subjectId || undefined, documentId: documentId || undefined, count: Number(count) });
            if (result?.success) props.onOpen(result.sessionId, result.note);
            else setProblem(result?.message ?? "Unable to start.");
        } finally {
            setStarting(false);
        }
    }

    return (
        <div className="page page-narrow">
            <h1 style={{ margin: 0 }}>Flashcards</h1>
            <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <h2 style={{ margin: 0 }}>Study cards</h2>
                <div className="quiz-types" role="group" aria-label="Flashcard mode">
                    {MODES.map((m) => (
                        <button key={m.id} className="quiz-type" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                            <strong>{m.title}</strong>
                            <span>{m.text}</span>
                        </button>
                    ))}
                </div>
                <div className="quiz-filters">
                    <label>
                        Subject
                        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                            <option value="">All subjects</option>
                            {quizOptions?.subjects?.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.subjectName}</option>)}
                        </select>
                    </label>
                    <label>
                        Manual
                        <select value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                            <option value="">All manuals</option>
                            {quizOptions?.documents?.map((d: any) => <option key={d.id} value={d.id}>{d.code} · {d.title}</option>)}
                        </select>
                    </label>
                    <label>
                        Cards
                        <input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: "96px" }} />
                    </label>
                </div>
                <p className="muted" style={{ margin: 0, fontSize: "14px" }}>To study the questions you missed in a quiz, open its results and choose Make flashcards.</p>
                {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}
                <div><button className="primary" disabled={starting} onClick={() => void start()}>{starting ? "Starting..." : "Start"}</button></div>
            </section>

            <section className="panel" style={{ padding: "8px 0 0" }}>
                <h2 style={{ margin: "12px 24px 4px" }}>What you know</h2>
                {!retention?.overall ? <p className="muted" style={{ margin: "0 24px 20px" }}>Rate some cards to see this.</p> : (
                    <>
                        <p className="muted" style={{ margin: "0 24px 12px" }}>Your latest rating on each card you have studied. Overall: {retention.overall.knowPercent}% known of {retention.overall.reviewed} cards.</p>
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", border: "none" }}>
                                <thead><tr><th>Subject</th><th>Cards studied</th><th>Know it</th><th>Unsure</th><th>Missed</th></tr></thead>
                                <tbody>
                                    {retention.subjects.map((s: any) => (
                                        <tr key={s.code}>
                                            <td>{s.code}<div className="muted" style={{ fontSize: "13px" }}>{s.name}</div></td>
                                            <td>{s.reviewed}</td>
                                            <td><span className={`badge ${s.knowPercent >= 80 ? "good" : s.knowPercent >= 50 ? "warn" : "bad"}`}>{s.knowPercent}%</span> {s.KNOW_IT}</td>
                                            <td>{s.UNSURE}</td>
                                            <td>{s.MISSED}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>

            <section className="panel" style={{ padding: "8px 0 0" }}>
                <h2 style={{ margin: "12px 24px" }}>Your sets</h2>
                {history.length === 0 ? <p className="muted" style={{ margin: "0 24px 20px" }}>No flashcards yet.</p> : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", border: "none" }}>
                            <thead><tr><th>Set</th><th>Started</th><th>Result</th><th></th></tr></thead>
                            <tbody>
                                {history.map((s) => (
                                    <tr key={s.id}>
                                        <td>{s.name}</td>
                                        <td>{new Date(s.startedAt).toLocaleString()}</td>
                                        <td>{s.completedAt
                                            ? <span className="badge good">{s.KNOW_IT} of {s.total} known</span>
                                            : <span className="badge warn">{s.total - s.left} of {s.total} done</span>}</td>
                                        <td style={{ textAlign: "right" }}><button onClick={() => props.onOpen(s.id)}>{s.completedAt ? "Study again" : "Continue"}</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function Review(props: { sessionId: string; note: string; onLeave: () => void }) {
    const [session, setSession] = useState<any>(null);
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [problem, setProblem] = useState("");
    const [finished, setFinished] = useState(false);

    async function load(first = false) {
        const result = await window.hsusa.getFlashcards(props.sessionId);
        if (!result?.success) { setProblem(result?.message ?? "Unable to load."); return; }
        setSession(result.session);
        if (first) {
            const next = result.session.cards.findIndex((c: any) => !c.rating);
            setIndex(next === -1 ? 0 : next);
        }
    }
    useEffect(() => { void load(true); }, [props.sessionId]);

    const card = session?.cards[index];

    async function rate(status: string) {
        if (!card) return;
        const result = await window.hsusa.rateFlashcard(props.sessionId, card.questionId, status);
        if (!result?.success) { setProblem(result?.message ?? "Unable to save."); return; }
        await load();
        setRevealed(false);
        if (index + 1 < session.cards.length) setIndex(index + 1);
        else setFinished(true);
    }

    // Keyboard: Space shows the answer; 1, 2, 3 rate it.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (finished || !card || (e.target as HTMLElement)?.tagName === "INPUT") return;
            if (e.key === " " && !revealed) { e.preventDefault(); setRevealed(true); }
            const r = RATINGS.find((x) => x.key === e.key);
            if (r && revealed) void rate(r.id);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    if (!session) return <div className="page">{problem ? <p className="message-error" role="alert">{problem}</p> : <p className="muted">Loading...</p>}</div>;

    const { counts } = session;
    const done = session.cards.length - counts.left;

    if (finished) {
        return (
            <div className="page page-narrow">
                <div className="eyebrow">Flashcards done</div>
                <h1 style={{ margin: 0, fontSize: "26px" }}>{session.name}</h1>
                <section className="panel" style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                    <div><div className="eyebrow">Know it</div><div style={{ fontSize: "28px", fontWeight: 700 }}>{counts.KNOW_IT}</div></div>
                    <div><div className="eyebrow">Unsure</div><div style={{ fontSize: "28px", fontWeight: 700 }}>{counts.UNSURE}</div></div>
                    <div><div className="eyebrow">Missed</div><div style={{ fontSize: "28px", fontWeight: 700 }}>{counts.MISSED}</div></div>
                    {counts.left > 0 && <div><div className="eyebrow">Not rated</div><div style={{ fontSize: "28px", fontWeight: 700 }}>{counts.left}</div></div>}
                </section>
                <p className="muted" style={{ margin: 0 }}>Cards you marked Missed or Unsure come back first, and in Weak areas.</p>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button className="primary" onClick={() => { setFinished(false); setIndex(0); setRevealed(false); }}>Go through again</button>
                    <button onClick={props.onLeave}>Back to flashcards</button>
                </div>
            </div>
        );
    }

    return (
        <div className="page page-narrow">
            <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                <div>
                    <div className="eyebrow">Flashcards</div>
                    <h1 style={{ margin: 0, fontSize: "26px" }}>{session.name}</h1>
                </div>
                <button onClick={props.onLeave}>Save and exit</button>
            </header>
            {props.note && <div className="message-note">{props.note}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                    <span><strong>Card {index + 1}</strong> of {session.cards.length}</span>
                    <span className="muted">{counts.KNOW_IT} know it · {counts.UNSURE} unsure · {counts.MISSED} missed</span>
                </div>
                <div className="progress" role="progressbar" aria-label="Cards rated" aria-valuemin={0} aria-valuemax={session.cards.length} aria-valuenow={done}>
                    <span style={{ width: `${(done / session.cards.length) * 100}%` }}></span>
                </div>
            </div>

            <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "28px", minHeight: "280px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {card.document && <span className="badge">{card.document}</span>}
                    {card.subject && <span className="badge">{card.subject}</span>}
                    {card.externalId && <span className="badge">{card.externalId}</span>}
                    {card.rating && <span className="badge warn">Last rated: {RATINGS.find((r) => r.id === card.rating)?.label}</span>}
                </div>
                <p className="quiz-question">{card.front}</p>
                {revealed ? (
                    <div className="feedback good">
                        <strong>{card.back}</strong>
                        {card.reference && <span className="ref">Reference: {card.reference}</span>}
                    </div>
                ) : (
                    <div><button className="primary" onClick={() => setRevealed(true)}>Show answer</button> <span className="muted" style={{ fontSize: "13px" }}>or press Space</span></div>
                )}
            </section>

            {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}
            <div className="quiz-footer">
                <button disabled={index === 0} onClick={() => { setIndex(index - 1); setRevealed(false); }}>Previous card</button>
                {revealed && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {RATINGS.map((r) => <button key={r.id} className={r.className} onClick={() => void rate(r.id)}>{r.label} ({r.key})</button>)}
                    </div>
                )}
                <button disabled={index + 1 >= session.cards.length} onClick={() => { setIndex(index + 1); setRevealed(false); }}>Skip</button>
            </div>
        </div>
    );
}
