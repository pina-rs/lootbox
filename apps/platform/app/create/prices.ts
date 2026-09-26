/** Live USD prices (and a USD→GBP rate) from the Worker's price proxy. */
import { useEffect, useState } from "react";

export type Currency = "units" | "usd" | "gbp";

export type PriceBook = Readonly<{
	usd: Readonly<Record<string, number>>;
	gbpPerUsd: number | null;
}>;

const EMPTY: PriceBook = { usd: {}, gbpPerUsd: null };

export function usePrices(mints: readonly string[]): PriceBook {
	const [book, setBook] = useState<PriceBook>(EMPTY);
	const key = mints.join(",");

	useEffect(() => {
		if (!key) return;

		let live = true;

		fetch(`/api/prices?ids=${key}`)
			.then((response) => response.json())
			.then((body: unknown) => {
				if (!live || typeof body !== "object" || body === null) return;

				const usd = Reflect.get(body, "usd");
				const gbp = Reflect.get(body, "gbpPerUsd");
				const entries = typeof usd === "object" && usd !== null
					? Object.entries(usd).filter((entry): entry is [string, number] =>
						typeof entry[1] === "number"
					)
					: [];

				setBook({
					usd: Object.fromEntries(entries),
					gbpPerUsd: typeof gbp === "number" ? gbp : null,
				});
			})
			// Prices are a convenience; amounts still work in token units.
			.catch(() => live && setBook(EMPTY));

		return () => {
			live = false;
		};
	}, [key]);

	return book;
}
