#!/usr/bin/env node
// Compares the compute-unit benchmark reports and deployed binary sizes of a
// pull request against its base, applying the thresholds in
// `tools/perf/policy.json`.
//
// Exit status: 0 when the pull request passes policy (improvements and
// small regressions), 2 when any instruction exceeds the fail thresholds or
// the binary grows beyond the approved size without an updated approval.
//
// The Surfpool journeys are deterministic: the same program and fixture keys
// produce byte-identical compute-unit figures, so the thresholds are tight.

import {
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

/** @typedef {{deltaCu: number, deltaPercent: number}} Threshold */

/**
 * Reads every family report in a directory into one id → units map.
 *
 * @param {string} directory
 * @returns {Map<string, number>}
 */
function loadCases(directory) {
	const cases = new Map();
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) {
			continue;
		}
		const report = JSON.parse(
			readFileSync(join(directory, entry.name), "utf8"),
		);
		for (const item of report.cases ?? []) {
			if (!item.succeeded) {
				throw new Error(
					`${entry.name}: case ${item.id} did not succeed; the benchmark must measure healthy paths`,
				);
			}
			if (cases.has(item.id)) {
				throw new Error(`${entry.name}: duplicate case id ${item.id}`);
			}
			cases.set(item.id, item.computeUnits);
		}
	}
	if (cases.size === 0) {
		throw new Error(`${directory}: no benchmark reports found`);
	}
	return cases;
}

/**
 * @param {number} baseUnits
 * @param {number} headUnits
 * @param {Threshold} warn
 * @param {Threshold} fail
 * @param {number | undefined} approvedTotal
 * @returns {"fail" | "warn" | "approved-regression" | "small-regression" | "unchanged" | "improved"}
 */
function classify(baseUnits, headUnits, warn, fail, approvedTotal) {
	const deltaCu = headUnits - baseUnits;
	if (deltaCu < 0) {
		return "improved";
	}
	if (deltaCu === 0) {
		return "unchanged";
	}

	const deltaPercent = (deltaCu / baseUnits) * 100;
	let status;
	if (deltaCu >= fail.deltaCu && deltaPercent >= fail.deltaPercent) {
		status = "fail";
	} else if (deltaCu >= warn.deltaCu && deltaPercent >= warn.deltaPercent) {
		status = "warn";
	} else {
		status = "small-regression";
	}

	// An intentional regression recorded in the policy keeps the gate green
	// while the head stays inside the approved budget.
	if (
		approvedTotal !== undefined &&
		(status === "fail" || status === "warn") &&
		baseUnits < approvedTotal &&
		headUnits <= approvedTotal
	) {
		return "approved-regression";
	}
	return status;
}

const MARKDOWN_STATUS = /** @type {const} */ ({
	improved: "✅ improved",
	unchanged: "· unchanged",
	"small-regression": "· small",
	"approved-regression": "🟡 approved",
	warn: "🟡 warn",
	fail: "❌ fail",
});

function formatDelta(delta) {
	const sign = delta > 0 ? "+" : "";
	return `${sign}${delta.toLocaleString("en-US")}`;
}

/**
 * @param {string} markdownPath
 * @param {string} jsonPath
 */
function main(markdownPath, jsonPath) {
	const policy = JSON.parse(readFileSync("tools/perf/policy.json", "utf8"));
	const baseDir = process.env.LOOTBOX_PERF_BASE_DIR ?? "";
	const headDir = process.env.LOOTBOX_PERF_HEAD_DIR ?? "";
	const baseBinary = process.env.LOOTBOX_PERF_BASE_BINARY ?? "";
	const headBinary = process.env.LOOTBOX_PERF_HEAD_BINARY ?? "";
	for (
		const [name, value] of Object.entries({
			baseDir,
			headDir,
			baseBinary,
			headBinary,
		})
	) {
		if (value === "") {
			throw new Error(`set LOOTBOX_PERF_${name.toUpperCase()}`);
		}
	}

	const baseCases = loadCases(baseDir);
	const headCases = loadCases(headDir);
	const comparisons = [];
	const failures = [];
	const notes = [];

	for (const [id, baseUnits] of baseCases) {
		const headUnits = headCases.get(id);
		if (headUnits === undefined) {
			notes.push(`\`${id}\` disappeared from the head benchmark`);
			failures.push(`missing case: ${id}`);
			continue;
		}
		const approved = policy.approvedTotals?.[id];
		const advisory = (policy.advisory ?? []).some((pattern) =>
			new RegExp(`^${pattern.replace(/\*/g, ".*")}$`).test(id)
		);
		const status = classify(
			baseUnits,
			headUnits,
			policy.warn,
			policy.fail,
			approved,
		);
		if (advisory) {
			notes.push(
				`\`${id}\` is advisory: its Surfpool measurement carries environment noise, so it is reported but not enforced`,
			);
		} else if (status === "fail") {
			failures.push(
				`${id}: ${
					formatDelta(headUnits - baseUnits)
				} CU over the fail threshold`,
			);
		}
		comparisons.push({
			id,
			status,
			baseUnits,
			headUnits,
			deltaCu: headUnits - baseUnits,
			deltaPercent: ((headUnits - baseUnits) / baseUnits) * 100,
		});
	}
	for (const id of headCases.keys()) {
		if (!baseCases.has(id)) {
			notes.push(
				`\`${id}\` is new in this pull request and becomes its own baseline`,
			);
			comparisons.push({
				id,
				status: "new-baseline",
				baseUnits: null,
				headUnits: headCases.get(id),
				deltaCu: null,
				deltaPercent: null,
			});
		}
	}
	comparisons.sort((a, b) => a.id.localeCompare(b.id));

	const baseSize = statSync(baseBinary).size;
	const headSize = statSync(headBinary).size;
	const sizeDelta = headSize - baseSize;
	const sizeApproved = policy.approvedBinarySize;
	let sizeStatus;
	if (sizeDelta < 0) {
		sizeStatus = "improved";
	} else if (sizeDelta === 0) {
		sizeStatus = "unchanged";
	} else if (sizeApproved !== undefined && headSize <= sizeApproved) {
		sizeStatus = "approved-regression";
	} else if (
		sizeDelta > policy.size.failBytes ||
		(sizeDelta / baseSize) * 100 > policy.size.failPercent
	) {
		sizeStatus = "fail";
		failures.push(
			`binary grew by ${formatDelta(sizeDelta)} bytes to ${
				headSize.toLocaleString("en-US")
			} (${
				formatDelta(Number(((sizeDelta / baseSize) * 100).toFixed(2)))
			}%); update approvedBinarySize in tools/perf/policy.json if the growth is required`,
		);
	} else {
		sizeStatus = "warn";
		notes.push(
			`binary grew by ${
				formatDelta(sizeDelta)
			} bytes; keep an eye on it (approved ceiling: ${
				sizeApproved?.toLocaleString("en-US") ?? "none"
			} bytes)`,
		);
	}

	const baseTotal = [...baseCases.values()].reduce(
		(sum, units) => sum + units,
		0,
	);
	const headTotal = [...headCases.values()].reduce(
		(sum, units) => sum + units,
		0,
	);

	const rows = comparisons.map((item) => {
		const delta = item.deltaCu === null
			? "—"
			: `${formatDelta(item.deltaCu)} (${
				formatDelta(Number(item.deltaPercent.toFixed(1)))
			}%)`;
		const status = item.status === "new-baseline" ? "🆕 new" : MARKDOWN_STATUS[
			/** @type {keyof typeof MARKDOWN_STATUS} */ (item.status)
		];
		return `| \`${item.id}\` | ${
			item.baseUnits === null ? "—" : item.baseUnits.toLocaleString("en-US")
		} | ${item.headUnits.toLocaleString("en-US")} | ${delta} | ${status} |`;
	});

	const lines = [
		"## Instruction compute units and binary size",
		"",
		`Comparing the head against the pull request base. Measured on deterministic Surfpool journeys against the real SBF artifact; the same inputs always produce the same figures.`,
		"",
		`**Totals:** ${baseTotal.toLocaleString("en-US")} → ${
			headTotal.toLocaleString("en-US")
		} CU (${formatDelta(headTotal - baseTotal)}, ${
			formatDelta(
				Number((((headTotal - baseTotal) / baseTotal) * 100).toFixed(2)),
			)
		}%) across ${comparisons.length} instructions.`,
		`**Binary:** ${baseSize.toLocaleString("en-US")} → ${
			headSize.toLocaleString("en-US")
		} bytes (${formatDelta(sizeDelta)}, ${
			formatDelta(Number(((sizeDelta / baseSize) * 100).toFixed(2)))
		}%) ${
			MARKDOWN_STATUS[/** @type {keyof typeof MARKDOWN_STATUS} */ (sizeStatus)]
		}`,
		"",
		"<details>",
		"<summary>Per-instruction table</summary>",
		"",
		"| Case | Base CU | Head CU | Δ | Status |",
		"| --- | ---: | ---: | ---: | --- |",
		...rows,
		"",
		"</details>",
	];
	if (notes.length > 0) {
		lines.push("", ...notes.map((note) => `- ${note}`));
	}
	if (failures.length > 0) {
		lines.push(
			"",
			"**Policy failures**",
			"",
			...failures.map((failure) => `- ❌ ${failure}`),
		);
	}

	mkdirSync(dirname(markdownPath), { recursive: true });
	writeFileSync(markdownPath, `${lines.join("\n")}\n`);
	mkdirSync(dirname(jsonPath), { recursive: true });
	writeFileSync(
		jsonPath,
		`${
			JSON.stringify(
				{
					baseTotal,
					headTotal,
					baseSize,
					headSize,
					sizeStatus,
					comparisons,
					failures,
					notes,
				},
				null,
				"\t",
			)
		}\n`,
	);

	process.stdout.write(`${lines.join("\n")}\n`);
	process.exitCode = failures.length > 0 ? 2 : 0;
}

try {
	const args = process.argv.slice(2);
	const markdownPath = args[0] ?? "target/perf/report.md";
	const jsonPath = args[1] ?? "target/perf/report.json";
	main(markdownPath, jsonPath);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
