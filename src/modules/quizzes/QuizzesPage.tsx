import { useEffect, useState } from "react";
import { askToConfirm } from "../../components/askToConfirm";

// Quizzes (UI spec QUIZ-001 to QUIZ-003, approved mockup "Taking a quiz").

type QuizType = "RANDOM" | "WEAK_AREA" | "UNSEEN" | "CERTIFICATION";

const TYPES: { id: QuizType; title: string; text: string }[] = [
    { id: "RANDOM", title: "Random", text: "Random questions. See right or wrong after each one." },
    { id: "WEAK_AREA", title: "Weak areas", text: "Questions you have missed before, the most recent misses first." },
    { id: "UNSEEN", title: "Unseen", text: "Questions you have never answered." },
    { id: "CERTIFICATION", title: "Certification", text: "A full test. No answers shown until you submit." }
];

interface Option { label: string; value: string; text: string; }
interface Item {
    position: number; questionId: string; externalId: string | null; text: string; flagged: boolean;
    options: Option[]; selected: string | null; correct: boolean | null; correctAnswer: string | null;
    reference: string | null; document: string | null; subject: string | null;
}
interface Quiz {
    id: string; name: string; type: QuizType; subjectId: string | null; documentId: string | null;
    practice: boolean; completed: boolean; passMarkPercent: number; scorePercent: number | null; passed: boolean | null;
    questionCount: number; answeredCount: number; correctCount: number; items: Item[];
}

export default function QuizzesPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [note, setNote] = useState("");

    if (sessionId) {
        return <QuizRunner sessionId={sessionId} note={note} onLeave={() => { setSessionId(null); setNote(""); }} onStart={(id, n) => { setSessionId(id); setNote(n); }} />;
    }
    return <QuizHome onOpen={(id, n) => { setSessionId(id); setNote(n ?? ""); }} />;
}

function QuizHome(props: { onOpen: (sessionId: string, note?: string) => void }) {
    const [options, setOptions] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [type, setType] = useState<QuizType>("RANDOM");
    const [subjectId, setSubjectId] = useState("");
    const [documentId, setDocumentId] = useState("");
    const [count, setCount] = useState("");
    const [problem, setProblem] = useState("");
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        void (async () => {
            const [o, h] = await Promise.all([window.hsusa.quizOptions(), window.hsusa.quizHistory()]);
            if (o?.success) { setOptions(o); setCount(String(o.questionCount)); } else setProblem(o?.message ?? "Unable to load quizzes.");
            if (h?.success) setHistory(h.quizzes);
        })();
    }, []);

    async function start() {
        setStarting(true);
        setProblem("");
        try {
            const result = await window.hsusa.startQuiz({ type, subjectId: subjectId || undefined, documentId: documentId || undefined, count: Number(count) });
            if (result?.success) props.onOpen(result.sessionId, result.note ?? "");
            else setProblem(result?.message ?? "Unable to start the quiz.");
        } finally {
            setStarting(false);
        }
    }

    const certification = type === "CERTIFICATION";

    return (
        <div className="page page-narrow">
            <h1 style={{ margin: 0 }}>Quizzes</h1>

            <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <h2 style={{ margin: 0 }}>Start a quiz</h2>
                <div className="quiz-types" role="group" aria-label="Quiz type">
                    {TYPES.map((t) => (
                        <button key={t.id} className="quiz-type" aria-pressed={type === t.id} onClick={() => setType(t.id)}>
                            <strong>{t.title}</strong>
                            <span>{t.text}</span>
                        </button>
                    ))}
                </div>
                <div className="quiz-filters">
                    <label>
                        Subject
                        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                            <option value="">All subjects</option>
                            {options?.subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.subjectName} ({s.questionCount})</option>)}
                        </select>
                    </label>
                    <label>
                        Manual
                        <select value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
                            <option value="">All manuals</option>
                            {options?.documents.map((d: any) => <option key={d.id} value={d.id}>{d.code} · {d.title} ({d.questionCount})</option>)}
                        </select>
                    </label>
                    {certification ? (
                        <div className="muted" style={{ fontSize: "14px", paddingBottom: "10px" }}>
                            {options?.certificationQuestionCount} questions · pass mark {options?.passMarkPercent}%
                        </div>
                    ) : (
                        <label>
                            Questions
                            <input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} style={{ width: "96px" }} />
                        </label>
                    )}
                </div>
                {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}
                <div>
                    <button className="primary" disabled={starting || !options} onClick={() => void start()}>
                        {starting ? "Starting..." : "Start quiz"}
                    </button>
                </div>
            </section>

            <section className="panel" style={{ padding: "8px 0 0" }}>
                <h2 style={{ margin: "12px 24px" }}>Your quizzes</h2>
                {history.length === 0 ? (
                    <p className="muted" style={{ margin: "0 24px 20px" }}>No quizzes yet.</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", border: "none" }}>
                            <thead><tr><th>Quiz</th><th>Started</th><th>Result</th><th></th></tr></thead>
                            <tbody>
                                {history.map((q) => (
                                    <tr key={q.id}>
                                        <td>{q.name}</td>
                                        <td>{new Date(q.startedAt).toLocaleString()}</td>
                                        <td>
                                            {q.completedAt
                                                ? <span className={`badge ${q.passed ? "good" : "bad"}`}>{q.scorePercent}% · {q.passed ? "Passed" : "Below pass mark"}</span>
                                                : <span className="badge warn">In progress · {q.answeredCount} of {q.questionCount}</span>}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <button onClick={() => props.onOpen(q.id)}>{q.completedAt ? "Review" : "Continue"}</button>
                                        </td>
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

function QuizRunner(props: { sessionId: string; note: string; onLeave: () => void; onStart: (sessionId: string, note: string) => void }) {
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [index, setIndex] = useState(0);
    const [problem, setProblem] = useState("");
    const [busy, setBusy] = useState(false);
    const [reviewing, setReviewing] = useState(false);

    useEffect(() => {
        void (async () => {
            const result = await window.hsusa.getQuiz(props.sessionId);
            if (!result?.success) { setProblem(result?.message ?? "Unable to open the quiz."); return; }
            setQuiz(result.quiz);
            const firstOpen = result.quiz.items.findIndex((i: Item) => !i.selected);
            setIndex(firstOpen >= 0 ? firstOpen : 0);
        })();
    }, [props.sessionId]);

    async function act(work: () => Promise<any>) {
        setBusy(true);
        setProblem("");
        try {
            const result = await work();
            if (result?.success) setQuiz(result.quiz);
            else setProblem(result?.message ?? "Something went wrong.");
        } finally {
            setBusy(false);
        }
    }

    if (!quiz) return <div className="page">{problem ? <p className="message-error">{problem}</p> : <p className="muted">Loading…</p>}</div>;

    if (quiz.completed && !reviewing) {
        return <QuizResults quiz={quiz} onReview={() => { setReviewing(true); setIndex(0); }} onLeave={props.onLeave} onStart={props.onStart} />;
    }

    const item = quiz.items[index];
    const answered = item.selected !== null;
    const locked = quiz.completed || (quiz.practice && answered);
    const last = index === quiz.items.length - 1;

    async function submit() {
        const open = quiz!.questionCount - quiz!.answeredCount;
        const message = open > 0
            ? `${open} question${open === 1 ? " is" : "s are"} not answered and will count as wrong. Submit the quiz?`
            : "Submit the quiz?";
        if (!(await askToConfirm(message, "Submit"))) return;
        await act(() => window.hsusa.finishQuiz(quiz!.id));
    }

    const optionClass = (o: Option) => {
        if (item.correctAnswer === null) return "quiz-option";
        if (o.value === item.correctAnswer) return "quiz-option right";
        if (o.value === item.selected) return "quiz-option wrong";
        return "quiz-option";
    };
    const optionTag = (o: Option) => {
        if (item.correctAnswer === null) return "";
        if (o.value === item.correctAnswer) return "Correct answer";
        if (o.value === item.selected) return "Your answer";
        return "";
    };
    const correctText = item.correctAnswer ? item.options.find((o) => o.value === item.correctAnswer) : null;

    return (
        <div className="page page-narrow">
            <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                <div>
                    <div className="eyebrow">{quiz.practice ? "Practice" : "Certification"}{reviewing ? " · Review" : ""}</div>
                    <h1 style={{ margin: 0, fontSize: "26px" }}>{quiz.name}</h1>
                </div>
                <button onClick={props.onLeave}>{quiz.completed ? "Back to quizzes" : "Save and exit"}</button>
            </header>

            {props.note && !reviewing && <div className="message-note">{props.note}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                    <span><strong>Question {index + 1}</strong> of {quiz.questionCount}</span>
                    <span className="muted">
                        {quiz.practice || quiz.completed ? `${quiz.correctCount} correct so far · ` : ""}{quiz.answeredCount} answered
                    </span>
                </div>
                <div className="progress" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={quiz.questionCount} aria-valuenow={quiz.answeredCount}>
                    <span style={{ width: `${(quiz.answeredCount / quiz.questionCount) * 100}%` }}></span>
                </div>
            </div>

            <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "28px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {item.document && <span className="badge">{item.document}</span>}
                    {item.subject && <span className="badge">{item.subject}</span>}
                    {item.externalId && <span className="badge">{item.externalId}</span>}
                </div>
                <h2 className="quiz-question">{item.text}</h2>
                <fieldset className="quiz-options">
                    <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Choose one answer</legend>
                    {item.options.map((o) => (
                        <button
                            key={o.value}
                            className={optionClass(o)}
                            aria-pressed={item.selected === o.value}
                            disabled={locked || busy}
                            onClick={() => void act(() => window.hsusa.answerQuiz(quiz.id, item.questionId, o.value))}
                        >
                            <span className="letter">{o.label}</span>
                            <span>{o.text}</span>
                            <span className="tag">{optionTag(o)}</span>
                        </button>
                    ))}
                </fieldset>

                {item.correct !== null && (
                    <div className={`feedback ${item.correct ? "good" : "bad"}`} role="status">
                        <strong>{item.correct ? "Correct." : `Not quite. The correct answer is ${item.options.find((o) => o.value === item.correctAnswer)?.label}.`}</strong>
                        {!item.correct && correctText && <span>{correctText.text}</span>}
                        {item.reference && <span className="ref">Reference: {item.reference}</span>}
                    </div>
                )}
                {item.correct === null && quiz.completed && (
                    <div className="feedback bad" role="status">
                        <strong>Not answered. The correct answer is {item.options.find((o) => o.value === item.correctAnswer)?.label}.</strong>
                        {item.reference && <span className="ref">Reference: {item.reference}</span>}
                    </div>
                )}

                {problem && <p className="message-error" role="alert" style={{ margin: 0 }}>{problem}</p>}

                <div className="quiz-footer">
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
                        {!quiz.completed && (
                            <button aria-pressed={item.flagged} disabled={busy} onClick={() => void act(() => window.hsusa.flagQuizQuestion(quiz.id, item.questionId, !item.flagged))}>
                                {item.flagged ? "Unflag" : "Flag for later"}
                            </button>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        {!last && <button className={answered || quiz.completed ? "primary" : ""} onClick={() => setIndex(index + 1)}>Next question</button>}
                        {!quiz.completed && (last || quiz.answeredCount === quiz.questionCount) && (
                            <button className="primary" disabled={busy} onClick={() => void submit()}>Submit quiz</button>
                        )}
                        {quiz.completed && last && <button className="primary" onClick={() => setReviewing(false)}>Back to results</button>}
                    </div>
                </div>
            </section>

            <nav aria-label="Questions" className="quiz-nav">
                {quiz.items.map((q, i) => (
                    <button
                        key={q.questionId}
                        className={[q.selected ? "answered" : "", q.flagged ? "flagged" : ""].join(" ").trim()}
                        aria-current={i === index ? "step" : undefined}
                        aria-label={`Question ${i + 1}${q.selected ? ", answered" : ""}${q.flagged ? ", flagged" : ""}`}
                        onClick={() => setIndex(i)}
                    >
                        {i + 1}{q.flagged ? " ⚑" : ""}
                    </button>
                ))}
            </nav>
            <p className="muted" style={{ fontSize: "13px", margin: 0 }}>Answer order is shuffled every time a quiz is made.</p>
        </div>
    );
}

function QuizResults(props: { quiz: Quiz; onReview: () => void; onLeave: () => void; onStart: (sessionId: string, note: string) => void }) {
    const { quiz } = props;
    const [problem, setProblem] = useState("");
    const wrong = quiz.questionCount - quiz.correctCount;

    async function retake() {
        const result = await window.hsusa.startQuiz({
            type: quiz.type, subjectId: quiz.subjectId ?? undefined, documentId: quiz.documentId ?? undefined, count: quiz.questionCount
        });
        if (result?.success) props.onStart(result.sessionId, result.note ?? "");
        else setProblem(result?.message ?? "Unable to start the quiz.");
    }

    return (
        <div className="page page-narrow">
            <div className="eyebrow">Quiz results</div>
            <h1 style={{ margin: 0, fontSize: "26px" }}>{quiz.name}</h1>
            <section className="panel" style={{ display: "flex", flexWrap: "wrap", gap: "32px", alignItems: "center" }}>
                <div>
                    <div className="score">{quiz.scorePercent}%</div>
                    <span className={`badge ${quiz.passed ? "good" : "bad"}`} style={{ marginTop: "10px" }}>
                        {quiz.passed ? "Passed" : "Below pass mark"} · pass mark {quiz.passMarkPercent}%
                    </span>
                </div>
                <div style={{ display: "flex", gap: "32px" }}>
                    <div><div className="eyebrow">Correct</div><div style={{ fontSize: "28px", fontWeight: 700 }}>{quiz.correctCount}</div></div>
                    <div><div className="eyebrow">Incorrect or blank</div><div style={{ fontSize: "28px", fontWeight: 700 }}>{wrong}</div></div>
                    <div><div className="eyebrow">Questions</div><div style={{ fontSize: "28px", fontWeight: 700 }}>{quiz.questionCount}</div></div>
                </div>
            </section>
            {problem && <p className="message-error" role="alert">{problem}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button className="primary" onClick={props.onReview}>Review answers</button>
                <button onClick={() => void retake()}>Retake{quiz.type === "RANDOM" || quiz.type === "CERTIFICATION" ? " with new questions" : ""}</button>
                <button onClick={props.onLeave}>Back to quizzes</button>
            </div>
            {wrong > 0 && quiz.practice && (
                <p className="muted" style={{ margin: 0 }}>Missed questions come back in a Weak areas quiz.</p>
            )}
        </div>
    );
}
