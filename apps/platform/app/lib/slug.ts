/**
 * Public page slugs: `/l/<slug>`.
 *
 * A slug is a readable stem from the lootbox name plus a short random suffix,
 * so two creators can both call their box "Mystery Box" without a race on a
 * shared name, and a slug never reveals the creator's wallet.
 */
const MAX_STEM = 32;
const SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SUFFIX_LENGTH = 5;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lowercase ASCII words joined by single hyphens, at most 32 characters. */
export function slugStem(name: string): string {
	const stem = name
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, MAX_STEM)
		.replace(/-+$/g, "");

	return stem || "lootbox";
}

/** A random suffix from an unambiguous alphabet (no 0/o, 1/l/i). */
export function slugSuffix(random: (length: number) => Uint8Array): string {
	const bytes = random(SUFFIX_LENGTH);

	return Array.from(
		bytes,
		(byte) => SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length],
	).join("");
}

export function createSlug(
	name: string,
	random: (length: number) => Uint8Array = (length) =>
		crypto.getRandomValues(new Uint8Array(length)),
): string {
	return `${slugStem(name)}-${slugSuffix(random)}`;
}

/** True for a well-formed slug; routes reject anything else before a query. */
export function isSlug(value: string): boolean {
	return value.length <= MAX_STEM + SUFFIX_LENGTH + 1 &&
		SLUG_PATTERN.test(value);
}
