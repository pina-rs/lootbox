/**
 * Sign In With Solana (SIWS) message text.
 *
 * Wallets that implement `solana:signIn` build this text themselves from the
 * input we send; wallets that only implement `solana:signMessage` sign the
 * text we build here. Either way the server parses the signed text and checks
 * every field against the nonce it issued, so the format must round-trip
 * exactly. The layout follows the SIWS specification (derived from EIP-4361).
 */
export type SiwsFields = Readonly<{
	domain: string;
	address: string;
	statement?: string;
	uri?: string;
	version?: string;
	chainId?: string;
	nonce?: string;
	issuedAt?: string;
	expirationTime?: string;
	notBefore?: string;
	requestId?: string;
	resources?: readonly string[];
}>;

const HEADER_SUFFIX = " wants you to sign in with your Solana account:";

const FIELD_LABELS = [
	["uri", "URI"],
	["version", "Version"],
	["chainId", "Chain ID"],
	["nonce", "Nonce"],
	["issuedAt", "Issued At"],
	["expirationTime", "Expiration Time"],
	["notBefore", "Not Before"],
	["requestId", "Request ID"],
] as const;

type FieldKey = (typeof FIELD_LABELS)[number][0];

/** Render the canonical SIWS message for `signMessage` wallets. */
export function buildSiwsMessage(fields: SiwsFields): string {
	let message = `${fields.domain}${HEADER_SUFFIX}\n${fields.address}`;

	if (fields.statement) message += `\n\n${fields.statement}`;

	const lines: string[] = [];

	for (const [key, label] of FIELD_LABELS) {
		const value = fields[key];

		if (value) lines.push(`${label}: ${value}`);
	}

	if (fields.resources && fields.resources.length > 0) {
		lines.push("Resources:");

		for (const resource of fields.resources) lines.push(`- ${resource}`);
	}

	if (lines.length > 0) message += `\n\n${lines.join("\n")}`;

	return message;
}

/**
 * Parse a signed SIWS message. Returns `null` for anything that is not an
 * exact SIWS message: unknown lines, repeated fields, or a malformed header.
 */
export function parseSiwsMessage(text: string): SiwsFields | null {
	const lines = text.split("\n");
	const header = lines[0] ?? "";

	if (!header.endsWith(HEADER_SUFFIX)) return null;

	const domain = header.slice(0, -HEADER_SUFFIX.length);
	const address = lines[1] ?? "";

	if (!domain || !address) return null;

	let cursor = 2;
	let statement: string | undefined;

	// An optional statement sits between two blank lines.
	if (lines[cursor] === "" && lines[cursor + 1] !== undefined) {
		const next = lines[cursor + 1] ?? "";
		const isField = FIELD_LABELS.some(([, label]) =>
			next.startsWith(`${label}: `)
		) || next === "Resources:";

		if (!isField) {
			statement = next;
			cursor += 2;
		}
	}

	const values: Partial<Record<FieldKey, string>> = {};
	const resources: string[] = [];

	if (cursor < lines.length) {
		if (lines[cursor] !== "") return null;

		cursor += 1;
	}

	let inResources = false;

	for (; cursor < lines.length; cursor += 1) {
		const line = lines[cursor] ?? "";

		if (inResources) {
			if (!line.startsWith("- ")) return null;

			resources.push(line.slice(2));
			continue;
		}

		if (line === "Resources:") {
			inResources = true;
			continue;
		}

		const field = FIELD_LABELS.find(([, label]) =>
			line.startsWith(`${label}: `)
		);

		if (!field || values[field[0]] !== undefined) return null;

		values[field[0]] = line.slice(field[1].length + 2);
	}

	return {
		domain,
		address,
		...(statement === undefined ? {} : { statement }),
		...values,
		...(resources.length > 0 ? { resources } : {}),
	};
}
