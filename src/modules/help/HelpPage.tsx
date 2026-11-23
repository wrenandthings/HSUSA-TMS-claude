import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import gettingStarted from "../../help/getting-started.md?raw";
import completeDocumentation from "../../help/complete-documentation.md?raw";

// Help (owner, 2026-11-22): a walkthrough for everyone, and the complete
// documentation for Administrators. Built into the app so it works offline.
// The master copies are Claude docs; to update, export each as Markdown and
// replace the file in src/help/ (documents/GUIDES.md).

interface Heading { id: string; text: string; level: number; }

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function HelpPage(props: { isAdministrator: boolean }) {
    const guides = [
        { id: "start", label: "Getting Started", text: gettingStarted },
        ...(props.isAdministrator ? [{ id: "complete", label: "Complete Documentation", text: completeDocumentation }] : [])
    ];
    const [guideId, setGuideId] = useState("start");
    const [headings, setHeadings] = useState<Heading[]>([]);
    const [search, setSearch] = useState("");
    const content = useRef<HTMLDivElement>(null);
    const guide = guides.find((g) => g.id === guideId) ?? guides[0];
    // The guides are our own text, bundled with the app.
    const html = useMemo(() => marked.parse(guide.text, { async: false }) as string, [guide.text]);

    // Give every section heading an id, and list them for the contents.
    useEffect(() => {
        const root = content.current;
        if (!root) return;
        const seen = new Set<string>();
        const found: Heading[] = [];
        root.querySelectorAll("h2, h3").forEach((el) => {
            let id = slug(el.textContent ?? "");
            while (seen.has(id)) id += "-x";
            seen.add(id);
            el.id = id;
            found.push({ id, text: el.textContent ?? "", level: el.tagName === "H2" ? 2 : 3 });
        });
        setHeadings(found);
        root.scrollTop = 0;
    }, [html]);

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

    function jump(id: string) {
        document.getElementById(id)?.scrollIntoView({ block: "start" });
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
