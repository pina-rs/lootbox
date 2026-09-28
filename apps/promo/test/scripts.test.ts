import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SCRIPT_CUTS } from "../src/data/scripts.ts";

const script = readFileSync(
	new URL("../talk/SCRIPTS.md", import.meta.url),
	"utf8",
);

describe("script cuts", () => {
	for (const cut of SCRIPT_CUTS) {
		it(`keeps script ${cut.id}'s cues in order and inside its ${cut.seconds} s`, () => {
			for (const cues of [cut.captions, cut.inserts]) {
				let previous = 0;

				for (const cue of cues) {
					expect(cue.from).toBeGreaterThanOrEqual(previous);
					expect(cue.to).toBeGreaterThan(cue.from);
					expect(cue.to).toBeLessThanOrEqual(cut.seconds);
					previous = cue.to;
				}
			}
		});

		it(`matches a script in SCRIPTS.md (${cut.title})`, () => {
			expect(script).toContain(`## Script ${cut.id}`);
			expect(script).toContain(cut.title);
		});
	}
});
