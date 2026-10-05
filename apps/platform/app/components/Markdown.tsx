import type { ReactNode } from "react";

import { type Inline, parseMarkdown } from "../lib/markdown.js";

function renderInline(nodes: readonly Inline[]): ReactNode[] {
	return nodes.map((node, index) => {
		switch (node.type) {
			case "text":
				return node.text;
			case "strong":
				return <strong key={index}>{renderInline(node.children)}</strong>;
			case "em":
				return <em key={index}>{renderInline(node.children)}</em>;
			case "link":
				return (
					<a
						key={index}
						href={node.href}
						rel="noreferrer nofollow ugc"
						target="_blank"
					>
						{renderInline(node.children)}
					</a>
				);
		}
	});
}

/** Creator Markdown, rendered as React elements (never raw HTML). */
export function Markdown({ source }: Readonly<{ source: string }>) {
	return (
		<div className="prose">
			{parseMarkdown(source).map((block, index) => {
				switch (block.type) {
					case "heading":
						return <h3 key={index}>{renderInline(block.children)}</h3>;
					case "paragraph":
						return <p key={index}>{renderInline(block.children)}</p>;
					case "list":
						return (
							<ul key={index}>
								{block.items.map((item, itemIndex) => (
									<li key={itemIndex}>{renderInline(item)}</li>
								))}
							</ul>
						);
				}
			})}
		</div>
	);
}
