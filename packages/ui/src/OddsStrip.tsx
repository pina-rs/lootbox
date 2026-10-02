/**
 * Every box in a lootbox as one strip, split by what it can win. A bundle's
 * share of the strip is its chance, so adding copies visibly shrinks the
 * others. The legend spells out each chance for screen readers and small
 * screens.
 */
import { formatCount } from "./format.ts";

export type OddsTone = "gold" | "teal" | "lock" | "plum" | "sky" | "ivory";

export type OddsSegment = Readonly<{
	key: string;
	label: string;
	/** Boxes that win this bundle. Fractions are fine for animation. */
	count: number;
	tone?: OddsTone;
}>;

export type OddsStripProps = Readonly<{
	segments: readonly OddsSegment[];
	/** Hide the legend when a surrounding table already lists the chances. */
	legend?: boolean;
	/**
	 * `chance` reads "1 in 25" for long shots, as odds should; `share` always
	 * reads a percentage, for splits that are not a draw.
	 */
	phrasing?: "chance" | "share";
	className?: string;
}>;

const TONES: readonly OddsTone[] = ["gold", "teal", "lock", "plum", "sky"];

/** The tone for the `index`th bundle when none is chosen. */
export function oddsTone(index: number): OddsTone {
	return TONES[index % TONES.length] ?? "gold";
}

/** "1 in 25" for long shots, a percentage otherwise. */
export function describeShare(count: number, total: number): string {
	if (total <= 0 || count <= 0) return "0%";

	const share = count / total;

	if (share < 0.1) {
		return `1 in ${
			(1 / share).toLocaleString("en-US", { maximumFractionDigits: 1 })
		}`;
	}

	return `${
		(share * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })
	}%`;
}

/** Always a percentage. */
export function describePercent(count: number, total: number): string {
	if (total <= 0 || count <= 0) return "0%";

	return `${
		((count / total) * 100).toLocaleString("en-US", {
			maximumFractionDigits: 1,
		})
	}%`;
}

export function OddsStrip(
	{ segments, legend = true, phrasing = "chance", className }: OddsStripProps,
) {
	const total = segments.reduce(
		(sum, segment) => sum + Math.max(0, segment.count),
		0,
	);
	const visible = segments.filter((segment) => segment.count > 0);

	return (
		<figure className={["odds-strip", className].filter(Boolean).join(" ")}>
			<div className="odds-strip-bar" aria-hidden="true">
				{visible.map((segment) => (
					<span
						key={segment.key}
						className="odds-strip-segment"
						data-tone={segment.tone ??
							oddsTone(segments.indexOf(segment))}
						style={{ flexGrow: segment.count }}
					/>
				))}
				{total === 0 && <span className="odds-strip-empty" />}
			</div>
			{legend && (
				<figcaption className="odds-strip-legend">
					<ul>
						{segments.map((segment, index) => (
							<li key={segment.key}>
								<span
									className="odds-strip-swatch"
									data-tone={segment.tone ?? oddsTone(index)}
								/>
								<span className="odds-strip-label">{segment.label}</span>
								<span className="odds-strip-count">
									{formatCount(Math.round(segment.count))} ·{" "}
									<b>
										{phrasing === "chance"
											? describeShare(segment.count, total)
											: describePercent(segment.count, total)}
									</b>
								</span>
							</li>
						))}
					</ul>
				</figcaption>
			)}
		</figure>
	);
}
