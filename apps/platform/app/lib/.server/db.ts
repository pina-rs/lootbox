/**
 * Typed D1 queries. Every SQL statement in the app lives here.
 *
 * Rows are mapped to camelCase records at this boundary, and JSON columns are
 * re-validated on read so a hand-edited row cannot crash a page.
 */
import type { Cluster } from "../clusters.js";
import { parseCluster } from "../clusters.js";
import {
	type BundleLabel,
	bundleLabelSchema,
	type DraftData,
	draftDataSchema,
	linkSchema,
} from "../schemas.js";

export type Visibility = "public" | "unlisted";

export type LootboxRecord = Readonly<{
	id: number;
	slug: string;
	cluster: Cluster;
	template: string;
	boxMint: string;
	creator: string;
	title: string;
	symbol: string;
	tagline: string;
	descriptionMd: string;
	coverKey: string | null;
	accent: string;
	links: readonly Readonly<{ label: string; url: string }>[];
	visibility: Visibility;
	bundles: readonly BundleLabel[];
	createdAt: number;
	updatedAt: number;
}>;

type LootboxRow = {
	id: number;
	slug: string;
	cluster: string;
	template: string;
	box_mint: string;
	creator: string;
	title: string;
	symbol: string;
	tagline: string;
	description_md: string;
	cover_key: string | null;
	accent: string;
	links_json: string;
	visibility: string;
	bundles_json: string;
	created_at: number;
	updated_at: number;
};

function parseJsonArray<T>(
	text: string,
	parse: (value: unknown) => T | null,
): T[] {
	const value: unknown = JSON.parse(text);

	if (!Array.isArray(value)) return [];

	return value.map(parse).filter((item): item is T => item !== null);
}

function toLootbox(row: LootboxRow): LootboxRecord {
	return {
		id: row.id,
		slug: row.slug,
		cluster: parseCluster(row.cluster) ?? "devnet",
		template: row.template,
		boxMint: row.box_mint,
		creator: row.creator,
		title: row.title,
		symbol: row.symbol,
		tagline: row.tagline,
		descriptionMd: row.description_md,
		coverKey: row.cover_key,
		accent: row.accent,
		links: parseJsonArray(row.links_json, (value) => {
			const result = linkSchema.safeParse(value);

			return result.success ? result.data : null;
		}),
		visibility: row.visibility === "unlisted" ? "unlisted" : "public",
		bundles: parseJsonArray(row.bundles_json, (value) => {
			const result = bundleLabelSchema.safeParse(value);

			return result.success ? result.data : null;
		}),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function lootboxBySlug(
	db: D1Database,
	slug: string,
): Promise<LootboxRecord | null> {
	const row = await db.prepare("SELECT * FROM lootboxes WHERE slug = ?")
		.bind(slug).first<LootboxRow>();

	return row ? toLootbox(row) : null;
}

export async function lootboxByBoxMint(
	db: D1Database,
	boxMint: string,
): Promise<LootboxRecord | null> {
	const row = await db.prepare("SELECT * FROM lootboxes WHERE box_mint = ?")
		.bind(boxMint).first<LootboxRow>();

	return row ? toLootbox(row) : null;
}

export async function lootboxByTemplate(
	db: D1Database,
	cluster: Cluster,
	template: string,
): Promise<LootboxRecord | null> {
	const row = await db.prepare(
		"SELECT * FROM lootboxes WHERE cluster = ? AND template = ?",
	).bind(cluster, template).first<LootboxRow>();

	return row ? toLootbox(row) : null;
}

export async function publicLootboxes(
	db: D1Database,
	options: Readonly<{ query: string; limit: number }>,
): Promise<LootboxRecord[]> {
	const pattern = `%${options.query.replace(/[%_\\]/g, "\\$&")}%`;
	const { results } = await db.prepare(
		`SELECT * FROM lootboxes
		WHERE visibility = 'public'
			AND (? = '' OR title LIKE ? ESCAPE '\\' OR tagline LIKE ? ESCAPE '\\')
		ORDER BY created_at DESC
		LIMIT ?`,
	).bind(options.query, pattern, pattern, options.limit).all<LootboxRow>();

	return results.map(toLootbox);
}

export async function lootboxesByCreator(
	db: D1Database,
	creator: string,
): Promise<LootboxRecord[]> {
	const { results } = await db.prepare(
		"SELECT * FROM lootboxes WHERE creator = ? ORDER BY created_at DESC LIMIT 50",
	).bind(creator).all<LootboxRow>();

	return results.map(toLootbox);
}

/** Lootboxes on the given clusters, for the relayer. */
export async function lootboxesOnClusters(
	db: D1Database,
	clusters: readonly Cluster[],
): Promise<LootboxRecord[]> {
	if (clusters.length === 0) return [];

	const placeholders = clusters.map(() => "?").join(", ");
	const { results } = await db.prepare(
		`SELECT * FROM lootboxes WHERE cluster IN (${placeholders}) ORDER BY id`,
	).bind(...clusters).all<LootboxRow>();

	return results.map(toLootbox);
}

export type NewLootbox = Readonly<{
	slug: string;
	cluster: Cluster;
	template: string;
	boxMint: string;
	creator: string;
	title: string;
	symbol: string;
	descriptionMd: string;
	coverKey: string | null;
	bundles: readonly BundleLabel[];
}>;

export async function insertLootbox(
	db: D1Database,
	lootbox: NewLootbox,
	now: number,
): Promise<void> {
	await db.prepare(
		`INSERT INTO lootboxes (slug, cluster, template, box_mint, creator, title,
			symbol, description_md, cover_key, bundles_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).bind(
		lootbox.slug,
		lootbox.cluster,
		lootbox.template,
		lootbox.boxMint,
		lootbox.creator,
		lootbox.title,
		lootbox.symbol,
		lootbox.descriptionMd,
		lootbox.coverKey,
		JSON.stringify(lootbox.bundles),
		now,
		now,
	).run();
}

export type DisplayUpdate = Readonly<{
	title: string;
	tagline: string;
	descriptionMd: string;
	coverKey: string | null;
	accent: string;
	links: readonly Readonly<{ label: string; url: string }>[];
	visibility: Visibility;
}>;

export async function updateDisplay(
	db: D1Database,
	id: number,
	display: DisplayUpdate,
	now: number,
): Promise<void> {
	await db.prepare(
		`UPDATE lootboxes SET title = ?, tagline = ?, description_md = ?,
			cover_key = ?, accent = ?, links_json = ?, visibility = ?, updated_at = ?
		WHERE id = ?`,
	).bind(
		display.title,
		display.tagline,
		display.descriptionMd,
		display.coverKey,
		display.accent,
		JSON.stringify(display.links),
		display.visibility,
		now,
		id,
	).run();
}

/** Merge display labels for bundles appended after launch. */
export async function mergeBundleLabels(
	db: D1Database,
	lootbox: LootboxRecord,
	labels: readonly BundleLabel[],
	now: number,
): Promise<void> {
	const merged = new Map(lootbox.bundles.map((label) => [label.index, label]));

	for (const label of labels) merged.set(label.index, label);

	await db.prepare(
		"UPDATE lootboxes SET bundles_json = ?, updated_at = ? WHERE id = ?",
	).bind(
		JSON.stringify([...merged.values()].sort((a, b) => a.index - b.index)),
		now,
		lootbox.id,
	).run();
}

// Drafts

export type DraftStatus = "editing" | "signing" | "published";

export type DraftRecord = Readonly<{
	id: string;
	creator: string;
	cluster: Cluster;
	step: number;
	data: DraftData;
	templateId: string | null;
	template: string | null;
	boxMint: string | null;
	status: DraftStatus;
	slug: string | null;
	updatedAt: number;
}>;

type DraftRow = {
	id: string;
	creator: string;
	cluster: string;
	step: number;
	data_json: string;
	template_id: string | null;
	template: string | null;
	box_mint: string | null;
	status: string;
	slug: string | null;
	updated_at: number;
};

function toDraft(row: DraftRow): DraftRecord | null {
	const data = draftDataSchema.safeParse(JSON.parse(row.data_json));
	const cluster = parseCluster(row.cluster);

	if (!data.success || !cluster) return null;

	return {
		id: row.id,
		creator: row.creator,
		cluster,
		step: row.step,
		data: data.data,
		templateId: row.template_id,
		template: row.template,
		boxMint: row.box_mint,
		status: row.status === "signing" || row.status === "published"
			? row.status
			: "editing",
		slug: row.slug,
		updatedAt: row.updated_at,
	};
}

export async function draftById(
	db: D1Database,
	id: string,
	creator: string,
): Promise<DraftRecord | null> {
	const row = await db.prepare(
		"SELECT * FROM drafts WHERE id = ? AND creator = ?",
	).bind(id, creator).first<DraftRow>();

	return row ? toDraft(row) : null;
}

export async function draftByBoxMint(
	db: D1Database,
	boxMint: string,
): Promise<DraftRecord | null> {
	const row = await db.prepare("SELECT * FROM drafts WHERE box_mint = ?")
		.bind(boxMint).first<DraftRow>();

	return row ? toDraft(row) : null;
}

export async function latestDraft(
	db: D1Database,
	creator: string,
): Promise<DraftRecord | null> {
	const row = await db.prepare(
		`SELECT * FROM drafts WHERE creator = ? AND status != 'published'
		ORDER BY updated_at DESC LIMIT 1`,
	).bind(creator).first<DraftRow>();

	return row ? toDraft(row) : null;
}

export async function upsertDraft(
	db: D1Database,
	draft: Readonly<{
		id: string;
		creator: string;
		cluster: Cluster;
		step: number;
		data: DraftData;
	}>,
	now: number,
): Promise<void> {
	// The creator column in the conflict clause stops one wallet from
	// overwriting another wallet's draft by guessing its id.
	await db.prepare(
		`INSERT INTO drafts (id, creator, cluster, step, data_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (id) DO UPDATE SET
			cluster = excluded.cluster,
			step = excluded.step,
			data_json = excluded.data_json,
			updated_at = excluded.updated_at
		WHERE drafts.creator = excluded.creator AND drafts.status = 'editing'`,
	).bind(
		draft.id,
		draft.creator,
		draft.cluster,
		draft.step,
		JSON.stringify(draft.data),
		now,
		now,
	).run();
}

/** Pin the on-chain identity before the first transaction is signed. */
export async function markDraftSigning(
	db: D1Database,
	input: Readonly<{
		id: string;
		creator: string;
		templateId: string;
		template: string;
		boxMint: string;
	}>,
	now: number,
): Promise<boolean> {
	const result = await db.prepare(
		`UPDATE drafts SET status = 'signing', template_id = ?, template = ?,
			box_mint = ?, updated_at = ?
		WHERE id = ? AND creator = ?
			AND (status = 'editing' OR (status = 'signing' AND template = ?))`,
	).bind(
		input.templateId,
		input.template,
		input.boxMint,
		now,
		input.id,
		input.creator,
		input.template,
	).run();

	return result.meta.changes === 1;
}

export async function markDraftPublished(
	db: D1Database,
	id: string,
	slug: string,
	now: number,
): Promise<void> {
	await db.prepare(
		"UPDATE drafts SET status = 'published', slug = ?, updated_at = ? WHERE id = ?",
	).bind(slug, now, id).run();
}

export async function deleteDraft(
	db: D1Database,
	id: string,
	creator: string,
): Promise<void> {
	await db.prepare(
		"DELETE FROM drafts WHERE id = ? AND creator = ? AND status = 'editing'",
	).bind(id, creator).run();
}

// Auth

export async function insertNonce(
	db: D1Database,
	nonce: string,
	domain: string,
	issuedAt: number,
	expiresAt: number,
): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM auth_nonces WHERE expires_at < ?").bind(issuedAt),
		db.prepare(
			"INSERT INTO auth_nonces (nonce, domain, issued_at, expires_at) VALUES (?, ?, ?, ?)",
		).bind(nonce, domain, issuedAt, expiresAt),
	]);
}

/** Atomically mark a nonce used. False if unknown, expired, reused, or foreign. */
export async function consumeNonce(
	db: D1Database,
	nonce: string,
	domain: string,
	now: number,
): Promise<boolean> {
	const result = await db.prepare(
		`UPDATE auth_nonces SET used_at = ?
		WHERE nonce = ? AND domain = ? AND used_at IS NULL AND expires_at > ?`,
	).bind(now, nonce, domain, now).run();

	return result.meta.changes === 1;
}

export async function insertSession(
	db: D1Database,
	tokenHash: string,
	address: string,
	now: number,
	expiresAt: number,
): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
		db.prepare(
			"INSERT INTO sessions (token_hash, address, created_at, expires_at) VALUES (?, ?, ?, ?)",
		).bind(tokenHash, address, now, expiresAt),
	]);
}

export async function sessionAddress(
	db: D1Database,
	tokenHash: string,
	now: number,
): Promise<string | null> {
	const row = await db.prepare(
		"SELECT address FROM sessions WHERE token_hash = ? AND expires_at > ?",
	).bind(tokenHash, now).first<{ address: string }>();

	return row?.address ?? null;
}

export async function deleteSession(
	db: D1Database,
	tokenHash: string,
): Promise<void> {
	await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash)
		.run();
}

// Uploads

export async function insertUpload(
	db: D1Database,
	upload: Readonly<{
		key: string;
		owner: string;
		contentType: string;
		size: number;
	}>,
	now: number,
): Promise<void> {
	await db.prepare(
		"INSERT INTO uploads (key, owner, content_type, size, created_at) VALUES (?, ?, ?, ?, ?)",
	).bind(upload.key, upload.owner, upload.contentType, upload.size, now).run();
}

export async function uploadOwner(
	db: D1Database,
	key: string,
): Promise<string | null> {
	const row = await db.prepare("SELECT owner FROM uploads WHERE key = ?")
		.bind(key).first<{ owner: string }>();

	return row?.owner ?? null;
}

// Relayer

/** Take the relayer lease unless another run holds an unexpired one. */
export async function acquireLease(
	db: D1Database,
	name: string,
	holder: string,
	now: number,
	ttlSeconds: number,
): Promise<boolean> {
	const result = await db.prepare(
		`INSERT INTO relayer_leases (name, holder, expires_at) VALUES (?, ?, ?)
		ON CONFLICT (name) DO UPDATE SET holder = excluded.holder,
			expires_at = excluded.expires_at
		WHERE relayer_leases.expires_at <= ?`,
	).bind(name, holder, now + ttlSeconds, now).run();

	return result.meta.changes === 1;
}

export async function releaseLease(
	db: D1Database,
	name: string,
	holder: string,
): Promise<void> {
	await db.prepare(
		"DELETE FROM relayer_leases WHERE name = ? AND holder = ?",
	).bind(name, holder).run();
}

export async function recordRelayerEvent(
	db: D1Database,
	event: Readonly<{
		lootboxId: number;
		opening: string;
		kind: string;
		message: string;
	}>,
	now: number,
): Promise<void> {
	await db.batch([
		db.prepare(
			"INSERT INTO relayer_events (lootbox_id, opening, kind, message, created_at) VALUES (?, ?, ?, ?, ?)",
		).bind(event.lootboxId, event.opening, event.kind, event.message, now),
		// Keep the log bounded: one week of events.
		db.prepare("DELETE FROM relayer_events WHERE created_at < ?").bind(
			now - 7 * 86_400,
		),
	]);
}

export type RelayerEventRecord = Readonly<{
	opening: string;
	kind: string;
	message: string;
	createdAt: number;
}>;

export async function recentRelayerEvents(
	db: D1Database,
	lootboxId: number,
): Promise<RelayerEventRecord[]> {
	const { results } = await db.prepare(
		`SELECT opening, kind, message, created_at FROM relayer_events
		WHERE lootbox_id = ? ORDER BY created_at DESC, id DESC LIMIT 10`,
	).bind(lootboxId).all<
		{ opening: string; kind: string; message: string; created_at: number }
	>();

	return results.map((row) => ({
		opening: row.opening,
		kind: row.kind,
		message: row.message,
		createdAt: row.created_at,
	}));
}
