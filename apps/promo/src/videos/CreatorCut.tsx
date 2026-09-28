/**
 * The edit for your own recording. You talk to camera; at each cue an
 * animated insert takes the frame and your footage shrinks into a round face
 * bubble so you keep talking over it. Captions, a lower third, a quiet music
 * bed, and the end card are added. Until footage arrives, a talking chest
 * stands in so the edit can be previewed.
 *
 * Drop the recording in `public/footage/` and pass its file name as
 * `footage`. Cues live in `src/data/scripts.ts`.
 */
import { ChestMark } from "@pina-rs/lootbox-brand";
import type { ReactElement } from "react";
import {
	AbsoluteFill,
	OffthreadVideo,
	Sequence,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

import { type Insert, SCRIPT_CUTS, type ScriptCut } from "../data/scripts.ts";
import { Chest } from "../kit/Chest.tsx";
import { blinks, enter, FPS, mix, POP, progress, SNAP } from "../kit/motion.ts";
import { Paper } from "../kit/Paper.tsx";
import { Music, Sfx } from "../kit/Sound.tsx";
import { Caption } from "../kit/Type.tsx";
import { Airdrop } from "../scenes/Airdrop.tsx";
import { Builder } from "../scenes/Builder.tsx";
import { Collectibles } from "../scenes/Collectibles.tsx";
import { CurveSale } from "../scenes/CurveSale.tsx";
import { EndCard } from "../scenes/EndCard.tsx";
import { LockIn } from "../scenes/LockIn.tsx";
import { OpenOnPhone } from "../scenes/OpenOnPhone.tsx";
import { StoryCopies, StoryStaircase } from "../scenes/Story.tsx";
import { TwoWays } from "../scenes/TwoWays.tsx";

export type CreatorCutProps = Readonly<{
	script: ScriptCut["id"];
	/** A file in `public/footage/`, or null for the stand-in. */
	footage: string | null;
	name: string;
}>;

/** Each insert, started at the moment of its scene worth seeing. */
const INSERTS: Record<
	Insert,
	Readonly<{ skip: number; render: () => ReactElement }>
> = {
	lock: { skip: 0, render: () => <LockIn caption={null} /> },
	builder: { skip: 0, render: () => <Builder /> },
	odds: { skip: 196, render: () => <Builder /> },
	ways: { skip: 60, render: () => <TwoWays /> },
	airdrop: { skip: 40, render: () => <Airdrop /> },
	curve: { skip: 120, render: () => <CurveSale captions={false} /> },
	collectibles: { skip: 0, render: () => <Collectibles /> },
	open: { skip: 80, render: () => <OpenOnPhone captions={false} /> },
	copies: { skip: 0, render: () => <StoryCopies /> },
	stairs: { skip: 0, render: () => <StoryStaircase /> },
	end: { skip: 0, render: () => <EndCard /> },
};

export function scriptCut(id: ScriptCut["id"]): ScriptCut {
	const cut = SCRIPT_CUTS.find((item) => item.id === id);

	if (!cut) throw new Error(`No script ${id}`);

	return cut;
}

/** Your take, or a chest that talks while a caption is up. */
function Speaker(
	{ footage, cut }: Readonly<{ footage: string | null; cut: ScriptCut }>,
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();

	if (footage) {
		return (
			<OffthreadVideo
				src={staticFile(`footage/${footage}`)}
				style={{ width: "100%", height: "100%", objectFit: "cover" }}
			/>
		);
	}

	const seconds = frame / FPS;
	const talking = cut.captions.some((caption) =>
		seconds >= caption.from && seconds < caption.to
	);
	const mouth = talking ? 0.55 + Math.abs(Math.sin(frame * 0.55)) * 0.45 : 0.7;
	const size = Math.min(width, height) * 0.62;

	return (
		<Paper ground="teal">
			<Chest
				x={width / 2}
				y={height * 0.72}
				size={size}
				open={mouth}
				look={{ x: Math.sin(frame / 40) * 0.3, y: 0 }}
				blink={blinks(frame, [
					40,
					130,
					220,
					310,
					400,
					520,
					640,
					760,
					900,
					1040,
					1200,
					1400,
					1600,
				])}
			/>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: height * 0.08,
					textAlign: "center",
					font: `800 ${Math.min(width, height) * 0.035}px/1.3 var(--body)`,
					color: "var(--ivory)",
					opacity: 0.8,
				}}
			>
				Stand-in: your recording goes here
			</div>
		</Paper>
	);
}

function FaceBubble(
	{ children, at, until, corner }: Readonly<{
		children: ReactElement;
		at: number;
		until: number;
		corner: "top" | "bottom";
	}>,
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const size = Math.min(width, height) * (corner === "top" ? 0.3 : 0.26);
	const inT = enter(frame, at, POP);
	const out = progress(frame, until - 6, 6);
	const scale = Math.min(1, inT) * (1 - out);

	if (scale <= 0.001) return null;

	return (
		<div
			style={{
				position: "absolute",
				right: width * 0.035,
				...(corner === "top"
					? { top: height * 0.05 }
					: { bottom: height * 0.05 }),
				width: size,
				height: size,
				borderRadius: "50%",
				border: "8px solid var(--ink)",
				boxShadow: "0 10px 0 var(--ink)",
				overflow: "hidden",
				transform: `scale(${scale})`,
				zIndex: 30,
				background: "var(--teal-deep)",
			}}
		>
			<div
				style={{
					position: "absolute",
					left: -(width - size) / 2,
					top: -(height - size) / 2 + size * 0.08,
					width,
					height,
				}}
			>
				{children}
			</div>
		</div>
	);
}

function LowerThird({ name }: Readonly<{ name: string }>) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const t = enter(frame, 12, SNAP);
	const out = progress(frame, FPS * 4, 10);
	const size = Math.min(width, height) * 0.04;

	return (
		<div
			style={{
				position: "absolute",
				left: width * 0.05,
				top: height * 0.06,
				display: "flex",
				alignItems: "center",
				gap: size * 0.5,
				padding: `${size * 0.35}px ${size * 0.7}px ${size * 0.35}px ${
					size * 0.35
				}px`,
				border: "5px solid var(--ink)",
				borderRadius: 999,
				background: "var(--white)",
				boxShadow: "0 6px 0 var(--ink)",
				transform: `translateX(${
					mix(-width * 0.6, 0, Math.min(1, t)) - out * width * 0.6
				}px)`,
				zIndex: 40,
			}}
		>
			<ChestMark variant="compact" size={size * 1.8} />
			<span style={{ font: `900 ${size}px/1.1 var(--body)` }}>
				{name}
				<span
					style={{
						display: "block",
						fontSize: size * 0.7,
						color: "var(--ink-soft)",
					}}
				>
					built lootbox.so
				</span>
			</span>
		</div>
	);
}

export function CreatorCut({ script, footage, name }: CreatorCutProps) {
	const cut = scriptCut(script);
	const { height, durationInFrames } = useVideoConfig();
	const tall = cut.shape === "tall";

	return (
		<AbsoluteFill style={{ background: "var(--ink)" }}>
			<Speaker footage={footage} cut={cut} />
			<LowerThird name={name} />
			{cut.inserts.map((cue) => {
				const from = Math.round(cue.from * FPS);
				const length = Math.round((cue.to - cue.from) * FPS);
				const insert = INSERTS[cue.insert];

				return (
					<Sequence
						key={`${cue.insert}-${cue.from}`}
						from={from}
						durationInFrames={length}
					>
						<Paper>
							<Sequence from={-insert.skip}>{insert.render()}</Sequence>
						</Paper>
						{cue.insert !== "end" && (
							<FaceBubble
								at={0}
								until={length}
								corner={tall ? "top" : "bottom"}
							>
								{/* Back on the main timeline, so the bubble shows the same moment. */}
								<Sequence from={-from} layout="none">
									<Speaker footage={footage} cut={cut} />
								</Sequence>
							</FaceBubble>
						)}
						<Sfx name="whoosh" at={0} volume={0.3} />
					</Sequence>
				);
			})}
			{cut.captions.map((caption) => (
				<Caption
					key={caption.from}
					text={caption.text}
					at={Math.round(caption.from * FPS)}
					until={Math.round(caption.to * FPS) - 2}
					size={tall ? 56 : 46}
					bottom={tall ? height * 0.16 : height * 0.06}
					{...(tall ? {} : { align: "left" as const, maxWidth: "68%" })}
				/>
			))}
			<Music
				track="vault-lofi"
				durationInFrames={durationInFrames}
				fadeOut={40}
				volume={footage ? 0.14 : 0.4}
			/>
		</AbsoluteFill>
	);
}
