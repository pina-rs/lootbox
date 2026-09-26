/**
 * `GET /og/<slug>.png`: the 1200×630 social card for a lootbox, rendered in
 * the Worker with Satori and resvg (WebAssembly). It shows the current title,
 * tagline, and status, so shared links follow the creator's edits.
 */
import { cache, GoogleFont, ImageResponse } from "@cf-wasm/og/workerd";

import { mediaUrl, services } from "../lib/.server/context.js";
import { originFor, rpcUrlFor } from "../lib/.server/env.js";
import { requireLootbox } from "../lib/.server/lootbox.js";
import { readTemplateSummaries } from "../lib/chain.js";
import { ACCENT_COLORS, lootboxStatus } from "../lib/status.js";
import type { Route } from "./+types/og";

const CHEST = `data:image/svg+xml;utf8,${
	encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M12 30c0-10 8.5-17 20-17s20 7 20 17v4H12z" fill="#146f63" stroke="#1d1a14" stroke-width="3" stroke-linejoin="round"/><rect x="12" y="30" width="40" height="22" rx="3" fill="#146f63" stroke="#1d1a14" stroke-width="3"/><path d="M12 30h40" stroke="#f0b429" stroke-width="5"/><rect x="26" y="25" width="12" height="15" rx="3" fill="#f0b429" stroke="#1d1a14" stroke-width="2.5"/><circle cx="32" cy="31" r="2.2" fill="#1d1a14"/></svg>`,
	)
}`;

async function statusLabel(
	app: ReturnType<typeof services>,
	record: Awaited<ReturnType<typeof requireLootbox>>,
): Promise<string | null> {
	try {
		const [summary] = await readTemplateSummaries(
			await rpcUrlFor(app.config, record.cluster),
			[record.template],
		);

		return summary ? lootboxStatus(summary).label : null;
	} catch (error) {
		// A card without a status chip beats no card at all.
		console.error("og status read failed", error);

		return null;
	}
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
	const slug = /^(.+)\.png$/.exec(params.file)?.[1];
	const app = services(context);
	const record = await requireLootbox(app, slug);
	const origin = originFor(app.config, request);
	const status = await statusLabel(app, record);
	const [accent] = ACCENT_COLORS[record.accent] ?? ["#146f63"];
	// resvg decodes PNG and JPEG; other uploads fall back to the chest.
	const cover = record.coverKey && /\.(png|jpg)$/.test(record.coverKey)
		? mediaUrl(origin, record.coverKey)
		: null;

	cache.setExecutionContext(context.cloudflare.ctx);

	return ImageResponse.async(
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
					<img src={CHEST} width={56} height={56} alt="" />
					lootbox.so
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
					src={cover ?? CHEST}
					width={cover ? 420 : 300}
					height={cover ? 420 : 300}
					alt=""
					style={{ objectFit: "cover" }}
				/>
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
			fonts: [new GoogleFont("Bungee", { name: "Bungee" })],
			headers: { "Cache-Control": "public, max-age=600" },
		},
	);
}
