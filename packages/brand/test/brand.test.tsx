import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { brandFiles } from "../scripts/files.tsx";
import {
	ChestMark,
	Logo,
	Wordmark,
	WORDMARK_LETTERS,
	WORDMARK_VIEWBOX,
} from "../src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ids = (markup: string) =>
	[...markup.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);

describe("ChestMark", () => {
	it("is decorative unless it has a title", () => {
		expect(renderToStaticMarkup(<ChestMark />)).toContain('aria-hidden="true"');

		const named = renderToStaticMarkup(<ChestMark title="lootbox" />);

		expect(named).toContain('role="img"');
		expect(named).toContain('aria-label="lootbox"');
		expect(named).not.toContain("aria-hidden");
	});

	it("gives every instance its own clip and gradient ids", () => {
		const markup = renderToStaticMarkup(
			<div>
				<ChestMark />
				<ChestMark variant="compact" />
			</div>,
		);
		const all = ids(markup);

		expect(all.length).toBeGreaterThan(0);
		expect(new Set(all).size).toBe(all.length);

		for (const id of all) {
			expect(id).toMatch(/^[a-zA-Z][\w-]*$/);
			expect(markup).toContain(`url(#${id})`);
		}
	});

	it("clamps animation inputs", () => {
		const wide = renderToStaticMarkup(<ChestMark open={2} blink={1} />);

		expect(renderToStaticMarkup(<ChestMark open={9} blink={4} />)).toBe(wide);
		expect(renderToStaticMarkup(<ChestMark look={{ x: 7, y: -7 }} />)).toBe(
			renderToStaticMarkup(<ChestMark look={{ x: 1, y: -1 }} />),
		);
	});

	it("only transforms the eyes while blinking", () => {
		expect(renderToStaticMarkup(<ChestMark />)).not.toMatch(
			/data-part="eye" transform/,
		);
		expect(renderToStaticMarkup(<ChestMark blink={0.5} />)).toMatch(
			/data-part="eye" transform="translate\(\d+ \d+\) scale\(1 0\.54\)/,
		);
	});

	it("leaves sparkles off the compact variant", () => {
		const sparkle = /stroke-linejoin="round"><path d="M446/;

		expect(renderToStaticMarkup(<ChestMark />)).toMatch(sparkle);
		expect(renderToStaticMarkup(<ChestMark variant="compact" />)).not.toMatch(
			sparkle,
		);
	});
});

describe("Wordmark", () => {
	it("spells LOOTBOX with tracking, left to right", () => {
		expect(WORDMARK_LETTERS.map((letter) => letter.char).join("")).toBe(
			"LOOTBOX",
		);

		for (const [index, letter] of WORDMARK_LETTERS.entries()) {
			const previous = WORDMARK_LETTERS[index - 1];

			if (previous) {
				expect(letter.x).toBe(previous.x + previous.advance - 10);
			}
		}

		expect(WORDMARK_VIEWBOX.width).toBeGreaterThan(WORDMARK_VIEWBOX.height * 6);
	});

	it("draws exactly two eyes and lowers eyelids when blinking", () => {
		const open = renderToStaticMarkup(<Wordmark />);
		const shut = renderToStaticMarkup(<Wordmark blink={1} />);

		expect(ids(open)).toHaveLength(2);
		expect(shut.match(/<rect/g)?.length).toBe(4);
		expect(open.match(/<rect/g)?.length).toBe(2);
	});

	it("is named lootbox by default and decorative with an empty title", () => {
		expect(renderToStaticMarkup(<Wordmark />)).toContain(
			'aria-label="lootbox"',
		);
		expect(renderToStaticMarkup(<Wordmark title="" />)).toContain(
			'aria-hidden="true"',
		);
	});
});

describe("Logo", () => {
	it("has one accessible name and hides its parts", () => {
		const markup = renderToStaticMarkup(<Logo />);

		expect(markup.match(/aria-label=/g)).toHaveLength(1);
		expect(markup.match(/aria-hidden="true"/g)).toHaveLength(2);
	});
});

describe("exported files", () => {
	it("match the components (run `pnpm export` after design changes)", () => {
		for (const file of brandFiles()) {
			if (file.kind !== "svg") continue;

			expect(readFileSync(join(root, file.path), "utf8"), file.path).toBe(
				file.svg,
			);
		}
	});
});
