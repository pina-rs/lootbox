/**
 * Parse a creator's distribution list: one recipient per line, optionally
 * with a box count (`address`, `address,3`, or `address 3`). Blank lines and
 * `#` comments are ignored. Duplicate addresses are merged.
 */
import { isAddress } from "@solana/kit";

export type Recipient = Readonly<{ address: string; count: bigint }>;

export type DistributionPlan = Readonly<{
	recipients: readonly Recipient[];
	total: bigint;
	errors: readonly string[];
}>;

/** Transfers per transaction: each adds an idempotent ATA create + transfer. */
export const TRANSFERS_PER_TRANSACTION = 6;

export function parseDistribution(text: string): DistributionPlan {
	const counts = new Map<string, bigint>();
	const errors: string[] = [];

	for (const [index, raw] of text.split(/\r?\n/).entries()) {
		const line = raw.replace(/#.*$/, "").trim();

		if (!line) continue;

		const [target = "", countText = "1", ...extra] = line.split(/[\s,;]+/)
			.filter(Boolean);

		if (extra.length > 0 || !isAddress(target)) {
			errors.push(`Line ${index + 1}: “${raw.trim()}” is not an address`);
			continue;
		}

		if (!/^\d{1,9}$/.test(countText) || BigInt(countText) === 0n) {
			errors.push(
				`Line ${index + 1}: box count must be a whole number above 0`,
			);
			continue;
		}

		counts.set(target, (counts.get(target) ?? 0n) + BigInt(countText));
	}

	const recipients = [...counts].map(([address, count]) => ({
		address,
		count,
	}));

	return {
		recipients,
		total: recipients.reduce((sum, recipient) => sum + recipient.count, 0n),
		errors,
	};
}

/** Split recipients into transaction-sized batches. */
export function batches<T>(
	items: readonly T[],
	size = TRANSFERS_PER_TRANSACTION,
): T[][] {
	const groups: T[][] = [];

	for (let start = 0; start < items.length; start += size) {
		groups.push(items.slice(start, start + size));
	}

	return groups;
}
