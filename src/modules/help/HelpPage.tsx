import { useEffect, useMemo, useRef, useState } from "react";
import { renderGuide } from "./renderGuide";
import gettingStarted from "../../help/getting-started.md?raw";
import completeDocumentation from "../../help/complete-documentation.md?raw";

// Help (owner, 2026-11-22): a walkthrough for everyone, and the complete
// documentation for Administrators. Built into the app so it works offline.
// The master copies are Claude docs; to update, export each as Markdown and
// replace the file in src/help/ (documents/GUIDES.md).

export default function HelpPage(props: { isAdministrator: boolean }) {
    const guides = [
        { id: "start", label: "Getting Started", text: gettingStarted },
        ...(props.isAdministrator ? [{ id: "complete", label: "Complete Documentation", text: completeDocumentation }] : [])
    ];
    const [guideId, setGuideId] = useState("start");
    const [search, setSearch] = useState("");
    const content = useRef<HTMLDivElement>(null);
    const guide = guides.find((g) => g.id === guideId) ?? guides[0];
    // The guides are our own text, bundled with the app.
    const { html, headings } = useMemo(() => renderGuide(guide.text), [guide.text]);

    // A different guide starts at its top.
    useEffect(() => { if (content.current) content.current.scrollTop = 0; }, [html]);

    // Highlight matches, and jump to the first.
    useEffect(() => {
        const root = content.current;
        if (!root) return;
        root.querySelectorAll("mark.help-hit").forEach((m) => m.replaceWith(document.createTextNode(m.textContent ?? "")));
        root.normalize();
        const term = search.trim();
        if (term.length < 3) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        while (walker.nextNode()) nodes.push(walker.currentNode as Text);
        const lower = term.toLowerCase();
        let first: HTMLElement | null = null;
        for (const node of nodes) {
            const text = node.textContent ?? "";
            const at = text.toLowerCase().indexOf(lower);
            if (at < 0) continue;
            const hit = document.createElement("mark");
            hit.className = "help-hit";
            const after = node.splitText(at);
            after.splitText(term.length);
            hit.textContent = after.textContent;
            after.replaceWith(hit);
            first ??= hit;
        }
        first?.scrollIntoView({ block: "center" });
    }, [search, html]);

    // Scroll the guide (its own scroll area) to a section.
    function jump(id: string) {
        const root = content.current;
        const target = root?.querySelector<HTMLElement>(`[id="${id}"]`);
        if (root && target) root.scrollTo({ top: target.offsetTop - 16, behavior: "smooth" });
    }

    return (
        <div className="help-layout">
            <aside className="help-contents" aria-label="Contents">
                {guides.length > 1 && (
                    <div className="help-tabs" role="tablist">
                        {guides.map((g) => (
                            <button key={g.id} role="tab" aria-selected={g.id === guide.id} className={g.id === guide.id ? "primary" : ""} onClick={() => { setGuideId(g.id); setSearch(""); }}>{g.label}</button>
                        ))}
                    </div>
                )}
                <input type="search" placeholder="Search this guide" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search this guide" />
                <nav>
                    {headings.map((h) => (
                        <button key={h.id} className={`link help-heading level-${h.level}`} onClick={() => jump(h.id)}>{h.text}</button>
                    ))}
                </nav>
            </aside>
            <div className="help-content" ref={content} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
}
