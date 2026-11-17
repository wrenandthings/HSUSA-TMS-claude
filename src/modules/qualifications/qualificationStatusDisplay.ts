import type { QualificationStatus } from "./QualificationService";

// How each qualification status is shown. The spec (section 4) requires the
// 30-day warning and the 7-day critical warning to be displayed distinctly.
export type StatusDisplay = { label: string; description: string; color: string; background: string };

export const STATUS_DISPLAY: Record<QualificationStatus, StatusDisplay> = {
    CURRENT: { label: "Current", description: "More than 30 days remain", color: "#1b5e20", background: "#e8f5e9" },
    EXPIRING: { label: "Expiring", description: "30-day warning: 30 days or fewer remain", color: "#7a4f01", background: "#fff4d6" },
    EXPIRING_CRITICAL: { label: "Critical", description: "7-day critical warning: 7 days or fewer remain", color: "#ffffff", background: "#c62828" },
    EXPIRED: { label: "Expired", description: "The expiration date has passed", color: "#ffffff", background: "#424242" },
    SUSPENDED: { label: "Suspended", description: "Suspended by an administrator", color: "#4a148c", background: "#f3e5f5" }
};

export function statusDisplay(status: string): StatusDisplay {
    return STATUS_DISPLAY[status as QualificationStatus]
        ?? { label: status, description: "", color: "#000000", background: "#eeeeee" };
}

// Expiration dates are stored as UTC midnight of the chosen day. Formatting in
// local time would show the day before for anyone west of UTC.
export function formatQualificationDate(value?: string | Date | null, locale?: string): string {
    if (!value) return "No expiration";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "No expiration";
    return date.toLocaleDateString(locale, { timeZone: "UTC" });
}
