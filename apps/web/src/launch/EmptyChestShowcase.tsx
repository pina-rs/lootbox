import type { Rive } from "@rive-app/canvas";
import { useEffect, useRef, useState } from "react";

import { assetUrl } from "./assets.js";
import {
	type EmptyChest,
	emptyChestFor,
	type EmptyChestManifest,
	emptyChestName,
	parseEmptyChestManifest,
} from "./emptyChests.js";

/** Reads the compressed asset a PrizePool assigned to an opening, if any. */
export type ResolveEmptyChestAsset = (
	opening: string,
) => Promise<string | null>;

type Props = Readonly<{
	opening: string;
	reducedMotion: boolean;
	resolveAsset: ResolveEmptyChestAsset | null;
}>;

type Playback = "poster" | "loading" | "playing" | "failed";

const base = assetUrl("nft/empty-chest");

/**
 * The minted asset → variant manifest. A series without minted chests (the
 * badge flow) has none, which is expected rather than an error.
 */
async function loadManifest(): Promise<EmptyChestManifest | null> {
	const response = await fetch(`${base}/assets.json`);

	// A dev server answers a missing file with the SPA page, so require JSON.
	if (!response.ok || !response.headers.get("content-type")?.includes("json")) {
		return null;
	}

	return parseEmptyChestManifest(await response.json());
}

/** Resolve the chest for an opening; lookups that fail degrade to the stand-in. */
async function resolveChest(
	opening: string,
	resolveAsset: ResolveEmptyChestAsset | null,
): Promise<EmptyChest> {
	const [manifest, assetId] = await Promise.all([
		loadManifest().catch((reason: unknown) => {
			console.warn("Empty Chest manifest unavailable", reason);
			return null;
		}),
		resolveAsset
			? resolveAsset(opening).catch((reason: unknown) => {
				console.warn("Empty Chest asset lookup failed", reason);
				return null;
			})
			: Promise.resolve(null),
	]);

	return emptyChestFor(opening, assetId, manifest);
}

/**
 * The Empty Chest collectible won with an empty box, playing its Rive reveal.
 *
 * Lazy-loaded with the Rive runtime so stock prizes never download either.
 * The poster is always underneath: it is the reduced-motion view and the
 * fallback if the runtime or file fails.
 */
export default function EmptyChestShowcase(
	{ opening, reducedMotion, resolveAsset }: Props,
) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const [chest, setChest] = useState<EmptyChest | null>(null);
	const [playback, setPlayback] = useState<Playback>("poster");

	useEffect(() => {
		let current = true;

		setChest(null);
		void resolveChest(opening, resolveAsset).then((value) => {
			if (current) setChest(value);
		});

		return () => {
			current = false;
		};
	}, [opening, resolveAsset]);

	const variant = chest?.variant ?? null;

	useEffect(() => {
		if (variant === null || reducedMotion || !canvas.current) {
			setPlayback("poster");
			return;
		}

		const target = canvas.current;
		let disposed = false;
		let player: Rive | undefined;
		let observer: ResizeObserver | undefined;
		const fail = (reason: unknown) => {
			if (disposed) return;
			console.error("Empty Chest animation unavailable", reason);
			setPlayback("failed");
		};

		setPlayback("loading");

		async function start(chosen: number) {
			const [
				{ Rive, Layout, Fit, Alignment, RuntimeLoader },
				{ default: wasmUrl },
			] = await Promise.all([
				import("@rive-app/canvas"),
				import("@rive-app/canvas/rive.wasm?url"),
			]);

			if (disposed) return;

			RuntimeLoader.setWasmUrl(wasmUrl);
			RuntimeLoader.setWasmFallbackUrl(null);
			player = new Rive({
				canvas: target,
				src: `${base}/empty-chest.riv`,
				artboard: "Empty chest",
				stateMachine: "Empty chest",
				autoplay: true,
				autoBind: true,
				layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
				onLoad: () => {
					if (disposed || !player) return;

					const data = player.viewModelInstance;
					const number = data?.number("variant");

					if (!data || !number) {
						fail(new Error("Empty Chest file has no variant property"));
						return;
					}

					player.resizeDrawingSurfaceToCanvas();
					number.value = chosen;
					data.trigger("reveal")?.trigger();
					setPlayback("playing");
				},
				onLoadError: fail,
			});
			observer = new ResizeObserver(() =>
				player?.resizeDrawingSurfaceToCanvas()
			);
			observer.observe(target);
		}

		void start(variant).catch(fail);

		return () => {
			disposed = true;
			observer?.disconnect();
			player?.cleanup();
		};
	}, [variant, reducedMotion]);

	return (
		<figure
			className="empty-chest"
			data-testid="empty-chest"
			data-variant={variant ?? undefined}
			data-playback={playback}
		>
			<div className="empty-chest__art" aria-hidden="true">
				{chest && (
					<img
						src={`${base}/${chest.variant}.png`}
						width={1024}
						height={1024}
						alt=""
						data-testid="empty-chest-poster"
					/>
				)}
				{!reducedMotion && (
					<canvas
						ref={canvas}
						className={playback === "playing" ? "is-playing" : ""}
						data-testid="empty-chest-canvas"
					/>
				)}
			</div>
			<figcaption>
				{chest
					? (
						<>
							<strong>{emptyChestName(chest)}</strong>
							<span>{chest.line}</span>
						</>
					)
					: <span>Checking what the chest kept…</span>}
			</figcaption>
		</figure>
	);
}
