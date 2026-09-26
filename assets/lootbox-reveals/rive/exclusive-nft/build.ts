import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { playerHtml } from "../../../../packages/exclusive-nft-art/src/player.ts";
import "./generate.ts";

/**
 * Regenerates, verifies, and compiles the Exclusive NFT reveal, then copies the
 * `.riv` and the `play.html` player into `@pina-rs/exclusive-nft-art`.
 */
const BUDGET = 250 * 1024;
const project = fileURLToPath(new URL(".", import.meta.url));
const built = fileURLToPath(
	new URL("./build/exclusive_nft.riv", import.meta.url),
);
const target = new URL(
	"../../../../packages/exclusive-nft-art/assets/",
	import.meta.url,
);

execFileSync("rive", [project, "--verify"], { stdio: "inherit" });
execFileSync("rive", [project, "--once"], { stdio: "inherit" });

const { size } = statSync(built);

if (size >= BUDGET) {
	throw new Error(
		`exclusive_nft.riv is ${size} bytes; the budget is ${BUDGET}`,
	);
}

mkdirSync(target, { recursive: true });
copyFileSync(built, fileURLToPath(new URL("exclusive-nft.riv", target)));
writeFileSync(new URL("play.html", target), playerHtml());
console.log(
	`Copied exclusive-nft.riv (${
		(size / 1024).toFixed(1)
	} KB) and play.html into packages/exclusive-nft-art/assets/`,
);
