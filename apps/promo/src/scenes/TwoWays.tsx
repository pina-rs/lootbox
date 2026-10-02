/**
 * "Two ways to hand them out": the headline, then the two paths as the
 * site's own action cards, side by side.
 */
import { ActionCard, CurveChart } from "@pina-rs/lootbox-ui";

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DEMO_CURVE, DEMO_WALLETS } from "../data/demo.ts";

import { BOUNCE, enter, mix } from "../kit/motion.ts";
import { Sfx } from "../kit/Sound.tsx";
import { Headline } from "../kit/Type.tsx";

export function TwoWays({ beat = 14.5 }: Readonly<{ beat?: number }>) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const cardAt = [beat * 8, beat * 11] as const;
	const cardWidth = width * 0.4;
	const scale = cardWidth / 440;

	return (
		<AbsoluteFill>
			<div
				style={{ position: "absolute", top: height * 0.12, left: 0, right: 0 }}
			>
				<Headline
					words={["Two", "ways", "to", {
						text: "hand them out",
						underline: true,
					}]}
					at={beat}
					stagger={beat}
					size={height * 0.1}
					width={width}
				/>
			</div>
			{([
				[
					"airdrop",
					"1 · Send to a list",
					"Paste wallets. You cover delivery, so it's free to receive.",
				],
				[
					"curve",
					"2 · Sell on a curve",
					"Each box a little dearer than the last. Sell back until it sells out.",
				],
			] as const).map(([kind, title, summary], index) => {
				const t = enter(frame, cardAt[index] ?? 0, BOUNCE);

				return (
					<div
						key={kind}
						style={{
							position: "absolute",
							left: index === 0 ? width * 0.07 : width * 0.53,
							top: height * 0.34,
							width: 440,
							transform: `scale(${scale * mix(0.5, 1, t)}) rotate(${
								mix(index === 0 ? -8 : 8, index === 0 ? -1.5 : 1.5, t)
							}deg)`,
							transformOrigin: "top left",
							opacity: Math.min(1, t * 1.6),
						}}
					>
						<ActionCard kind={kind} title={title} summary={summary}>
							{kind === "airdrop"
								? (
									<ul
										style={{
											display: "grid",
											gap: 8,
											margin: 0,
											padding: 0,
											listStyle: "none",
										}}
									>
										{DEMO_WALLETS.slice(0, 4).map((wallet) => (
											<li
												key={wallet.address}
												style={{
													display: "flex",
													alignItems: "center",
													gap: 10,
													padding: "6px 10px",
													border: "2px solid var(--line)",
													borderRadius: 10,
													background: "var(--white)",
													font: "700 15px/1 ui-monospace, monospace",
												}}
											>
												<span
													style={{
														width: 18,
														height: 18,
														borderRadius: "50%",
														border: "2px solid var(--ink)",
														background: wallet.color,
													}}
												/>
												{wallet.address}
												<b
													style={{
														marginLeft: "auto",
														fontFamily: "var(--body)",
													}}
												>
													1 box
												</b>
											</li>
										))}
									</ul>
								)
								: (
									<CurveChart
										inventory={DEMO_CURVE.inventory}
										sold={7}
										startPrice={DEMO_CURVE.startPrice}
										priceStep={DEMO_CURVE.priceStep}
									/>
								)}
						</ActionCard>
					</div>
				);
			})}
			<Sfx name="ui-pop" at={cardAt[0]} volume={0.6} />
			<Sfx name="ui-pop" at={cardAt[1]} volume={0.6} />
		</AbsoluteFill>
	);
}
