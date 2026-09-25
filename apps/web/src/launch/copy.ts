import snapshot from "./prestocks-snapshot.json";

/** Every company a PreStocks prize may track, from the bundled catalog. */
export const TRACKED_COMPANIES: readonly string[] = snapshot.stocks
	.map((stock) => stock.name).sort((left, right) => left.localeCompare(right));

function list(names: readonly string[]): string {
	if (names.length < 2) return names.join("");

	return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

/** The visible non-affiliation line. */
export const NOT_AFFILIATED = `Not affiliated with or endorsed by ${
	list(TRACKED_COMPANIES)
}.`;

/** What a PreStocks prize is, and is not, for one company. */
export function prestocksDisclaimer(company: string): string {
	return `PreStocks token that tracks SPV exposure to ${company}. Not shares; no ownership, voting or dividend rights. Not affiliated with or endorsed by ${company}.`;
}

/** The self-certification a winner must make before claiming a token prize. */
export const ELIGIBILITY_STATEMENT =
	"I am 18 or older, not a US person, not in a jurisdiction where these tokens are restricted, and not a sanctioned person.";
