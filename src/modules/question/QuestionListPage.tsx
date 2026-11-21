import { askToConfirm } from "../../components/askToConfirm";
import { useEffect, useRef, useState } from "react";
import { QuestionService, QuestionBankImportResult } from "./QuestionService";
import QuestionDetailPage from "./QuestionDetailPage";
import CreateQuestionForm from "./CreateQuestionForm";
import {
    parseQuestionsCsv,
    questionsToCsv,
    QuestionCsvRow
} from "./question-csv";

interface Props {
    onBack: () => void;
}

type SortField = "questionText" | "category" | "difficulty" | "answer";

const questionService = new QuestionService();

// Bank questions keep four options and the letter of the correct one; older
// hand-entered questions keep a free-text answer.
export function displayAnswer(question: any): string {
    const letter = question.correctAnswer;
    if (letter && question[`answer${letter}`]) return `${letter}. ${question[`answer${letter}`]}`;
    return question.answer ?? "";
}

// A file is a question bank (the agreed 15-column format) when its header has
// a questionId column.
function isQuestionBankFile(text: string): boolean {
    const header = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0].toLowerCase();
    return header.split(",").some((name) => ["questionid", "externalid"].includes(name.trim().replace(/[\s_"-]/g, "")));
}

export default function QuestionListPage(props: Props) {
    const [questions, setQuestions] = useState<any[]>([]);
    const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);
    const [sortField, setSortField] = useState<SortField>("questionText");
    const [sortAscending, setSortAscending] = useState(true);
    // Source manual filter (owner, 2026-11-20): "" shows every question.
    const [manual, setManual] = useState("");
    const [csvRows, setCsvRows] = useState<QuestionCsvRow[]>([]);
    const [csvErrors, setCsvErrors] = useState<string[]>([]);
    const [importing, setImporting] = useState(false);
    const [bankCsv, setBankCsv] = useState<string | null>(null);
    const [bankPreview, setBankPreview] = useState<QuestionBankImportResult | null>(null);
    const [bankMessage, setBankMessage] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadQuestions();
    }, []);

    async function loadQuestions() {
        setQuestions(await questionService.getQuestions());
        setSelectedIds([]);
    }

    async function createQuestion(
        questionText: string,
        category: string,
        difficulty: string,
        answer: string
    ) {
        await questionService.createQuestion(
            questionText, category, difficulty, answer
        );
        await loadQuestions();
        setCreating(false);
    }

    async function handleCsvSelected(
        event: React.ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        setBankMessage("");
        if (isQuestionBankFile(text)) {
            setCsvRows([]);
            setCsvErrors([]);
            setBankCsv(text);
            setBankPreview(await questionService.importQuestionBank(text, true));
            return;
        }
        setBankCsv(null);
        setBankPreview(null);
        const result = parseQuestionsCsv(text);
        setCsvRows(result.rows);
        setCsvErrors(result.errors);
    }

    function clearBankImport() {
        setBankCsv(null);
        setBankPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function importBank() {
        if (!bankCsv || !bankPreview?.success) return;
        setImporting(true);
        try {
            const result = await questionService.importQuestionBank(bankCsv, false);
            if (result.success) {
                setBankMessage(result.message);
                clearBankImport();
                await loadQuestions();
            } else {
                setBankPreview(result);
            }
        } finally {
            setImporting(false);
        }
    }

    async function importCsv() {
        if (csvRows.length === 0 || csvErrors.length > 0) return;
        setImporting(true);
        try {
            await questionService.importQuestions(csvRows);
            await loadQuestions();
            setCsvRows([]);
            setCsvErrors([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } finally {
            setImporting(false);
        }
    }

    function exportCsv() {
        const blob = new Blob([questionsToCsv(questions)], {
            type: "text/csv;charset=utf-8;"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "questions.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    function toggleSelected(questionId: string) {
        setSelectedIds((current) =>
            current.includes(questionId)
                ? current.filter((id) => id !== questionId)
                : [...current, questionId]
        );
    }

    // Select all applies to the questions on screen (after the manual filter).
    function toggleAllSelected() {
        setSelectedIds((current) =>
            current.length === sortedQuestions.length
                ? []
                : sortedQuestions.map((question) => question.id)
        );
    }

    async function deleteQuestions(questionIds: string[]) {
        if (questionIds.length === 0) return;

        const message = questionIds.length === 1
            ? "Delete this question?"
            : `Delete these ${questionIds.length} questions?`;

        if (!(await askToConfirm(message))) return;

        await questionService.deleteQuestions(questionIds);
        await loadQuestions();
    }

    const manuals = [...new Map(questions.filter((q) => q.document).map((q) => [q.document.code, q.document])).values()]
        .sort((a: any, b: any) => a.code.localeCompare(b.code));
    const noManual = questions.filter((q) => !q.document).length;
    const sortedQuestions = questions.filter((q) =>
        manual === "" || (manual === "none" ? !q.document : q.document?.code === manual)
    ).sort((left, right) => {
        const leftValue = String(left[sortField] ?? "").toLocaleLowerCase();
        const rightValue = String(right[sortField] ?? "").toLocaleLowerCase();
        const comparison = leftValue.localeCompare(rightValue);
        return sortAscending ? comparison : -comparison;
    });

    if (creating) {
        return (
            <CreateQuestionForm
                onCreate={createQuestion}
                onCancel={() => setCreating(false)}
            />
        );
    }

    if (selectedQuestion) {
        return (
            <QuestionDetailPage
                questionId={selectedQuestion}
                onBack={() => {
                    setSelectedQuestion(null);
                    loadQuestions();
                }}
            />
        );
    }

    const allSelected = sortedQuestions.length > 0 && selectedIds.length === sortedQuestions.length;

    return (
        <div style={{ padding: "40px" }}>

            <h1>Question Bank</h1>

            <button className="primary" onClick={() => setCreating(true)}>+ Create New Question</button>
            <button onClick={exportCsv} style={{ marginLeft: "10px" }}>
                Export CSV
            </button>
            <button
                onClick={() => deleteQuestions(selectedIds)}
                disabled={selectedIds.length === 0}
                style={{ marginLeft: "10px" }}
            >
                Delete Selected ({selectedIds.length})
            </button>

            <div style={{ margin: "20px 0" }}>
                <label htmlFor="question-sort">Sort by: </label>
                <select
                    id="question-sort"
                    value={sortField}
                    onChange={(event) =>
                        setSortField(event.target.value as SortField)
                    }
                >
                    <option value="questionText">Alphabetical / Question</option>
                    <option value="category">Category</option>
                    <option value="difficulty">Difficulty</option>
                    <option value="answer">Answer</option>
                </select>
                <button
                    onClick={() => setSortAscending((current) => !current)}
                    style={{ marginLeft: "10px" }}
                >
                    {sortAscending ? "Ascending ↑" : "Descending ↓"}
                </button>
                <label htmlFor="question-manual" style={{ marginLeft: "24px" }}>Manual: </label>
                <select
                    id="question-manual"
                    value={manual}
                    onChange={(event) => { setManual(event.target.value); setSelectedIds([]); }}
                >
                    <option value="">All manuals ({questions.length})</option>
                    {manuals.map((doc: any) => (
                        <option key={doc.code} value={doc.code}>
                            {doc.code} · {doc.title} ({questions.filter((q) => q.document?.code === doc.code).length})
                        </option>
                    ))}
                    {noManual > 0 && <option value="none">No manual ({noManual})</option>}
                </select>
            </div>

            <div style={{ margin: "20px 0" }}>
                <label htmlFor="question-csv">Import CSV: </label>
                <input
                    id="question-csv"
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvSelected}
                />
            </div>

            {bankMessage && <p style={{ color: "darkgreen" }}>{bankMessage}</p>}

            {bankPreview && (
                <div>
                    <h2>Question Bank Import</h2>
                    <p style={{ color: bankPreview.success ? "inherit" : "darkred" }}>{bankPreview.message}</p>
                    {bankPreview.errors.length > 0 && (
                        <ul style={{ color: "darkred" }}>
                            {bankPreview.errors.slice(0, 50).map((error) => <li key={error}>{error}</li>)}
                            {bankPreview.errors.length > 50 && <li>…and {bankPreview.errors.length - 50} more.</li>}
                        </ul>
                    )}
                    <button className="primary" disabled={!bankPreview.success || importing} onClick={importBank}>
                        {importing ? "Importing..." : "Confirm Import"}
                    </button>
                    <button onClick={clearBankImport} style={{ marginLeft: "10px" }}>Cancel</button>
                </div>
            )}

            {csvRows.length > 0 && (
                <div>
                    <h2>Import Preview ({csvRows.length} rows)</h2>
                    {csvErrors.length > 0 && (
                        <ul style={{ color: "darkred" }}>
                            {csvErrors.map((error) => <li key={error}>{error}</li>)}
                        </ul>
                    )}
                    <button className="primary"
                        disabled={csvErrors.length > 0 || importing}
                        onClick={importCsv}
                    >
                        {importing ? "Importing..." : "Confirm Import"}
                    </button>
                </div>
            )}

            <table border={1} cellPadding={10} style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
                <thead>
                    <tr>
                        <th>
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={toggleAllSelected}
                                aria-label="Select all questions"
                            />
                        </th>
                        <th>Question</th>
                        <th>Manual</th>
                        <th>Subject</th>
                        <th>Category</th>
                        <th>Difficulty</th>
                        <th>Answer</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedQuestions.map((question: any) => (
                        <tr key={question.id}>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(question.id)}
                                    onChange={() => toggleSelected(question.id)}
                                    aria-label={`Select ${question.questionText}`}
                                />
                            </td>
                            <td>{question.questionText}</td>
                            <td>{question.document?.code ?? ""}</td>
                            <td>{question.subject?.code ?? ""}</td>
                            <td>{question.category}</td>
                            <td>{question.difficulty}</td>
                            <td>{displayAnswer(question)}</td>
                            <td>
                                <button onClick={() => setSelectedQuestion(question.id)}>
                                    View Details
                                </button>
                                <button
                                    onClick={() => deleteQuestions([question.id])}
                                    style={{ marginLeft: "8px" }}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
