-- lootbox.so initial schema.
--
-- The chain is the source of truth for prizes, odds, supply, and ownership.
-- D1 stores only what the chain cannot: display copy the creator may edit at
-- any time, wizard drafts, sign-in state, and relayer bookkeeping.

-- One published lootbox page. `template` is the on-chain treasury address.
CREATE TABLE lootboxes (
	id INTEGER PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	cluster TEXT NOT NULL CHECK (cluster IN ('devnet', 'mainnet', 'localnet')),
	template TEXT NOT NULL,
	box_mint TEXT NOT NULL,
	creator TEXT NOT NULL,
	title TEXT NOT NULL,
	symbol TEXT NOT NULL,
	tagline TEXT NOT NULL DEFAULT '',
	description_md TEXT NOT NULL DEFAULT '',
	cover_key TEXT,
	accent TEXT NOT NULL DEFAULT 'teal',
	links_json TEXT NOT NULL DEFAULT '[]',
	visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted')),
	-- Display labels for on-chain bundles, by bundle index. Amounts never live here.
	bundles_json TEXT NOT NULL DEFAULT '[]',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	UNIQUE (cluster, template),
	UNIQUE (cluster, box_mint)
);

CREATE INDEX lootboxes_public ON lootboxes (visibility, created_at DESC);
CREATE INDEX lootboxes_creator ON lootboxes (creator, created_at DESC);
CREATE INDEX lootboxes_box_mint ON lootboxes (box_mint);

-- A creator's in-progress wizard. `data_json` is validated before every write.
-- Chain progress is always re-read from `template`; nothing here is trusted
-- to describe on-chain state.
CREATE TABLE drafts (
	id TEXT PRIMARY KEY,
	creator TEXT NOT NULL,
	cluster TEXT NOT NULL CHECK (cluster IN ('devnet', 'mainnet', 'localnet')),
	step INTEGER NOT NULL DEFAULT 1,
	data_json TEXT NOT NULL,
	template_id TEXT,
	template TEXT,
	box_mint TEXT,
	status TEXT NOT NULL DEFAULT 'editing' CHECK (status IN ('editing', 'signing', 'published')),
	slug TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX drafts_creator ON drafts (creator, updated_at DESC);
CREATE INDEX drafts_box_mint ON drafts (box_mint);

-- Single-use Sign In With Solana nonces.
CREATE TABLE auth_nonces (
	nonce TEXT PRIMARY KEY,
	domain TEXT NOT NULL,
	issued_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	used_at INTEGER
);

CREATE INDEX auth_nonces_expiry ON auth_nonces (expires_at);

-- Sessions store only a SHA-256 hash of the cookie token.
CREATE TABLE sessions (
	token_hash TEXT PRIMARY KEY,
	address TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_expiry ON sessions (expires_at);

-- Cover art uploaded to R2, owned by the wallet that uploaded it.
CREATE TABLE uploads (
	key TEXT PRIMARY KEY,
	owner TEXT NOT NULL,
	content_type TEXT NOT NULL,
	size INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);

-- One relayer run at a time, even if a cron invocation overruns a minute.
CREATE TABLE relayer_leases (
	name TEXT PRIMARY KEY,
	holder TEXT NOT NULL,
	expires_at INTEGER NOT NULL
);

-- Recent relayer outcomes, for the creator's status panel and debugging.
CREATE TABLE relayer_events (
	id INTEGER PRIMARY KEY,
	lootbox_id INTEGER NOT NULL REFERENCES lootboxes (id) ON DELETE CASCADE,
	opening TEXT NOT NULL,
	kind TEXT NOT NULL,
	message TEXT NOT NULL DEFAULT '',
	created_at INTEGER NOT NULL
);

CREATE INDEX relayer_events_lootbox ON relayer_events (lootbox_id, created_at DESC);
