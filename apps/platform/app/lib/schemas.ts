/**
 * Input validation shared by the browser and the Worker.
 *
 * The browser uses these schemas for instant feedback; the server re-validates
 * every write with the same schemas, so a crafted request cannot store data
 * the UI could not have produced.
 */
import { z } from "zod";

import { CLUSTERS } from "./clusters.js";

const utf8 = new TextEncoder();
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// Control characters are rejected because on-chain text fields refuse them.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

export const addressSchema = z.string().regex(BASE58, "Not a Solana address");

/** A non-negative integer carried as a decimal string (u64-safe). */
export const u64String = z.string().regex(
	/^\d{1,20}$/,
	"Expected a whole number",
)
	.refine((value) => BigInt(value) <= (1n << 64n) - 1n, "Number is too large");

function boundedUtf8(label: string, maxBytes: number) {
	return z.string()
		.trim()
		.min(1, `${label} is required`)
		.refine((value) => !CONTROL.test(value), `${label} has hidden characters`)
		.refine(
			(value) => utf8.encode(value).length <= maxBytes,
			`${label} must fit in ${maxBytes} bytes`,
		);
}

/** On-chain name: 32 UTF-8 bytes, fixed forever at creation. */
export const lootboxNameSchema = boundedUtf8("Name", 32);
/** Box token symbol: 10 UTF-8 bytes. */
export const symbolSchema = boundedUtf8("Symbol", 10).refine(
	(value) => /^[A-Z0-9$]+$/.test(value),
	"Use capital letters and numbers",
);

export const issuerSchema = z.object({
	name: z.string().max(40),
	feeBasisPoints: z.number().int().min(0).max(10_000),
	maximumFee: u64String,
});

export const draftAssetSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("sol"), lamports: u64String }),
	z.object({
		kind: z.literal("token"),
		mint: addressSchema,
		tokenProgram: addressSchema,
		amount: u64String,
		decimals: z.number().int().min(0).max(18),
		symbol: z.string().max(20),
		name: z.string().max(80),
		icon: z.string().url().max(500).nullable(),
		/** Present for an issuer-controlled tokenized stock (PreStocks, xStocks). */
		issuer: issuerSchema.nullable(),
		/** Company the tokenized stock tracks, when known. */
		tracks: z.string().max(60).nullable(),
	}),
	z.object({
		kind: z.literal("nft"),
		mint: addressSchema,
		standard: z.enum(["tokenMetadata", "core"]),
		name: z.string().max(80),
		image: z.string().url().max(500).nullable(),
	}),
]);

export type DraftAsset = z.infer<typeof draftAssetSchema>;

export const draftBundleSchema = z.object({
	id: z.string().min(1).max(40),
	label: boundedUtf8("Bundle name", 40),
	quantity: z.number().int().min(1).max(100_000),
	assets: z.array(draftAssetSchema).min(1, "Add at least one prize")
		.max(4, "A bundle holds at most four prizes"),
});

export type DraftBundle = z.infer<typeof draftBundleSchema>;

/** Attach the global Exclusive Lootbox NFT collection as the consolation. */
export const consolationSchema = z.object({
	enabled: z.boolean(),
	count: z.number().int().min(0).max(100_000),
});

export type Consolation = z.infer<typeof consolationSchema>;

export const draftDetailsSchema = z.object({
	name: z.string().max(200),
	symbol: z.string().max(40),
	description: z.string().max(4_000),
	coverKey: z.string().max(120).nullable(),
	/** Reveal instant as Unix seconds; the UI converts from the creator's zone. */
	revealAt: z.number().int().min(0).nullable(),
	timeZone: z.string().max(64),
});

/** A draft may be incomplete; `readyToSign` decides whether it can launch. */
export const draftDataSchema = z.object({
	details: draftDetailsSchema,
	bundles: z.array(draftBundleSchema).max(64),
	consolation: consolationSchema,
});

export type DraftData = z.infer<typeof draftDataSchema>;

export const draftWriteSchema = z.object({
	cluster: z.enum(CLUSTERS),
	step: z.number().int().min(1).max(5),
	data: draftDataSchema,
});

/** The strict form every field must pass before any transaction is signed. */
export const launchDetailsSchema = z.object({
	name: lootboxNameSchema,
	symbol: symbolSchema,
	description: z.string().max(4_000),
	coverKey: z.string().max(120).nullable(),
	revealAt: z.number().int().positive("Pick a reveal date"),
	timeZone: z.string().max(64),
});

export const ACCENTS = ["teal", "gold", "coral", "plum", "ink"] as const;

export const linkSchema = z.object({
	label: z.string().trim().min(1).max(30),
	url: z.string().trim().url().max(300).refine(
		(value) => value.startsWith("https://"),
		"Links must start with https://",
	),
});

export const displaySchema = z.object({
	title: z.string().trim().min(1, "Title is required").max(60),
	tagline: z.string().trim().max(120),
	descriptionMd: z.string().max(4_000),
	coverKey: z.string().max(120).nullable(),
	accent: z.enum(ACCENTS),
	links: z.array(linkSchema).max(5),
	visibility: z.enum(["public", "unlisted"]),
});

export type Display = z.infer<typeof displaySchema>;

/** Display labels for chain bundles, captured when a bundle is created. */
export const bundleLabelSchema = z.object({
	index: z.number().int().min(0).max(1_023),
	label: z.string().max(40),
	assets: z.array(draftAssetSchema).max(4),
});

export type BundleLabel = z.infer<typeof bundleLabelSchema>;

export const publishSchema = z.object({
	draftId: z.string().min(1).max(40),
	template: addressSchema,
});

export const appendLabelsSchema = z.object({
	labels: z.array(bundleLabelSchema).min(1).max(64),
});

/** First human-readable issue from a Zod error. */
export function firstIssue(error: z.ZodError): string {
	return error.issues[0]?.message ?? "Invalid input";
}
