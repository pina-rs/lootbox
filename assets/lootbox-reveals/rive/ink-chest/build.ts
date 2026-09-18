import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import "./generate.ts";

const project = fileURLToPath(new URL(".", import.meta.url));
const output = fileURLToPath(
	new URL("../../../../apps/web/public/animations/ink-chest/", import.meta.url),
);
mkdirSync(output, { recursive: true });
execFileSync("rive", [project, "--verify"], { stdio: "inherit" });
execFileSync("rive", [project, "--once"], { stdio: "inherit" });
copyFileSync(`${project}/build/ink_chest.riv`, `${output}/ink-chest.riv`);
// The CLI viewer composites screenshots over opaque gray. Export the actual
// browser canvas so reduced-motion stills preserve the Rive file's alpha.
execFileSync(process.execPath, [
	fileURLToPath(
		new URL(
			"../../../../apps/web/tools/render-reveal-stills.ts",
			import.meta.url,
		),
	),
], { stdio: "inherit" });
