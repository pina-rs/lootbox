/**
 * Send to a list: wallets pour into the real "Send to a list" card, the exact
 * cost appears, and one tap fires a box at every wallet.
 */
import { ChestMark } from "@pina-rs/lootbox-brand";
import { ActionCard } from "@pina-rs/lootbox-ui";
import {
	AbsoluteFill,
	Easing,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

import { DEMO_WALLETS } from "../data/demo.ts";
import { enter, mix, POP, progress, SNAP } from "../kit/motion.ts";
import { Sfx } from "../kit/Sound.tsx";
import { Tap } from "../kit/Tap.tsx";

export const AIRDROP_FRAMES = 232;
const TYPE_FROM = 16;
const PER_LINE = 7;
const COST = TYPE_FROM + DEMO_WALLETS.length * PER_LINE + 6;
const SEND = COST + 34;
const FLY = SEND + 6;

export function Airdrop() {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const cardWidth = width * 0.44;
	const scale = cardWidth / 520;
	const arrive = enter(frame, 0, SNAP);
	const lines = Math.max(
		0,
		Math.min(
			DEMO_WALLETS.length,
			Math.floor((frame - TYPE_FROM) / PER_LINE) + 1,
		),
	);
	const text = DEMO_WALLETS.slice(0, lines).map((wallet) => wallet.address)
		.join("\n");
	const cost = enter(frame, COST, POP);
	const sent = frame >= FLY + 20;

	const gridLeft = width * 0.54;
	const gridTop = height * 0.18;
	const cell = width * 0.064;
	const pitch = cell * 1.36;
	const source = {
		x: width * 0.06 + cardWidth * 0.5,
		y: height * 0.1 + 600 * scale,
	};

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					left: width * 0.06,
					top: height * 0.1,
					width: 520,
					transform: `scale(${scale}) translateY(${
						mix(500, 0, Math.min(1, arrive))
					}px)`,
					transformOrigin: "top left",
				}}
			>
				<ActionCard
					kind="airdrop"
					title="Send to a list"
					summary="Paste wallets and counts. You cover delivery, so it's free to receive."
				>
					<div className="field">
						<label>Recipients</label>
						<textarea
							readOnly
							value={text}
							rows={5}
							style={{ fontFamily: "ui-monospace, monospace" }}
						/>
					</div>
					<dl
						className="cost-table"
						style={{
							opacity: Math.min(1, cost * 1.4),
							transform: `translateY(${mix(20, 0, Math.min(1, cost))}px)`,
						}}
					>
						<div>
							<dt>
								10 boxes to 10 wallets
								<small>2 transactions to sign</small>
							</dt>
							<dd />
						</div>
						<div>
							<dt>
								New box accounts
								<small>
									10 of 10 wallets need one; its rent stays with them
								</small>
							</dt>
							<dd>0.0207408 SOL</dd>
						</div>
						<div className="total">
							<dt>You pay</dt>
							<dd>0.0207508 SOL</dd>
						</div>
					</dl>
					<button
						type="button"
						className={sent ? "button" : "button button-primary"}
						style={{ position: "relative" }}
					>
						{sent ? "Sent 10 boxes ✓" : "Send 10 boxes"}
						<Tap taps={[SEND]} x="58%" y="55%" size={30} />
					</button>
				</ActionCard>
			</div>
			{DEMO_WALLETS.map((wallet, index) => {
				const column = index % 5;
				const row = Math.floor(index / 5);
				const x = gridLeft + column * pitch + cell / 2;
				const y = gridTop + row * cell * 2.1 + cell / 2;
				const appear = enter(frame, TYPE_FROM + index * PER_LINE + 2, POP);
				const launch = FLY + index * 3;
				const t = progress(frame, launch, 16, Easing.inOut(Easing.quad));
				const landed = frame >= launch + 16;
				const bx = mix(source.x, x, t);
				const by = mix(source.y, y, t) - Math.sin(t * Math.PI) * height * 0.25;

				return (
					<div key={wallet.address}>
						<div
							style={{
								position: "absolute",
								left: x - cell / 2,
								top: y - cell / 2,
								width: cell,
								height: cell,
								borderRadius: "50%",
								border: "5px solid var(--ink)",
								background: wallet.color,
								boxShadow: landed
									? "0 0 0 8px var(--gold)"
									: "0 5px 0 var(--ink)",
								transform: `scale(${
									mix(0, 1, appear) *
									(landed ? 1 + 0.15 * Math.exp(-(frame - launch - 16) / 6) : 1)
								})`,
							}}
						/>
						<span
							style={{
								position: "absolute",
								left: x - pitch / 2,
								top: y + cell * 0.62,
								width: pitch,
								textAlign: "center",
								font: `800 ${cell * 0.19}px/1 ui-monospace, monospace`,
								color: "var(--ink-soft)",
								opacity: Math.min(1, appear),
							}}
						>
							{wallet.address}
						</span>
						{frame >= launch && (
							<ChestMark
								variant="compact"
								size={cell *
									(landed ? 0.62 : mix(0.5, 0.8, Math.sin(t * Math.PI)))}
								open={landed ? 0.8 : 0}
								shadow={false}
								style={{
									position: "absolute",
									left: (landed ? x : bx) - cell * 0.31,
									top: (landed ? y - cell * 0.42 : by - cell * 0.31),
								}}
							/>
						)}
					</div>
				);
			})}
			{DEMO_WALLETS.map((_, index) => (
				<Sfx
					key={`type-${index}`}
					name="type-tick"
					at={TYPE_FROM + index * PER_LINE}
					volume={0.4}
				/>
			))}
			<Sfx name="ui-pop" at={COST} volume={0.6} />
			<Sfx name="ui-click" at={SEND} volume={0.7} />
			{DEMO_WALLETS.map((_, index) => (
				<Sfx
					key={`land-${index}`}
					name="blip-up"
					at={FLY + index * 3 + 16}
					volume={0.35}
				/>
			))}
		</AbsoluteFill>
	);
}
