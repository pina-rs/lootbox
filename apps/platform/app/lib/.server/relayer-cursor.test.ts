import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lootboxesOnClusters, relayerCursor, saveRelayerCursor } from "./db.js";

let db: DatabaseSync;
const reads: { query: string; bindings: SQLInputValue[] }[] = [];

beforeEach(() => {
	db = new DatabaseSync(":memory:");
	reads.length = 0;

	for (const name of ["0001_initial.sql", "0003_relayer_cursor.sql"]) {
		db.exec(
			readFileSync(
				new URL(`../../../migrations/${name}`, import.meta.url),
				"utf8",
			),
		);
	}
});

afterEach(() => db.close());

function unsupported(): never {
	throw new Error("Unexpected D1 operation in relayer SQLite adapter");
}

/** Capture production read SQL for SQLite and execute production writes directly. */
function prepared(
	query: string,
	bindings: SQLInputValue[] = [],
): D1PreparedStatement {
	const result = () => ({
		success: true,
		results: [],
		meta: {
			duration: 0,
			size_after: 0,
			rows_read: 0,
			rows_written: 0,
			last_row_id: 0,
			changed_db: false,
			changes: 0,
		},
	});

	return {
		bind(...values: unknown[]) {
			return prepared(
				query,
				values.map((value) => {
					if (
						value === null || typeof value === "string" ||
						typeof value === "number" ||
						typeof value === "bigint" || value instanceof Uint8Array
					) return value;

					throw new Error("Unsupported SQL binding");
				}),
			);
		},
		async all() {
			reads.push({ query, bindings });

			return result();
		},
		async first() {
			reads.push({ query, bindings });

			return null;
		},
		async run() {
			db.prepare(query).run(...bindings);

			return result();
		},
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

describe("relayer cursor and bounded scans", () => {
	it("limits the real production query and resumes after an examined lootbox", async () => {
		const insert = db.prepare(
			"INSERT INTO lootboxes (id,slug,cluster,template,box_mint,creator,title,symbol,created_at,updated_at) VALUES (?,?,?,?,?,'wallet','title','BOX',0,0)",
		);

		for (let id = 1; id <= 24; id++) {
			insert.run(
				id,
				`box${id}`,
				id % 2 ? "mainnet" : "devnet",
				`template${id}`,
				`mint${id}`,
			);
		}

		await lootboxesOnClusters(d1, ["devnet"], 5, 8);
		const read = reads[0];

		if (!read) throw new Error("Missing production query");

		const ids = db.prepare(read.query).all(...read.bindings).map((row) =>
			row.id
		);

		expect(ids).toEqual([6, 8, 10, 12, 14, 16, 18, 20]);
	});

	it("keeps one resumable cursor independent of the lease lifecycle", async () => {
		expect(await relayerCursor(d1)).toBe(0);
		await saveRelayerCursor(d1, 8);
		await saveRelayerCursor(d1, 16);
		const read = reads[0];

		if (!read) throw new Error("Missing production cursor query");

		expect(db.prepare(read.query).get()?.lootbox_id).toBe(16);
		expect(
			db.prepare("SELECT count(*) AS count FROM relayer_cursor").get()?.count,
		).toBe(1);
	});
});
