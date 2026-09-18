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
for (
	const [outcome, name] of [
		"closed",
		"big-prize",
		"small-prize",
		"disappointed",
	].entries()
) {
	execFileSync("rive", [
		project,
		`--screenshot=${output}/${name}.png`,
		`--data=outcome=${outcome - 1}`,
		"--advance=5.1s",
	], { stdio: "inherit" });
}
copyFileSync(`${project}/build/ink_chest.riv`, `${output}/ink-chest.riv`);
