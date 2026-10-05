/**
 * Explore and Home cards: display copy from D1 plus one batched chain read
 * per cluster for supply and reveal status.
 */
import { readTemplateSummaries, type TemplateSummary } from "../chain.js";
import type { Cluster } from "../clusters.js";
import { type AppServices, mediaUrl } from "./context.js";
import type { LootboxRecord } from "./db.js";
import { rpcUrlFor } from "./env.js";

export type LootboxCard = Readonly<{
	slug: string;
	title: string;
	tagline: string;
	coverUrl: string | null;
	accent: string;
	cluster: Cluster;
	summary: TemplateSummary | null;
}>;

export async function toCards(
	app: AppServices,
	origin: string,
	records: readonly LootboxRecord[],
): Promise<LootboxCard[]> {
	const byCluster = new Map<Cluster, LootboxRecord[]>();

	for (const record of records) {
		byCluster.set(record.cluster, [
			...(byCluster.get(record.cluster) ?? []),
			record,
		]);
	}

	const summaries = new Map<string, TemplateSummary>();

	await Promise.all(
		[...byCluster].map(async ([cluster, group]) => {
			try {
				const rpcUrl = await rpcUrlFor(app.config, cluster);
				const read = await readTemplateSummaries(
					rpcUrl,
					group.map((record) => record.template),
				);

				for (const summary of read) summaries.set(summary.template, summary);
			} catch (error) {
				// Cards still render from D1; the status chip shows "unknown".
				console.error("summary read failed", cluster, error);
			}
		}),
	);

	return records.map((record) => ({
		slug: record.slug,
		title: record.title,
		tagline: record.tagline,
		coverUrl: mediaUrl(origin, record.coverKey),
		accent: record.accent,
		cluster: record.cluster,
		summary: summaries.get(record.template) ?? null,
	}));
}
