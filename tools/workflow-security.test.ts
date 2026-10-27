import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const publish = readFileSync(
	new URL("../.github/workflows/publish.yml", import.meta.url),
	"utf8",
);
const pages = readFileSync(
	new URL("../.github/workflows/pages.yml", import.meta.url),
	"utf8",
);
const release = readFileSync(
	new URL("../.github/workflows/release-pr.yml", import.meta.url),
	"utf8",
);
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);

function job(workflow: string, name: string): string {
	const jobs = workflow.split("\njobs:\n")[1];
	assert.ok(jobs, "workflow must define jobs");
	const section = jobs.split(`  ${name}:\n`)[1];
	assert.ok(section, `workflow must define ${name}`);
	return section.split(/\n  [a-z_]+:\n/)[0] ?? "";
}

function script(name: string): string {
	const step = publish.split(`      - name: ${name}\n`)[1];
	assert.ok(step, `workflow must define ${name}`);
	const run = step.split("        run: |\n")[1];
	assert.ok(run, `${name} must run a script`);
	const lines = run.split("\n");
	const end = lines.findIndex((line) =>
		line !== "" && !line.startsWith("          ")
	);
	return lines.slice(0, end === -1 ? undefined : end).map((line) =>
		line.slice(10)
	).join("\n");
}

function runGate(
	name: string,
	overrides: Record<string, string> = {},
	record: unknown = {
		resolved_commit: sha,
		record_commit: sha,
		record: { release_targets: [{ tag: true, tag_name: "v0.1.0" }] },
	},
) {
	const directory = mkdtempSync(join(tmpdir(), "release-provenance-"));
	const git = join(directory, "git");
	const monochange = join(directory, "monochange");
	const gh = join(directory, "gh");
	const recordPath = join(directory, "record.json");
	const outputPath = join(directory, "output");
	writeFileSync(
		git,
		`#!/bin/bash
set -euo pipefail
case "$1" in
  rev-parse)
    [[ "$2" == --verify ]]
    [[ "$3" == "refs/tags/$RELEASE_TAG^{commit}" || "$3" == 'FETCH_HEAD^{commit}' ]]
    printf '%s\\n' "$TAG_SHA"
    ;;
  merge-base)
    [[ "$2" == --is-ancestor && "$3" == "$RELEASE_SHA" && "$4" == "$TRUSTED_MAIN_SHA" ]]
    exit "$ANCESTOR_STATUS"
    ;;
  fetch)
    [[ "$2" == --no-tags && "$3" == origin && "$4" == "refs/tags/$RELEASE_TAG" ]]
    ;;
  *) exit 99 ;;
esac
`,
		{ mode: 0o755 },
	);
	writeFileSync(
		gh,
		`#!/bin/bash
set -euo pipefail
[[ "$*" == "release edit $RELEASE_TAG --draft=false --latest --repo $GITHUB_REPOSITORY" ]]
echo release_published >> "$GITHUB_OUTPUT"
`,
		{ mode: 0o755 },
	);
	writeFileSync(
		monochange,
		`#!/bin/bash
set -euo pipefail
[[ "$*" == "step release-record --from $RELEASE_SHA --format json" ]]
cat "$RECORD_FILE"
`,
		{ mode: 0o755 },
	);
	writeFileSync(recordPath, JSON.stringify(record));
	writeFileSync(outputPath, "");
	try {
		const result = spawnSync("bash", ["-c", script(name)], {
			encoding: "utf8",
			env: {
				...process.env,
				PATH: `${directory}:${process.env.PATH}`,
				GITHUB_REF: "refs/heads/main",
				GITHUB_EVENT_NAME: "workflow_dispatch",
				GITHUB_REPOSITORY: "example/repository",
				RELEASE_TAG: "v0.1.0",
				RELEASE_SHA: sha,
				TRUSTED_MAIN_SHA: otherSha,
				TAG_SHA: sha,
				ANCESTOR_STATUS: "0",
				RECORD_FILE: recordPath,
				GITHUB_OUTPUT: outputPath,
				...overrides,
			},
		});
		assert.ifError(result.error);
		return { ...result, output: readFileSync(outputPath, "utf8") };
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

test("publisher credentials require main-only provenance and immutable checkout", () => {
	assert.doesNotMatch(publish, /^  push:/m);
	assert.match(
		job(publish, "provenance"),
		/github\.ref == 'refs\/heads\/main'/,
	);
	assert.match(job(publish, "provenance"), /ref: \$\{\{ github\.sha \}\}/);
	assert.doesNotMatch(
		job(publish, "provenance"),
		/id-token: write|environment: publisher|crates-io-auth-action/,
	);
	assert.match(job(publish, "publish"), /needs: provenance/);
	assert.match(
		job(publish, "publish"),
		/ref: \$\{\{ needs\.provenance\.outputs\.release_sha \}\}/,
	);
	assert.match(job(release, "create"), /github\.ref == 'refs\/heads\/main'/);
	assert.match(job(release, "tag"), /github\.ref == 'refs\/heads\/main'/);
	assert.match(job(release, "tag"), /--field "release_sha=\$GITHUB_SHA"/);
});

test("approved release tag resolves to the supplied main commit", () => {
	const result = runGate("validate release revision");
	assert.equal(result.status, 0, result.stderr);
});

const invalidRevisions: Record<string, Record<string, string>> = {
	"branch dispatch": { GITHUB_REF: "refs/heads/feature" },
	"tag event": { GITHUB_REF: "refs/tags/v0.1.0", GITHUB_EVENT_NAME: "push" },
	"non-release tag": { RELEASE_TAG: "v-malicious" },
	"partial SHA": { RELEASE_SHA: "abcdef" },
	"option-like SHA": { RELEASE_SHA: "--help" },
	"moved tag": { TAG_SHA: otherSha },
	"commit outside main": { ANCESTOR_STATUS: "1" },
};

for (const [name, overrides] of Object.entries(invalidRevisions)) {
	test(`release provenance rejects ${name}`, () => {
		assert.notEqual(runGate("validate release revision", overrides).status, 0);
	});
}

test("matching release record exports the approved immutable SHA", () => {
	const result = runGate("validate approved release record");
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.output, `release_sha=${sha}\n`);
});

for (
	const [name, record] of Object.entries({
		"record inherited from a prior commit": {
			resolved_commit: sha,
			record_commit: otherSha,
			record: { release_targets: [{ tag: true, tag_name: "v0.1.0" }] },
		},
		"resolved commit mismatch": {
			resolved_commit: otherSha,
			record_commit: sha,
			record: { release_targets: [{ tag: true, tag_name: "v0.1.0" }] },
		},
		"unlisted tag": {
			resolved_commit: sha,
			record_commit: sha,
			record: { release_targets: [{ tag: true, tag_name: "v0.2.0" }] },
		},
		"disabled tag": {
			resolved_commit: sha,
			record_commit: sha,
			record: { release_targets: [{ tag: false, tag_name: "v0.1.0" }] },
		},
		"missing release targets": {
			resolved_commit: sha,
			record_commit: sha,
			record: {},
		},
	})
) {
	test(`release record rejects ${name} without authorizing the publisher`, () => {
		const result = runGate("validate approved release record", {}, record);
		assert.notEqual(result.status, 0);
		assert.equal(result.output, "");
	});
}

test("Pages rejects manual branch deployments and builds the selected main SHA", () => {
	assert.match(job(pages, "build"), /if: github\.ref == 'refs\/heads\/main'/);
	assert.match(job(pages, "build"), /ref: \$\{\{ github\.sha \}\}/);
	assert.match(job(pages, "deploy"), /if: github\.ref == 'refs\/heads\/main'/);
	assert.match(job(pages, "deploy"), /needs: build/);
});

test("draft release publication rechecks the remote tag", () => {
	const result = runGate("publish draft release");
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.output, "release_published\n");
});

test("moved remote tag cannot publish the draft release", () => {
	const result = runGate("publish draft release", { TAG_SHA: otherSha });
	assert.notEqual(result.status, 0);
	assert.equal(result.output, "");
});
