import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../../src/app/App";
import QuizzesPage from "../../src/modules/quizzes/QuizzesPage";

// Sprint 1, Epic 10: "React Startup". The app renders its first screen.
describe("React start-up", () => {
    it("renders the sign-in screen", () => {
        const html = renderToString(createElement(App));
        expect(html).toContain("Sign in");
        expect(html).toContain("Every crew member current.");
        expect(html).toContain('type="password"');
    });

    it("renders the quiz start screen with the four quiz types", () => {
        const html = renderToString(createElement(QuizzesPage));
        for (const text of ["Start a quiz", "Random", "Weak areas", "Unseen", "Certification", "Your quizzes"]) expect(html).toContain(text);
    });
});
