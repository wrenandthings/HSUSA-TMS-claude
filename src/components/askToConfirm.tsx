import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

// An in-page replacement for the browser confirm box. On Windows, Electron's native
// confirm box leaves the page unable to take typing afterwards (text boxes
// ignore the keyboard until the window loses and regains focus). Found on
// 2026-11-20 after hiding a qualification, then trying to create a user.
//
// Usage: if (!(await askToConfirm("Delete this subject?"))) return;
export function askToConfirm(message: string, confirmLabel = "OK"): Promise<boolean> {
    return new Promise((resolve) => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        const root = createRoot(host);
        const finish = (answer: boolean) => {
            root.unmount();
            host.remove();
            resolve(answer);
        };
        root.render(<ConfirmBox message={message} confirmLabel={confirmLabel} onAnswer={finish} />);
    });
}

function ConfirmBox(props: { message: string; confirmLabel: string; onAnswer: (answer: boolean) => void }) {
    const okRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        okRef.current?.focus();
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") props.onAnswer(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "white", padding: "20px", maxWidth: "460px", border: "1px solid #888" }}>
                <p style={{ marginTop: 0 }}>{props.message}</p>
                <button ref={okRef} className="primary" onClick={() => props.onAnswer(true)}>{props.confirmLabel}</button>
                <button onClick={() => props.onAnswer(false)} style={{ marginLeft: "10px" }}>Cancel</button>
            </div>
        </div>
    );
}
