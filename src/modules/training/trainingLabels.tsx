// Shared wording for training and qualification status.
export const STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" | "" }> = {
    CURRENT: { label: "Current", tone: "good" },
    EXPIRING: { label: "Due soon", tone: "warn" },
    EXPIRED: { label: "Expired", tone: "bad" },
    MISSING: { label: "Not done", tone: "bad" },
    INCOMPLETE: { label: "Not complete", tone: "bad" },
    SUSPENDED: { label: "Suspended", tone: "bad" },
    NO_REQUIREMENTS: { label: "No requirements set", tone: "" }
};

export const APPROVAL: Record<string, { label: string; tone: "good" | "warn" | "bad" }> = {
    PENDING: { label: "Waiting for approval", tone: "warn" },
    APPROVED: { label: "Approved", tone: "good" },
    REJECTED: { label: "Rejected", tone: "bad" }
};

export const RESULT: Record<string, string> = { PASS: "Pass", FAIL: "Fail", INCOMPLETE: "Incomplete", WAIVED: "Waived" };

// Training dates are stored as UTC midnight of the day, so show them in UTC.
export function day(value: string | Date | null | undefined) {
    if (!value) return "";
    return new Date(value).toLocaleDateString(undefined, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

export function todayInput() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function StatusBadge(props: { status: string }) {
    const s = STATUS[props.status] ?? { label: props.status, tone: "" };
    return <span className={`badge ${s.tone}`}>{s.label}</span>;
}
