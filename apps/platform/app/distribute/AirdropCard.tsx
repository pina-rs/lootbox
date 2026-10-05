/**
 * Send boxes to a list of wallets. The creator pays for delivery: rent for
 * every recipient without a box account yet, plus one fee per batch of six.
 * The estimate checks the chain, so it shows the real cost before signing.
 */
import type { LootboxClient } from "@pina-rs/lootbox";
import { ActionCard } from "@pina-rs/lootbox-ui";
import {
	getCreateAssociatedTokenIdempotentInstruction,
	getTransferCheckedInstruction,
} from "@solana-program/token-2022";
import { address, type Instruction } from "@solana/kit";
import { useRef, useState } from "react";

import { batches, parseDistribution } from "../lib/distribution.js";
import { formatSol } from "../lib/plan.js";
import { useAirdropCost } from "./hooks.js";

export type Run = (work: () => Promise<void>) => Promise<void>;

type Props = Readonly<{
	client: LootboxClient;
	rpcUrl: string;
	boxMint: string;
	owner: string;
	/** Boxes in the creator's wallet, when known. */
	balance: bigint | null;
	busy: boolean;
	run: Run;
}>;

export function AirdropCard(
	{ client, rpcUrl, boxMint, owner, balance, busy, run }: Props,
) {
	const [text, setText] = useState("");
	const [sent, setSent] = useState<string | null>(null);
	const file = useRef<HTMLInputElement>(null);
	const plan = parseDistribution(text);
	const [cost, reloadCost] = useAirdropCost(rpcUrl, boxMint, plan.recipients);
	const short = balance !== null && plan.total > balance;
	const ready = plan.recipients.length > 0 && plan.errors.length === 0 &&
		!short;

	return (
		<ActionCard
			kind="airdrop"
			id="airdrop"
			title="Send to a list"
			summary="Paste wallets and counts. You cover delivery, so it's free to receive."
		>
			<div className="field">
				<label htmlFor="distribution">Recipients</label>
				<textarea
					id="distribution"
					value={text}
					placeholder={"One wallet per line, optionally with a count:\n7xKX…q9 3"}
					spellCheck={false}
					disabled={busy}
					onChange={(event) => setText(event.currentTarget.value)}
				/>
				<span className="field-hint">
					Paste a list, or{" "}
					<button
						type="button"
						className="link-button"
						disabled={busy}
						onClick={() => file.current?.click()}
					>
						load a CSV
					</button>
					.
					<input
						ref={file}
						type="file"
						accept=".csv,.txt,text/csv,text/plain"
						disabled={busy}
						hidden
						onChange={async (event) => {
							const chosen = event.currentTarget.files?.[0];

							if (chosen) setText(await chosen.text());
						}}
					/>
				</span>
			</div>
			{plan.errors.length > 0 && (
				<ul className="form-error">
					{plan.errors.slice(0, 5).map((problem) => (
						<li key={problem}>{problem}</li>
					))}
				</ul>
			)}
			{plan.recipients.length > 0 && (
				<dl
					className="cost-table"
					aria-live="polite"
					data-testid="airdrop-cost"
				>
					<div>
						<dt>
							{plan.total.toLocaleString("en-US")}{" "}
							{plan.total === 1n ? "box" : "boxes"} to{" "}
							{plan.recipients.length.toLocaleString("en-US")}{" "}
							{plan.recipients.length === 1 ? "wallet" : "wallets"}
							<small>
								{cost?.status === "ready"
									? `${cost.value.transactions} ${
										cost.value.transactions === 1
											? "transaction"
											: "transactions"
									} to sign`
									: cost?.status === "error"
									? "Could not check wallets"
									: "Checking wallets…"}
							</small>
						</dt>
						<dd>
							{balance === null
								? ""
								: `${balance.toLocaleString("en-US")} in your wallet`}
						</dd>
					</div>
					{cost?.status === "ready" && (
						<>
							<div>
								<dt>
									New box accounts
									<small>
										{cost.value.newAccounts} of {plan.recipients.length}{" "}
										wallets need one; its rent stays with them
									</small>
								</dt>
								<dd>{formatSol(cost.value.accountRent)}</dd>
							</div>
							<div className="total">
								<dt>You pay</dt>
								<dd>{formatSol(cost.value.total)}</dd>
							</div>
						</>
					)}
				</dl>
			)}
			{cost?.status === "error" && (
				<p className="form-error" role="alert">
					Could not estimate delivery: {cost.message}{" "}
					<button
						type="button"
						className="link-button"
						disabled={busy}
						onClick={reloadCost}
					>
						Retry estimate
					</button>
				</p>
			)}
			{short && (
				<p className="form-error" role="status">
					You have {balance?.toLocaleString("en-US")} boxes; this list needs
					{" "}
					{plan.total.toLocaleString("en-US")}.
				</p>
			)}
			<button
				type="button"
				className="button button-primary"
				disabled={busy || !ready || cost?.status !== "ready"}
				onClick={() =>
					void run(async () => {
						const mint = address(boxMint);
						const source = await client.ata(address(owner), mint);
						const groups = batches(plan.recipients);
						let delivered = 0n;

						for (const [index, group] of groups.entries()) {
							const instructions: Instruction[] = [];

							for (const recipient of group) {
								const destination = await client.ata(
									address(recipient.address),
									mint,
								);

								instructions.push(
									getCreateAssociatedTokenIdempotentInstruction({
										payer: client.payer,
										ata: destination,
										owner: address(recipient.address),
										mint,
									}),
									getTransferCheckedInstruction({
										source,
										mint,
										destination,
										authority: client.payer,
										amount: recipient.count,
										decimals: 0,
									}),
								);
							}

							await client.send(
								instructions,
								`Send boxes · batch ${index + 1} of ${groups.length}`,
							);
							delivered += group.reduce(
								(total, recipient) => total + recipient.count,
								0n,
							);
							setSent(`Sent ${delivered} of ${plan.total} boxes.`);
							// Retain only undelivered recipients if a later approval fails.
							setText(
								groups.slice(index + 1).flat().map(({ address, count }) =>
									`${address} ${count}`
								).join("\n"),
							);
						}

						setSent(
							`Sent ${plan.total} ${plan.total === 1n ? "box" : "boxes"}.`,
						);
					})}
			>
				{plan.total === 0n
					? "Send boxes"
					: `Send ${plan.total.toLocaleString("en-US")} ${
						plan.total === 1n ? "box" : "boxes"
					}`}
			</button>
			{sent && (
				<p className="notice" role="status" data-testid="sent">
					{sent}
				</p>
			)}
		</ActionCard>
	);
}
