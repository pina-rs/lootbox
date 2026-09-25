import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { assetUrl } from "./launch/assets.js";
import { LootboxMachine } from "./lootbox/Machine.js";
import type { RevealOutcome } from "./lootbox/reveal.js";
import "./reveal-preview.css";

function Preview() {
	const [outcome, setOutcome] = useState<RevealOutcome>("big-prize");
	const [take, setTake] = useState(0);
	const [playing, setPlaying] = useState(false);
	const finish = useCallback(() => setPlaying(false), []);
	const options: readonly [RevealOutcome, string, string][] = [
		[
			"big-prize",
			"Wish granted",
			"Four jumps. Shooting stars. A sparkling victory lap.",
		],
		[
			"small-prize",
			"A nice surprise",
			"Three little hops and a bright gem. No wish was chosen.",
		],
		[
			"disappointed",
			"Not this time",
			"A small hop, a soft slump, and a rolling silver token.",
		],
	];
	return (
		<main className="reveal-preview">
			<header>
				<p className="eyebrow">LOOTBOX / MOTION STUDY</p>
				<h1>
					A little box.<br />A lot of feeling.
				</h1>
				<p>
					Hand-inked lines, springy landings, and stars with somewhere to go.
				</p>
			</header>
			<LootboxMachine
				key={take}
				phase={take ? "revealed" : "idle"}
				outcome={outcome}
				playReveal={playing}
				onRevealComplete={finish}
			/>
			<div className="preview-options">
				{options.map(([value, title, description]) => (
					<button
						type="button"
						key={value}
						aria-pressed={outcome === value}
						onClick={() => {
							setOutcome(value);
							setTake((n) => n + 1);
							setPlaying(true);
						}}
					>
						<strong>{title}</strong>
						<span>{description}</span>
					</button>
				))}
			</div>
			<p className="preview-note" role="status">
				{playing
					? "Playing the reveal. You can skip it at any time."
					: "Choose a reaction to play or replay it. Reduced-motion settings are respected."}
			</p>
			<footer>
				Animation preview only. No prize is selected or awarded.<br />
				<a href={assetUrl("playground")}>Back to the lootbox workshop</a>
			</footer>
		</main>
	);
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing preview root");
createRoot(root).render(
	<StrictMode>
		<Preview />
	</StrictMode>,
);
