import { Link } from "react-router";

import { Markdown } from "../components/Markdown.js";
import { OddsTable } from "../components/OddsTable.js";
import { revealState } from "../lib/chain.js";
import { prizeViews } from "../lib/prizes.js";
import { useClusterInfo } from "../lib/public-config.js";
import { HolderPanel } from "../open/HolderPanel.js";
import { useSession } from "../wallet/session.js";
import { useHydrated, useWalletUi } from "../wallet/WalletProvider.js";
import { useLootbox } from "./lootbox.js";

export default function Overview() {
	const { lootbox, chain, isCreator, now } = useLootbox();
	const cluster = useClusterInfo(lootbox.cluster);
	const { account } = useSession();
	const { openConnect } = useWalletUi();
	const hydrated = useHydrated();
	const prizes = chain ? prizeViews(chain.bundles, lootbox.bundles) : [];
	const reveal = chain ? revealState({ ...chain, chainTime: now }) : "unlocked";
	const top = [...prizes].sort((a, b) => (a.quantity < b.quantity ? -1 : 1))
		.slice(0, 5);

	return (
		<div className="two-col">
			<div className="stack">
				{reveal === "unlocked" && (
					<p className="notice" role="status">
						{isCreator
							? (
								<>
									Your lootbox is live but not locked. Add prizes or{" "}
									<Link to={`/l/${lootbox.slug}/manage`}>
										lock it in Manage
									</Link>{" "}
									to mint the boxes.
								</>
							)
							: "The creator is still filling this lootbox. Boxes go out once it is locked."}
					</p>
				)}
				{hydrated && account && cluster && chain
					? (
						<HolderPanel
							account={account}
							cluster={cluster}
							template={lootbox.template}
							boxMint={lootbox.boxMint}
							prizes={prizes}
							reveal={reveal}
							secondsToReveal={chain.opensAt - now}
						/>
					)
					: (
						<section className="stage card" aria-labelledby="connect-cta">
							<img
								src="/chest/chest-closed.webp"
								alt=""
								width={280}
								height={280}
							/>
							<h2 id="connect-cta">Got a box?</h2>
							<p className="muted">
								Connect your wallet to see your boxes and open them.
							</p>
							<button
								type="button"
								className="button button-primary"
								disabled={!hydrated}
								onClick={openConnect}
							>
								Connect wallet
							</button>
						</section>
					)}
			</div>
			<div className="stack">
				<section className="card" aria-labelledby="inside-title">
					<div className="section-head">
						<h2 id="inside-title">What's inside</h2>
						<Link to={`/l/${lootbox.slug}/odds`}>All odds</Link>
					</div>
					{prizes.length > 0
						? <OddsTable prizes={top} compact />
						: <p className="muted">No prizes yet.</p>}
				</section>
				{(lootbox.descriptionMd || lootbox.links.length > 0) && (
					<section className="card" aria-labelledby="about-title">
						<h2 id="about-title">About</h2>
						{lootbox.descriptionMd && (
							<Markdown source={lootbox.descriptionMd} />
						)}
						{lootbox.links.length > 0 && (
							<ul className="links">
								{lootbox.links.map((link) => (
									<li key={link.url}>
										<a
											href={link.url}
											rel="noreferrer nofollow"
											target="_blank"
										>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						)}
					</section>
				)}
			</div>
		</div>
	);
}
