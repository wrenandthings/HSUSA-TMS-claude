import { statusDisplay } from "./qualificationStatusDisplay";

export default function QualificationStatusBadge(props: { status: string }) {
    const display = statusDisplay(props.status);
    return (
        <span
            title={display.description}
            style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 4,
                fontWeight: 600,
                color: display.color,
                background: display.background
            }}
        >
            {display.label}
        </span>
    );
}
