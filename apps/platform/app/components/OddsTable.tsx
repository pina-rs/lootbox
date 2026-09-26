import { describeChance } from "../lib/plan.js";
import type { PrizeView } from "../lib/prizes.js";

/**
 * Live odds: each remaining copy is one equal ticket, so a prize's chance is
 * its copies left over all copies left. Depleted prizes stay listed at 0.
 */
export function OddsTable(
	{ prizes, compact = false }: Readonly<{
		prizes: readonly PrizeView[];
		compact?: boolean;
	}>,
) {
	const total = prizes.reduce((sum, prize) => sum + prize.remaining, 0n);

	return (
		<table className="odds" data-testid="odds-table">
			<thead>
				<tr>
					<th scope="col">Prize</th>
					{!compact && <th scope="col" className="num hide-narrow">Left</th>}
					<th scope="col" className="num">Chance</th>
				</tr>
			</thead>
			<tbody>
				{prizes.map((prize) => {
					const percent = total === 0n
						? 0
						: Number(prize.remaining * 10_000n / total) / 100;

					return (
						<tr key={prize.index} data-empty={prize.remaining === 0n}>
							<td>
								<span className="prize-name">
									{prize.tier === "headline" && "★ "}
									{prize.title}
								</span>
								{prize.lines.length > 0 &&
									(prize.lines.length > 1 || prize.lines[0] !== prize.title) &&
									(
										<span className="prize-detail">
											{prize.lines.join(" + ")}
										</span>
									)}
								<span className="odds-bar" aria-hidden="true">
									<span
										style={{
											inlineSize: `${
												Math.max(percent, prize.remaining > 0n ? 1 : 0)
											}%`,
										}}
									/>
								</span>
							</td>
							{!compact && (
								<td className="num hide-narrow">
									{prize.remaining.toLocaleString("en-US")} /{" "}
									{prize.quantity.toLocaleString("en-US")}
								</td>
							)}
							<td className="num">
								<strong>{describeChance(prize.remaining, total)}</strong>
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}
