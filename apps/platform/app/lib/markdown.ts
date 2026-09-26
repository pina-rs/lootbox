/**
 * A deliberately tiny Markdown subset for creator descriptions.
 *
 * Supported: paragraphs, `## headings`, `- lists`, `**bold**`, `*italic*`, and
 * `[links](https://…)`. The output is a plain data tree rendered by React, so
 * creator text can never inject HTML or script. Links must be `https:`.
 */
export type Inline =
	| Readonly<{ type: "text"; text: string }>
	| Readonly<{ type: "strong"; children: readonly Inline[] }>
	| Readonly<{ type: "em"; children: readonly Inline[] }>
	| Readonly<{ type: "link"; href: string; children: readonly Inline[] }>;

export type Block =
	| Readonly<{ type: "heading"; children: readonly Inline[] }>
	| Readonly<{ type: "paragraph"; children: readonly Inline[] }>
	| Readonly<{ type: "list"; items: readonly (readonly Inline[])[] }>;

const INLINE =
	/\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/;

export function parseInline(text: string): Inline[] {
	const nodes: Inline[] = [];
	let rest = text;

	while (rest) {
		const match = INLINE.exec(rest);

		if (!match) {
			nodes.push({ type: "text", text: rest });
			break;
		}

		if (match.index > 0) {
			nodes.push({ type: "text", text: rest.slice(0, match.index) });
		}

		const [whole, strong, em, label, href] = match;

		if (strong !== undefined) {
			nodes.push({ type: "strong", children: parseInline(strong) });
		} else if (em !== undefined) {
			nodes.push({ type: "em", children: parseInline(em) });
		} else if (label !== undefined && href !== undefined) {
			nodes.push({ type: "link", href, children: parseInline(label) });
		}

		rest = rest.slice(match.index + whole.length);
	}

	return nodes;
}

export function parseMarkdown(source: string): Block[] {
	const blocks: Block[] = [];
	const chunks = source.replace(/\r\n?/g, "\n").split(/\n{2,}/);

	for (const chunk of chunks) {
		const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);

		if (lines.length === 0) continue;

		if (lines.every((line) => /^[-*]\s+/.test(line))) {
			blocks.push({
				type: "list",
				items: lines.map((line) => parseInline(line.replace(/^[-*]\s+/, ""))),
			});
			continue;
		}

		const first = lines[0] ?? "";

		if (/^#{1,3}\s+/.test(first) && lines.length === 1) {
			blocks.push({
				type: "heading",
				children: parseInline(first.replace(/^#{1,3}\s+/, "")),
			});
			continue;
		}

		blocks.push({ type: "paragraph", children: parseInline(lines.join(" ")) });
	}

	return blocks;
}
