/**
 * `/l/:slug/manage`: the creator's controls. Display copy is always editable
 * (D1); prizes can be appended until the supply is locked; after that the
 * on-chain terms are fixed and only distribution and wind-down remain.
 */
import { LootboxClient } from "@pina-rs/lootbox";
import {
	getCreateAssociatedTokenIdempotentInstruction,
	getTransferCheckedInstruction,
} from "@solana-program/token-2022";
import { address, type Instruction, isAddress } from "@solana/kit";
import { useWalletAccountTransactionSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { useState } from "react";
import {
	Form,
	useActionData,
	useNavigation,
	useRevalidator,
} from "react-router";
import { friendlyError } from "../lib/errors.js";

import { TxProgress, useTxProgress } from "../components/TxProgress.js";
import { BundlesStep } from "../create/BundlesStep.js";
import { useHoldings } from "../create/hooks.js";
import { prizeInputs } from "../create/launch.js";
import { currentWallet } from "../lib/.server/auth.js";
import {
	assertSameOrigin,
	errorResponse,
	nowSeconds,
	services,
} from "../lib/.server/context.js";
import {
	recentRelayerEvents,
	updateDisplay,
	uploadOwner,
} from "../lib/.server/db.js";
import {
	readChain,
	requireCreator,
	requireLootbox,
} from "../lib/.server/lootbox.js";
import { shortAddress } from "../lib/bytes.js";
import type { LootboxChainView } from "../lib/chain.js";
import { chainFor, type ClusterInfo } from "../lib/clusters.js";
import { batches, parseDistribution } from "../lib/distribution.js";
import { checkPlan, draftBundlesToInputs } from "../lib/plan.js";
import { useClusterInfo } from "../lib/public-config.js";
import {
	ACCENTS,
	displaySchema,
	type DraftBundle,
	firstIssue,
} from "../lib/schemas.js";
import { formatDuration } from "../lib/status.js";
import { RequireSignIn, useSession } from "../wallet/session.js";
import type { Route } from "./+types/lootbox.manage";
import { useLootbox } from "./lootbox.js";

export async function loader({ request, params, context }: Route.LoaderArgs) {
	const app = services(context);
	const record = await requireLootbox(app, params.slug);
	const wallet = await currentWallet(app.db, request, nowSeconds());

	if (wallet !== record.creator) {
		return {
			access: wallet ? "forbidden" as const : "signin" as const,
			events: [],
		};
	}

	const chain = await readChain(app, record);

	// Security: D1 says who created the page; the chain says who controls it.
	if (chain.status === "ok" && chain.view.authority !== wallet) {
		return { access: "forbidden" as const, events: [] };
	}

	return {
		access: "creator" as const,
		events: await recentRelayerEvents(app.db, record.id),
	};
}

export async function action({ request, params, context }: Route.ActionArgs) {
	assertSameOrigin(request);

	const app = services(context);
	const record = await requireLootbox(app, params.slug);
	const { wallet } = await requireCreator(app, request, record);
	const form = await request.formData();
	const links = [0, 1, 2, 3, 4].flatMap((index) => {
		const label = String(form.get(`link-label-${index}`) ?? "").trim();
		const url = String(form.get(`link-url-${index}`) ?? "").trim();

		return label || url ? [{ label, url }] : [];
	});
	const coverRaw = String(form.get("coverKey") ?? "");
	const parsed = displaySchema.safeParse({
		title: form.get("title"),
		tagline: form.get("tagline") ?? "",
		descriptionMd: form.get("descriptionMd") ?? "",
		coverKey: coverRaw || null,
		accent: form.get("accent"),
		links,
		visibility: form.get("visibility"),
	});

	if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

	const cover = parsed.data.coverKey;

	// A cover must be this lootbox's current one or an upload by this wallet.
	if (
		cover && cover !== record.coverKey &&
		(await uploadOwner(app.db, cover)) !== wallet
	) {
		throw errorResponse(403, "That image belongs to someone else");
	}

	await updateDisplay(app.db, record.id, parsed.data, nowSeconds());

	return { ok: true, error: null };
}

export default function Manage({ loaderData }: Route.ComponentProps) {
	const { account } = useSession();

	if (loaderData.access === "signin") {
		return (
			<RequireSignIn why="Sign in with the creator wallet to manage this lootbox.">
				<p>Signed in.</p>
			</RequireSignIn>
		);
	}

	if (loaderData.access === "forbidden") {
		return (
			<p className="notice" role="alert">
				Only the creator's wallet can manage this lootbox. Switch to that wallet
				and sign in again.
			</p>
		);
	}

	return <CreatorTools account={account ?? null} events={loaderData.events} />;
}

function CreatorTools(
	{ account, events }: Readonly<{
		account: UiWalletAccount | null;
		events: readonly Readonly<
			{ opening: string; kind: string; message: string; createdAt: number }
		>[];
	}>,
) {
	const { lootbox, chain, now } = useLootbox();
	const cluster = useClusterInfo(lootbox.cluster);
	const wrongWallet = account !== null && account.address !== lootbox.creator;

	return (
		<div className="two-col">
			<div className="stack">
				<DisplayForm />
			</div>
			<div className="stack">
				{chain && <ChainStatus chain={chain} now={now} events={events} />}
				{wrongWallet && (
					<p className="notice" role="alert">
						Your connected wallet ({shortAddress(account.address)}) is not the
						creator. Switch wallets to sign on-chain actions.
					</p>
				)}
				{chain && cluster && account && !wrongWallet && (
					<ChainActions
						account={account}
						cluster={cluster}
						chain={chain}
						now={now}
					/>
				)}
				{!account && (
					<p className="notice">
						Connect the creator wallet to use on-chain actions.
					</p>
				)}
			</div>
		</div>
	);
}

function DisplayForm() {
	const { lootbox } = useLootbox();
	const result = useActionData<typeof action>();
	const navigation = useNavigation();
	const [coverKey, setCoverKey] = useState(lootbox.coverKey ?? "");
	const [upload, setUpload] = useState<string | null>(null);
	const saving = navigation.state === "submitting";

	return (
		<Form method="post" className="card stack" aria-labelledby="display-title">
			<div className="section-head">
				<h2 id="display-title">Page details</h2>
				<span className="chip">Editable any time</span>
			</div>
			<div className="field">
				<label htmlFor="title">Title</label>
				<input
					id="title"
					name="title"
					defaultValue={lootbox.title}
					maxLength={60}
					required
				/>
			</div>
			<div className="field">
				<label htmlFor="tagline">Tagline</label>
				<input
					id="tagline"
					name="tagline"
					defaultValue={lootbox.tagline}
					maxLength={120}
				/>
			</div>
			<div className="field">
				<label htmlFor="descriptionMd">Description</label>
				<textarea
					id="descriptionMd"
					name="descriptionMd"
					defaultValue={lootbox.descriptionMd}
					maxLength={4000}
				/>
				<span className="field-hint">
					**Bold**, *italic*, - lists and [links](https://…) work.
				</span>
			</div>
			<div className="field">
				<label htmlFor="cover-file">Cover art</label>
				<input type="hidden" name="coverKey" value={coverKey} />
				<input
					id="cover-file"
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					onChange={async (event) => {
						const file = event.currentTarget.files?.[0];

						if (!file) {
							return;
						}

						setUpload("Uploading…");

						const body = new FormData();

						body.append("file", file);

						const response = await fetch("/api/uploads", {
							method: "POST",
							body,
						});
						const json: unknown = await response.json();
						const key = typeof json === "object" && json !== null
							? Reflect.get(json, "key")
							: null;

						if (response.ok && typeof key === "string") {
							setCoverKey(key);
							setUpload("Uploaded. Save to publish it.");
						} else {
							setUpload("Upload failed.");
						}
					}}
				/>
				{upload && (
					<span className="field-hint" aria-live="polite">{upload}</span>
				)}
			</div>
			<fieldset className="field">
				<legend className="field-label">Colour</legend>
				<div className="segmented">
					{ACCENTS.map((accent) => (
						<label key={accent}>
							<input
								type="radio"
								name="accent"
								value={accent}
								defaultChecked={lootbox.accent === accent}
							/>
							{accent[0]?.toUpperCase()}
							{accent.slice(1)}
						</label>
					))}
				</div>
			</fieldset>
			<fieldset className="field">
				<legend className="field-label">Links</legend>
				{[0, 1, 2].map((index) => (
					<div key={index} className="form-grid two">
						<input
							name={`link-label-${index}`}
							aria-label={`Link ${index + 1} label`}
							placeholder="Label"
							defaultValue={lootbox.links[index]?.label ?? ""}
						/>
						<input
							name={`link-url-${index}`}
							type="url"
							aria-label={`Link ${index + 1} URL`}
							placeholder="https://"
							defaultValue={lootbox.links[index]?.url ?? ""}
						/>
					</div>
				))}
			</fieldset>
			<fieldset className="field">
				<legend className="field-label">Visibility</legend>
				<div className="segmented">
					<label>
						<input
							type="radio"
							name="visibility"
							value="public"
							defaultChecked={lootbox.visibility === "public"}
						/>
						Public
					</label>
					<label>
						<input
							type="radio"
							name="visibility"
							value="unlisted"
							defaultChecked={lootbox.visibility === "unlisted"}
						/>
						Unlisted
					</label>
				</div>
				<span className="field-hint">
					Unlisted pages work by link but stay out of Explore.
				</span>
			</fieldset>
			<button type="submit" className="button button-primary" disabled={saving}>
				{saving ? "Saving…" : "Save changes"}
			</button>
			<p aria-live="polite" role="status">
				{result?.ok
					? "Saved. Your page and wallet metadata now show this."
					: result?.error ?? ""}
			</p>
		</Form>
	);
}

function ChainStatus(
	{ chain, now, events }: Readonly<{
		chain: LootboxChainView;
		now: number;
		events: readonly Readonly<
			{ opening: string; kind: string; message: string; createdAt: number }
		>[];
	}>,
) {
	return (
		<section className="card" aria-labelledby="chain-title">
			<div className="section-head">
				<h2 id="chain-title">On chain</h2>
				<span
					className="chip"
					data-tone={chain.lockedAt > 0 ? "done" : "setup"}
					data-testid="lock-state"
				>
					{chain.lockedAt > 0
						? "Locked"
						: chain.status === "live"
						? "Live, not locked"
						: chain.status}
				</span>
			</div>
			<div className="stat-row">
				<div className="stat">
					<b>{BigInt(chain.totalBundles).toLocaleString("en-US")}</b>
					<span>prize copies</span>
				</div>
				<div className="stat">
					<b data-testid="supply">
						{BigInt(chain.supply).toLocaleString("en-US")}
					</b>
					<span>boxes minted</span>
				</div>
				<div className="stat">
					<b>{BigInt(chain.pendingOpenings).toLocaleString("en-US")}</b>
					<span>opening now</span>
				</div>
			</div>
			<p className="muted">
				{now < chain.opensAt
					? `Reveal in ${formatDuration(chain.opensAt - now)}.`
					: "Reveal date has passed."}
			</p>
			{events.length > 0 && (
				<>
					<h3>Relayer activity</h3>
					<ul className="fine">
						{events.map((event) => (
							<li key={`${event.opening}-${event.createdAt}-${event.kind}`}>
								{new Date(event.createdAt * 1000).toLocaleString()}:{" "}
								{event.kind} {shortAddress(event.opening)} {event.message}
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
}

function ChainActions(
	{ account, cluster, chain, now }: Readonly<{
		account: UiWalletAccount;
		cluster: ClusterInfo;
		chain: LootboxChainView;
		now: number;
	}>,
) {
	const { lootbox } = useLootbox();
	const signer = useWalletAccountTransactionSigner(
		account,
		chainFor(cluster.cluster),
	);
	const revalidator = useRevalidator();
	const { steps, progress, reset } = useTxProgress();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const client = new LootboxClient(cluster.rpcUrl, signer, progress);
	const locked = chain.lockedAt > 0;
	const beforeReveal = now < chain.opensAt;

	const run = async (work: () => Promise<void>) => {
		setBusy(true);
		setError(null);
		reset();

		try {
			await work();
		} catch (reason) {
			setError(friendlyError(reason));
		} finally {
			setBusy(false);
			await revalidator.revalidate();
		}
	};

	return (
		<>
			{!locked && chain.status === "live" && beforeReveal && (
				<AppendBundles
					client={client}
					cluster={cluster}
					account={account}
					busy={busy}
					run={run}
				/>
			)}
			{!locked && chain.status === "live" && (
				<LockPanel
					client={client}
					chain={chain}
					owner={account.address}
					beforeReveal={beforeReveal}
					busy={busy}
					run={run}
				/>
			)}
			{locked && BigInt(chain.supply) > 0n && (
				<DistributePanel
					client={client}
					boxMint={lootbox.boxMint}
					owner={account.address}
					busy={busy}
					run={run}
				/>
			)}
			<WindDown
				client={client}
				chain={chain}
				busy={busy}
				run={run}
				beforeReveal={beforeReveal}
			/>
			{(steps.length > 0 || error) && (
				<div className="card stack">
					<TxProgress steps={steps} cluster={cluster} busy={busy} />
					{error && <p className="form-error" role="alert">{error}</p>}
				</div>
			)}
		</>
	);
}

type Run = (work: () => Promise<void>) => Promise<void>;

function AppendBundles(
	{ client, cluster, account, busy, run }: Readonly<{
		client: LootboxClient;
		cluster: ClusterInfo;
		account: UiWalletAccount;
		busy: boolean;
		run: Run;
	}>,
) {
	const { lootbox } = useLootbox();
	const [bundles, setBundles] = useState<readonly DraftBundle[]>([]);
	const [holdings, refreshHoldings] = useHoldings(
		cluster.rpcUrl,
		account.address,
	);
	const [open, setOpen] = useState(false);
	const check = bundles.length === 0 ? null : checkPlan({
		name: "Append",
		uri: "",
		opensAt: 0n,
		bundles: draftBundlesToInputs(bundles, (mint) => mint),
	});

	if (!open) {
		return (
			<section className="card stack" aria-labelledby="append-title">
				<h2 id="append-title">Add prizes</h2>
				<p className="muted">
					Until you lock, you can append new bundles. Existing bundles never
					change.
				</p>
				<button type="button" className="button" onClick={() => setOpen(true)}>
					Add a bundle
				</button>
			</section>
		);
	}

	return (
		<section className="card stack" aria-labelledby="append-title">
			<h2 id="append-title">Add prizes</h2>
			<BundlesStep
				account={account}
				bundles={bundles}
				cluster={cluster.cluster}
				holdings={holdings}
				onRefreshHoldings={refreshHoldings}
				problem={check && !check.ok ? check.message : null}
				dispatch={(action) => {
					if (action.type === "bundles") setBundles(action.bundles);
				}}
			/>
			<button
				type="button"
				className="button button-primary"
				disabled={busy || !check?.ok ||
					bundles.some((bundle) => bundle.assets.length === 0)}
				onClick={() =>
					void run(async () => {
						const template = await client.template(address(lootbox.template));
						const start = template.data.bundleCount;
						await client.appendBundles(
							template,
							await prizeInputs(client, bundles),
							start,
						);

						const response = await fetch(
							`/api/lootboxes/${lootbox.slug}/bundles`,
							{
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									labels: bundles.map((bundle, offset) => ({
										index: start + offset,
										label: bundle.label,
										assets: bundle.assets,
									})),
								}),
							},
						);

						if (!response.ok) {
							throw new Error(
								"Prizes added on chain, but their labels were not saved",
							);
						}

						setBundles([]);
						setOpen(false);
					})}
			>
				Fund and add {bundles.length === 1 ? "bundle" : "bundles"}
			</button>
		</section>
	);
}

function LockPanel(
	{ client, chain, owner, beforeReveal, busy, run }: Readonly<{
		client: LootboxClient;
		chain: LootboxChainView;
		owner: string;
		beforeReveal: boolean;
		busy: boolean;
		run: Run;
	}>,
) {
	const [recipient, setRecipient] = useState(owner);
	const [confirmed, setConfirmed] = useState(false);
	const valid = isAddress(recipient.trim());
	const toMint = BigInt(chain.totalBundles) - BigInt(chain.supply);

	return (
		<section className="card stack" aria-labelledby="lock-title">
			<h2 id="lock-title">Lock and mint boxes</h2>
			<p>
				Locking mints exactly{" "}
				<strong>{BigInt(chain.totalBundles).toLocaleString("en-US")}</strong>
				{" "}
				boxes, one per prize copy, and then no more can ever be minted or added.
				{toMint > 0n &&
					` ${toMint.toLocaleString("en-US")} will be minted now.`}
			</p>
			{!beforeReveal && (
				<p className="form-error">
					The reveal date has passed, so this lootbox can no longer be locked.
				</p>
			)}
			<div className="field">
				<label htmlFor="lock-recipient">Send the boxes to</label>
				<input
					id="lock-recipient"
					value={recipient}
					spellCheck={false}
					onChange={(event) => setRecipient(event.currentTarget.value)}
				/>
				<span className="field-hint">
					Usually your own wallet, so you can hand them out.
				</span>
			</div>
			<label className="check">
				<input
					type="checkbox"
					checked={confirmed}
					onChange={(event) => setConfirmed(event.currentTarget.checked)}
				/>
				I understand locking is permanent: no more prizes, no more boxes.
			</label>
			<button
				type="button"
				className="button button-primary"
				disabled={busy || !valid || !confirmed || !beforeReveal}
				onClick={() =>
					void run(async () => {
						const template = await client.template(address(chain.template));

						await client.lockTreasury(template, address(recipient.trim()));
					})}
			>
				Lock and mint {BigInt(chain.totalBundles).toLocaleString("en-US")} boxes
			</button>
		</section>
	);
}

function DistributePanel(
	{ client, boxMint, owner, busy, run }: Readonly<{
		client: LootboxClient;
		boxMint: string;
		owner: string;
		busy: boolean;
		run: Run;
	}>,
) {
	const [text, setText] = useState("");
	const [sent, setSent] = useState<string | null>(null);
	const plan = parseDistribution(text);

	return (
		<section className="card stack" aria-labelledby="distribute-title">
			<h2 id="distribute-title">Send boxes</h2>
			<div className="field">
				<label htmlFor="distribution">Recipients</label>
				<textarea
					id="distribution"
					value={text}
					placeholder={"One wallet per line, optionally with a count:\n7xKX…q9 3"}
					spellCheck={false}
					onChange={(event) => setText(event.currentTarget.value)}
				/>
				<span className="field-hint">
					Paste a list or a CSV. {plan.recipients.length > 0 &&
						`${
							plan.total.toLocaleString("en-US")
						} boxes to ${plan.recipients.length} wallets.`}
				</span>
			</div>
			{plan.errors.length > 0 && (
				<ul className="form-error">
					{plan.errors.slice(0, 5).map((problem) => (
						<li key={problem}>{problem}</li>
					))}
				</ul>
			)}
			<button
				type="button"
				className="button button-primary"
				disabled={busy || plan.recipients.length === 0 ||
					plan.errors.length > 0}
				onClick={() =>
					void run(async () => {
						const mint = address(boxMint);
						const source = await client.ata(address(owner), mint);
						const groups = batches(plan.recipients);

						for (const [index, group] of groups.entries()) {
							const instructions: Instruction[] = [];

							for (const recipient of group) {
								const destination = await client.ata(
									address(recipient.address),
									mint,
								);

								instructions.push(
									getCreateAssociatedTokenIdempotentInstruction({
										payer: client.payer,
										ata: destination,
										owner: address(recipient.address),
										mint,
									}),
									getTransferCheckedInstruction({
										source,
										mint,
										destination,
										authority: client.payer,
										amount: recipient.count,
										decimals: 0,
									}),
								);
							}

							await client.send(
								instructions,
								`Send boxes · batch ${index + 1} of ${groups.length}`,
							);
						}

						setSent(`Sent ${plan.total} boxes.`);
						setText("");
					})}
			>
				Send {plan.total > 0n ? plan.total.toLocaleString("en-US") : ""} boxes
			</button>
			{sent && <p className="notice" role="status" data-testid="sent">{sent}
			</p>}
		</section>
	);
}

function WindDown(
	{ client, chain, busy, run, beforeReveal }: Readonly<{
		client: LootboxClient;
		chain: LootboxChainView;
		busy: boolean;
		run: Run;
		beforeReveal: boolean;
	}>,
) {
	const locked = chain.lockedAt > 0;
	const issuedUnlocked = !locked && BigInt(chain.totalMinted) > 0n;
	const canRetire = chain.status === "live" &&
		!(issuedUnlocked && beforeReveal);
	const drained = BigInt(chain.supply) === 0n &&
		BigInt(chain.pendingOpenings) === 0n;

	return (
		<section className="card stack" aria-labelledby="wind-title">
			<h2 id="wind-title">Retire</h2>
			<p className="muted">
				Retiring stops all creator changes for good. Holders can still open
				their boxes. Unwon prizes can be reclaimed only after every box is
				opened or burned.
			</p>
			{chain.status === "retired"
				? (
					<button
						type="button"
						className="button"
						disabled={busy || !drained}
						onClick={() =>
							void run(async () => {
								await client.closeServiceVault(
									await client.template(address(chain.template)),
								);
							})}
					>
						Recover unused service funding
					</button>
				)
				: (
					<button
						type="button"
						className="button button-danger"
						disabled={busy || !canRetire}
						onClick={() =>
							void run(async () => {
								await client.retireTemplate(
									await client.template(address(chain.template)),
								);
							})}
					>
						Retire lootbox
					</button>
				)}
			{!canRetire && chain.status === "live" && (
				<p className="fine">
					Boxes are minted but not locked, so retiring waits until the reveal
					date.
				</p>
			)}
		</section>
	);
}
