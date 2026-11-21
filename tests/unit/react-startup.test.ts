import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../../src/app/App";

// Sprint 1, Epic 10: "React Startup". The app renders its first screen.
describe("React start-up", () => {
    it("renders the sign-in screen", () => {
        const html = renderToString(createElement(App));
        expect(html).toContain("Sign in");
        expect(html).toContain("Every crew member current.");
        expect(html).toContain('type="password"');
    });
});
