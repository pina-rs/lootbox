import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { insertUpload } from "./db.js";
import { deleteUnusedUpload } from "./storage.js";

let db: DatabaseSync;

beforeEach(() => {
	db = new DatabaseSync(":memory:");

	for (const name of ["0001_initial.sql", "0002_storage_budgets.sql"]) {
		db.exec(
			readFileSync(
				new URL(`../../../migrations/${name}`, import.meta.url),
				"utf8",
			),
		);
	}
});

afterEach(() => db.close());

function upload(key: string, owner: string, size = 1, state = "pending") {
	return db.prepare(
		"INSERT INTO uploads (key, owner, content_type, size, created_at, state) VALUES (?, ?, 'image/png', ?, 0, ?)",
	).run(key, owner, size, state);
}

function draft(id: string, creator: string, coverKey: string | null = null) {
	return db.prepare(
		"INSERT INTO drafts (id, creator, cluster, data_json, created_at, updated_at) VALUES (?, ?, 'devnet', ?, 0, 0)",
	)
		.run(id, creator, JSON.stringify({ details: { coverKey } }));
}

/** Seed a full database without repeatedly scanning every fixture row. */
function seedUploads(count: number) {
	const sql = db.prepare(
		"SELECT sql FROM sqlite_master WHERE name = 'uploads_insert_budget'",
	).get()?.sql;

	if (typeof sql !== "string") throw new Error("Missing quota trigger");

	db.exec("DROP TRIGGER uploads_insert_budget");

	try {
		db.prepare(
			`WITH RECURSIVE n(i) AS (VALUES(0) UNION ALL SELECT i+1 FROM n WHERE i+1 < ?)
			INSERT INTO uploads (key, owner, content_type, size, created_at)
			SELECT 'u' || i, 'wallet' || i, 'image/png', 1, 0 FROM n`,
		).run(count);
	} finally {
		db.exec(sql);
	}
}

function unsupported(): never {
	throw new Error("Unexpected D1 operation in write-only SQLite adapter");
}

/** Run the production D1 write queries against real SQLite without casts. */
function prepared(
	query: string,
	bindings: SQLInputValue[] = [],
): D1PreparedStatement {
	return {
		bind(...values: unknown[]) {
			return prepared(
				query,
				values.map((value) => {
					if (
						value === null || typeof value === "string" ||
						typeof value === "number" || typeof value === "bigint" ||
						value instanceof Uint8Array
					) return value;

					throw new Error("Unsupported SQL binding");
				}),
			);
		},
		async run() {
			const result = db.prepare(query).run(...bindings);

			return {
				success: true,
				results: [],
				meta: {
					duration: 0,
					size_after: 0,
					rows_read: 0,
					rows_written: Number(result.changes),
					last_row_id: Number(result.lastInsertRowid),
					changed_db: result.changes !== 0,
					changes: Number(result.changes),
				},
			};
		},
		first: unsupported,
		all: unsupported,
		raw: unsupported,
	};
}

const d1: D1Database = {
	prepare: prepared,
	batch: unsupported,
	exec: unsupported,
	withSession: unsupported,
	dump: unsupported,
};

describe("transactional storage budgets", () => {
	it("admits only one of two concurrent reservations for the last slot", async () => {
		for (let i = 0; i < 19; i++) upload(`u${i}`, "wallet");

		const results = await Promise.allSettled(
			["first", "second"].map((key) =>
				insertUpload(d1, {
					key,
					owner: "wallet",
					contentType: "image/png",
					size: 1,
				}, 0)
			),
		);

		expect(results.filter((result) => result.status === "fulfilled"))
			.toHaveLength(1);
		expect(results.filter((result) => result.status === "rejected"))
			.toHaveLength(1);
		expect(db.prepare("SELECT count(*) AS count FROM uploads").get()?.count)
			.toBe(20);
	});
	it("reserves bytes and counts pending, complete, and deleting uploads", () => {
		for (let i = 0; i < 8; i++) {
			upload(`u${i}`, "wallet", 4 * 1024 * 1024, i % 2 ? "deleting" : "ready");
		}

		expect(() => upload("over", "wallet")).toThrow("storage_quota");
		expect(db.prepare("SELECT count(*) AS count FROM uploads").get()?.count)
			.toBe(8);
		db.prepare("DELETE FROM uploads WHERE key = 'u0'").run();
		expect(() => upload("replacement", "wallet", 4 * 1024 * 1024)).not
			.toThrow();
	});

	it("caps object count even for tiny uploads and bounds every object", () => {
		for (let i = 0; i < 20; i++) upload(`u${i}`, "wallet");

		expect(() => upload("over", "wallet")).toThrow("storage_quota");
		expect(() => upload("large", "other", 4 * 1024 * 1024 + 1)).toThrow(
			"storage_quota",
		);
		expect(() => upload("negative", "other", -1)).toThrow("storage_quota");
	});

	it("caps global bytes across disposable wallets", () => {
		for (let i = 0; i < 128; i++) {
			upload(`u${i}`, `wallet${i}`, 4 * 1024 * 1024);
		}

		expect(() => upload("over", "fresh-wallet")).toThrow("storage_quota");
		expect(db.prepare("SELECT sum(size) AS bytes FROM uploads").get()?.bytes)
			.toBe(512 * 1024 * 1024);
	});

	it("caps global object count across disposable wallets", () => {
		seedUploads(10000);
		expect(() => upload("over", "fresh-wallet")).toThrow("storage_quota");
	});

	it("caps unfinished drafts but permits updating existing drafts at the limit", () => {
		for (let i = 0; i < 5; i++) draft(`d${i}`, "wallet");

		expect(() => draft("over", "wallet")).toThrow("storage_quota");
		expect(() =>
			db.prepare(
				"INSERT INTO drafts (id, creator, cluster, data_json, created_at, updated_at) VALUES ('d0', 'wallet', 'devnet', '{}', 1, 1) ON CONFLICT (id) DO UPDATE SET data_json = excluded.data_json",
			).run()
		).not.toThrow();
		expect(() =>
			db.prepare("UPDATE drafts SET data_json = ? WHERE id = 'd0'").run(
				JSON.stringify({ text: "x".repeat(65536) }),
			)
		).toThrow("storage_quota");
	});

	it("bounds draft storage across disposable wallets", () => {
		db.exec("BEGIN");

		for (let i = 0; i < 2000; i++) draft(`d${i}`, `wallet${i}`);

		db.exec("COMMIT");
		expect(() => draft("over", "fresh-wallet")).toThrow("storage_quota");
	});

	it("rolls back all writes if two reservations exceed the remaining quota", () => {
		for (let i = 0; i < 19; i++) upload(`u${i}`, "wallet");

		db.exec("BEGIN");
		upload("winner", "wallet");
		expect(() => upload("loser", "wallet")).toThrow("storage_quota");
		db.exec("ROLLBACK");
		expect(db.prepare("SELECT count(*) AS count FROM uploads").get()?.count)
			.toBe(19);
	});
});

describe("upload attachment fence", () => {
	it("keeps the reservation on R2 failure and retries deletion safely", async () => {
		upload("cover", "wallet", 1, "ready");
		const remove = vi.fn<Pick<R2Bucket, "delete">["delete"]>()
			.mockRejectedValueOnce(new Error("R2 unavailable"))
			.mockResolvedValue(undefined);
		const app = { db: d1, media: { delete: remove } };

		await expect(deleteUnusedUpload(app, "cover", "wallet")).rejects.toThrow(
			"R2 unavailable",
		);
		expect(
			db.prepare("SELECT state FROM uploads WHERE key = 'cover'").get()?.state,
		).toBe("deleting");
		expect(() => draft("too-late", "wallet", "cover")).toThrow(
			"upload_unavailable",
		);
		await expect(deleteUnusedUpload(app, "cover", "wallet")).resolves.toBe(
			true,
		);
		expect(db.prepare("SELECT * FROM uploads WHERE key = 'cover'").get())
			.toBeUndefined();
		expect(remove).toHaveBeenCalledTimes(2);
	});

	it("preserves a referenced object and refuses deletion by another wallet", async () => {
		upload("cover", "wallet", 1, "ready");
		draft("draft", "wallet", "cover");
		const remove = vi.fn<Pick<R2Bucket, "delete">["delete"]>();
		const app = { db: d1, media: { delete: remove } };

		await expect(deleteUnusedUpload(app, "cover", "wallet")).resolves.toBe(
			false,
		);
		await expect(deleteUnusedUpload(app, "cover", "other")).resolves.toBe(
			false,
		);
		expect(remove).not.toHaveBeenCalled();
		expect(
			db.prepare("SELECT state FROM uploads WHERE key = 'cover'").get()?.state,
		).toBe("ready");
	});
	it("rejects pending, deleting, and foreign-owned covers", () => {
		upload("pending", "wallet");
		upload("deleting", "wallet", 1, "deleting");
		upload("foreign", "other", 1, "ready");

		for (const key of ["pending", "deleting", "foreign", "missing"]) {
			expect(() => draft(`draft-${key}`, "wallet", key)).toThrow(
				"upload_unavailable",
			);
		}

		upload("ready", "wallet", 1, "ready");
		expect(() => draft("valid", "wallet", "ready")).not.toThrow();
		expect(() =>
			db.prepare("UPDATE drafts SET data_json = ? WHERE id = 'valid'").run(
				JSON.stringify({ details: { coverKey: "deleting" } }),
			)
		).toThrow("upload_unavailable");
	});

	it("rejects published cover attachment after the deletion fence", () => {
		upload("cover", "wallet", 1, "deleting");

		expect(() =>
			db.prepare(`INSERT INTO lootboxes
			(slug, cluster, template, box_mint, creator, title, symbol, cover_key, created_at, updated_at)
			VALUES ('slug', 'devnet', 'template', 'mint', 'wallet', 'Title', 'BOX', 'cover', 0, 0)`)
				.run()
		).toThrow("upload_unavailable");
	});
});
