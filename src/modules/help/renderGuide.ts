import { marked } from "marked";

// Turns a help guide into HTML with an id on every section heading, plus the
// list of headings for the contents. The ids are part of the HTML itself, so
// they survive every re-render (setting them on the page afterwards did not;
// found by the owner 2026-11-22: the contents links did nothing).

export interface Heading { id: string; text: string; level: number; }

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const plain = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");

export function renderGuide(markdown: string): { html: string; headings: Heading[] } {
    const raw = marked.parse(markdown, { async: false }) as string;
    const headings: Heading[] = [];
    const seen = new Set<string>();
    const html = raw.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level: string, inner: string) => {
        const text = plain(inner);
        let id = `help-${slug(text)}`;
        while (seen.has(id)) id += "-x";
        seen.add(id);
        headings.push({ id, text, level: Number(level) });
        return `<h${level} id="${id}">${inner}</h${level}>`;
    });
    return { html, headings };
}
