/** Step 1: name, symbol, description, cover art, reveal date, network. */
import { useId, useState } from "react";

import type { Cluster, ClusterInfo } from "../lib/clusters.js";
import { lootboxNameSchema, symbolSchema } from "../lib/schemas.js";
import type { DraftData } from "../lib/schemas.js";
import { formatDuration } from "../lib/status.js";
import { suggestSymbol, type WizardAction } from "./draft.js";
import type { Load } from "./hooks.js";

type Props = Readonly<{
	details: DraftData["details"];
	cluster: Cluster;
	clusters: readonly ClusterInfo[];
	locked: boolean;
	chainNow: Load<number>;
	dispatch: (action: WizardAction) => void;
}>;

const pad = (value: number) => String(value).padStart(2, "0");

/** Local calendar date and time for a Unix timestamp. */
function localParts(seconds: number): { date: string; time: string } {
	const date = new Date(seconds * 1000);

	return {
		date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${
			pad(date.getDate())
		}`,
		time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
	};
}

function fromLocalParts(date: string, time: string): number | null {
	if (!date || !time) return null;

	const value = new Date(`${date}T${time}`).getTime();

	return Number.isFinite(value) ? Math.floor(value / 1000) : null;
}

function fieldError(
	schema: typeof lootboxNameSchema | typeof symbolSchema,
	value: string,
): string | null {
	if (!value) return null;

	const result = schema.safeParse(value);

	return result.success ? null : result.error.issues[0]?.message ?? null;
}

function CoverUpload(
	{ coverKey, onChange }: Readonly<{
		coverKey: string | null;
		onChange: (key: string | null) => void;
	}>,
) {
	const id = useId();
	const [status, setStatus] = useState<string | null>(null);

	return (
		<div className="field">
			<span className="field-label" id={`${id}-label`}>Cover art</span>
			<div className="cover-drop">
				<img
					className="cover-preview"
					src={coverKey ? `/media/${coverKey}` : "/chest/chest-closed.webp"}
					alt={coverKey ? "Your cover art" : ""}
					width={96}
					height={96}
				/>
				<div className="stack">
					<input
						id={id}
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif"
						aria-labelledby={`${id}-label`}
						aria-describedby={`${id}-hint`}
						onChange={async (event) => {
							const file = event.currentTarget.files?.[0];

							if (!file) return;

							setStatus("Uploading…");

							const form = new FormData();

							form.append("file", file);

							const response = await fetch("/api/uploads", {
								method: "POST",
								body: form,
							});
							const body: unknown = await response.json();
							const key = typeof body === "object" && body !== null
								? Reflect.get(body, "key")
								: null;

							if (!response.ok || typeof key !== "string") {
								const error = typeof body === "object" && body !== null
									? Reflect.get(body, "error")
									: null;

								setStatus(typeof error === "string" ? error : "Upload failed");
								return;
							}

							onChange(key);
							setStatus("Uploaded");
						}}
					/>
					<span className="field-hint" id={`${id}-hint`} aria-live="polite">
						{status ?? "Square works best. PNG, JPEG, WebP, or GIF up to 4 MB."}
					</span>
				</div>
			</div>
		</div>
	);
}

export function DetailsStep(
	{ details, cluster, clusters, locked, chainNow, dispatch }: Props,
) {
	const nameError = fieldError(lootboxNameSchema, details.name.trim());
	const symbolError = fieldError(symbolSchema, details.symbol.trim());
	const now = chainNow.status === "ready" ? chainNow.value : null;
	const reveal = details.revealAt
		? localParts(details.revealAt)
		: { date: "", time: "" };
	const lead = details.revealAt && now !== null ? details.revealAt - now : null;
	const setReveal = (seconds: number | null) =>
		dispatch({ type: "details", patch: { revealAt: seconds } });
	const shortcuts = [
		{ label: "In 1 hour", seconds: 3_600 },
		{ label: "Tomorrow", seconds: 86_400 },
		{ label: "In a week", seconds: 7 * 86_400 },
	];

	return (
		<div className="form-grid">
			{clusters.length > 1 && (
				<fieldset className="field">
					<legend className="field-label">Network</legend>
					<div className="segmented">
						{clusters.map((info) => (
							<label key={info.cluster}>
								<input
									type="radio"
									name="cluster"
									value={info.cluster}
									checked={cluster === info.cluster}
									disabled={locked}
									onChange={() =>
										dispatch({ type: "cluster", cluster: info.cluster })}
								/>
								{info.label}
							</label>
						))}
					</div>
				</fieldset>
			)}

			<div className="form-grid two">
				<div className="field">
					<label htmlFor="name">Name</label>
					<input
						id="name"
						value={details.name}
						maxLength={40}
						autoComplete="off"
						aria-invalid={nameError ? true : undefined}
						aria-describedby="name-hint"
						onChange={(event) => {
							const name = event.currentTarget.value;
							const symbolWasSuggested = details.symbol === "" ||
								details.symbol === suggestSymbol(details.name);

							dispatch({
								type: "details",
								patch: symbolWasSuggested
									? { name, symbol: suggestSymbol(name) }
									: { name },
							});
						}}
					/>
					<span
						id="name-hint"
						className={nameError ? "form-error" : "field-hint"}
					>
						{nameError ?? "Shown in wallets. Fixed once launched."}
					</span>
				</div>
				<div className="field">
					<label htmlFor="symbol">Symbol</label>
					<input
						id="symbol"
						value={details.symbol}
						maxLength={10}
						autoComplete="off"
						aria-invalid={symbolError ? true : undefined}
						aria-describedby="symbol-hint"
						onChange={(event) =>
							dispatch({
								type: "details",
								patch: { symbol: event.currentTarget.value.toUpperCase() },
							})}
					/>
					<span
						id="symbol-hint"
						className={symbolError ? "form-error" : "field-hint"}
					>
						{symbolError ?? "The box token's ticker, like LOOT."}
					</span>
				</div>
			</div>

			<div className="field">
				<label htmlFor="description">Description</label>
				<textarea
					id="description"
					value={details.description}
					maxLength={4000}
					aria-describedby="description-hint"
					onChange={(event) =>
						dispatch({
							type: "details",
							patch: { description: event.currentTarget.value },
						})}
				/>
				<span id="description-hint" className="field-hint">
					Optional. You can change this any time. **Bold**, *italic*, lists and
					links work.
				</span>
			</div>

			<CoverUpload
				coverKey={details.coverKey}
				onChange={(coverKey) =>
					dispatch({ type: "details", patch: { coverKey } })}
			/>

			<fieldset className="field">
				<legend className="field-label">Reveal date</legend>
				<span className="field-hint">
					Boxes can be sent before this, but only opened after it. Your time
					zone: {details.timeZone}.
				</span>
				<div className="form-grid two">
					<div className="field">
						<label htmlFor="reveal-date">Date</label>
						<input
							id="reveal-date"
							type="date"
							value={reveal.date}
							onChange={(event) =>
								setReveal(
									fromLocalParts(
										event.currentTarget.value,
										reveal.time || "12:00",
									),
								)}
						/>
					</div>
					<div className="field">
						<label htmlFor="reveal-time">Time</label>
						<input
							id="reveal-time"
							type="time"
							value={reveal.time}
							onChange={(event) =>
								setReveal(
									fromLocalParts(reveal.date, event.currentTarget.value),
								)}
						/>
					</div>
				</div>
				<div className="button-row">
					{shortcuts.map((shortcut) => (
						<button
							key={shortcut.label}
							type="button"
							className="button button-small"
							disabled={now === null}
							onClick={() => now !== null && setReveal(now + shortcut.seconds)}
						>
							{shortcut.label}
						</button>
					))}
				</div>
				{lead !== null && (
					<p
						className={lead < 600 ? "form-error" : "field-hint"}
						aria-live="polite"
					>
						{lead < 600
							? "Pick a time at least 10 minutes from now so you can lock and send boxes first."
							: `Opens ${formatDuration(lead)} from now.`}
					</p>
				)}
			</fieldset>
		</div>
	);
}
