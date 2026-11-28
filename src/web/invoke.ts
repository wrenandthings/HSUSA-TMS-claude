// Sends one request to the web server: POST /api/<channel> with the same
// input the desktop app sends over Electron IPC.

// Electron's IPC keeps Date objects; JSON turns them into text. Turn them
// back, so the screens see what they see on the desktop.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
export const reviveDates = (_key: string, value: unknown) => (typeof value === "string" && ISO_DATE.test(value) ? new Date(value) : value);

export const SESSION_ENDED = "tms-session-ended";

export async function invoke(channel: string, input?: unknown): Promise<any> {
    let response: Response;
    try {
        response = await fetch(`/api/${channel}`, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", "X-TMS": "1" },
            body: input === undefined ? "" : JSON.stringify(input)
        });
    } catch {
        return { success: false, message: "No connection to the server. Check your internet connection and try again." };
    }
    const text = await response.text();
    let result: any;
    try {
        result = JSON.parse(text, reviveDates);
    } catch {
        return { success: false, message: `The server answered with an error (${response.status}).` };
    }
    // The server no longer knows who this is (sign-in expired). Tell the app,
    // which returns to the sign-in screen, and never hand the page this answer:
    // pages expecting a list would break on it.
    if (result?.success === false && result?.message === "Authentication required" && !channel.startsWith("auth-")) {
        window.dispatchEvent(new CustomEvent(SESSION_ENDED));
        return new Promise(() => {});
    }
    return result;
}
