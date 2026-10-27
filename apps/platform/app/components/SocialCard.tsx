/** Social cards decode only bundled art; creator uploads stay in the browser. */
import chestCompactSvg from "@pina-rs/lootbox-brand/assets/logo/mark-compact.svg?raw";
import chestSvg from "@pina-rs/lootbox-brand/assets/logo/mark.svg?raw";

import type { LootboxRecord } from "../lib/.server/db.js";
import { ACCENT_COLORS } from "../lib/status.js";

const svgDataUri = (svg: string) =>
	`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
/** The full mark for the big tile; the compact one survives 56 px. */
const CHEST = svgDataUri(chestSvg);
const CHEST_SMALL = svgDataUri(chestCompactSvg);

export function SocialCard({ record, status }: Readonly<{
	record: Pick<LootboxRecord, "title" | "tagline" | "accent">;
	status: string | null;
}>) {
	const [accent] = ACCENT_COLORS[record.accent] ?? ["#146f63"];

	return (
		<div
			style={{
				display: "flex",
				width: "100%",
				height: "100%",
				padding: 64,
				gap: 56,
				alignItems: "center",
				background: "#f3edda",
				color: "#1d1a14",
			}}
		>
			<div
				style={{ display: "flex", flexDirection: "column", flex: 1, gap: 24 }}
			>
				{status && (
					<div
						style={{
							display: "flex",
							alignSelf: "flex-start",
							padding: "8px 22px",
							border: "4px solid #1d1a14",
							borderRadius: 999,
							background: "#f0b429",
							fontSize: 28,
							fontWeight: 700,
						}}
					>
						{status}
					</div>
				)}
				<div
					style={{
						fontFamily: "Bungee",
						fontSize: record.title.length > 24 ? 64 : 84,
						lineHeight: 1,
						textTransform: "uppercase",
					}}
				>
					{record.title}
				</div>
				{record.tagline && (
					<div style={{ fontSize: 36, color: "#4a4336" }}>{record.tagline}</div>
				)}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 14,
						marginTop: 12,
						fontFamily: "Bungee",
						fontSize: 34,
						color: accent,
					}}
				>
					<img src={CHEST_SMALL} width={56} height={56} alt="" />
					lootbox.pina.rs
				</div>
			</div>
			<div
				style={{
					display: "flex",
					width: 420,
					height: 420,
					alignItems: "center",
					justifyContent: "center",
					border: "6px solid #1d1a14",
					borderRadius: 36,
					background: "#d3ece7",
					boxShadow: "0 12px 0 #1d1a14",
					overflow: "hidden",
				}}
			>
				<img
					src={CHEST}
					width={300}
					height={300}
					alt=""
					style={{ objectFit: "cover" }}
				/>
			</div>
		</div>
	);
}
