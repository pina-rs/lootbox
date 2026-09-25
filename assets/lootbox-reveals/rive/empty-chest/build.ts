import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
	EMPTY_CHEST_DISCLOSURE,
	EMPTY_CHESTS,
	emptyChestName,
} from "../../../../apps/web/src/launch/emptyChests.ts";
import "./generate.ts";

const SITE = "https://pina-rs.github.io/lootbox/";
const project = fileURLToPath(new URL(".", import.meta.url));
const output = new URL(
	"../../../../apps/web/public/nft/empty-chest/",
	import.meta.url,
);

mkdirSync(output, { recursive: true });
execFileSync("rive", [project, "--verify"], { stdio: "inherit" });
execFileSync("rive", [project, "--once"], { stdio: "inherit" });
copyFileSync(
	`${project}/build/empty_chest.riv`,
	fileURLToPath(new URL("empty-chest.riv", output)),
);

// Posters come from the browser runtime so they match the website exactly.
execFileSync(process.execPath, [
	fileURLToPath(
		new URL(
			"../../../../apps/web/tools/render-empty-chest-posters.ts",
			import.meta.url,
		),
	),
], { stdio: "inherit" });

// Metaplex JSON per variant. Wallets show `image`; marketplaces that support
// HTML play `animation_url`. The minted URIs point at these files, and the
// leaves are immutable, so the hosted copies must never move.
for (const chest of EMPTY_CHESTS) {
	const base = `${SITE}nft/empty-chest/`;
	const image = `${base}${chest.variant}.png`;
	const player = `${base}play.html?v=${chest.variant}`;
	const metadata = {
		name: emptyChestName(chest),
		symbol: "EMPTY",
		description: `${chest.line} ${EMPTY_CHEST_DISCLOSURE}`,
		image,
		animation_url: player,
		external_url: SITE,
		attributes: [
			{ trait_type: "Contents", value: chest.thing },
			{ trait_type: "Series", value: "Unlisted Empty Chest" },
		],
		properties: {
			files: [
				{ uri: image, type: "image/png" },
				{ uri: player, type: "text/html" },
			],
			category: "html",
		},
	};

	writeFileSync(
		new URL(`${chest.variant}.json`, output),
		`${JSON.stringify(metadata, null, "\t")}\n`,
	);
}

console.log(`Wrote ${EMPTY_CHESTS.length} Empty Chest metadata files`);
