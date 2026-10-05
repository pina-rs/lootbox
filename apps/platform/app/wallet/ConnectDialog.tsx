/**
 * Our own wallet picker: every Wallet Standard wallet, big tap targets, and
 * a phone-friendly bottom sheet. With no wallet installed it offers to open
 * this page inside a wallet's in-app browser instead.
 */
import { useSelectedWalletAccount } from "@solana/react";
import { type UiWallet, useConnect } from "@wallet-standard/react";
import { useEffect, useRef, useState } from "react";

type Props = Readonly<{ open: boolean; onClose: () => void }>;

const WALLET_LINKS = [
	{
		name: "Phantom",
		install: "https://phantom.app/download",
		browse: (url: string) =>
			`https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${
				encodeURIComponent(new URL(url).origin)
			}`,
	},
	{
		name: "Solflare",
		install: "https://solflare.com/download",
		browse: (url: string) =>
			`https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${
				encodeURIComponent(new URL(url).origin)
			}`,
	},
	{
		name: "Backpack",
		install: "https://backpack.app/download",
		browse: null,
	},
] as const;

function WalletRow(
	{ wallet, onConnected, onError }: Readonly<{
		wallet: UiWallet;
		onConnected: () => void;
		onError: (message: string) => void;
	}>,
) {
	const [, setAccount] = useSelectedWalletAccount();
	const [connecting, connect] = useConnect(wallet);

	return (
		<li>
			<button
				type="button"
				className="wallet-option"
				disabled={connecting}
				onClick={async () => {
					try {
						const accounts = await connect();
						const account = accounts[0] ?? wallet.accounts[0];

						if (!account) {
							onError(`${wallet.name} did not share an account.`);
							return;
						}

						setAccount(account);
						onConnected();
					} catch (error) {
						onError(
							error instanceof Error
								? `${wallet.name}: ${error.message}`
								: `${wallet.name} did not connect.`,
						);
					}
				}}
			>
				<img src={wallet.icon} alt="" width={36} height={36} />
				<span>{wallet.name}</span>
				<span className="wallet-option-hint">
					{connecting ? "Check your wallet…" : "Connect"}
				</span>
			</button>
		</li>
	);
}

export function ConnectDialog({ open, onClose }: Props) {
	const dialog = useRef<HTMLDialogElement>(null);
	const [, , wallets] = useSelectedWalletAccount();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const element = dialog.current;

		if (!element) return;

		if (open && !element.open) {
			setError(null);
			element.showModal();
		}

		if (!open && element.open) element.close();
	}, [open]);

	const here = typeof location === "undefined" ? "" : location.href;

	return (
		<dialog
			ref={dialog}
			className="sheet"
			aria-labelledby="connect-title"
			onClose={onClose}
			onClick={(event) => {
				// A click on the backdrop lands on the dialog element itself.
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div className="sheet-body">
				<header className="sheet-header">
					<h2 id="connect-title">Connect a wallet</h2>
					<button
						type="button"
						className="icon-button"
						aria-label="Close"
						onClick={onClose}
					>
						✕
					</button>
				</header>
				{wallets.length > 0
					? (
						<ul className="wallet-list" aria-label="Available wallets">
							{wallets.map((wallet) => (
								<WalletRow
									key={wallet.name}
									wallet={wallet}
									onConnected={onClose}
									onError={setError}
								/>
							))}
						</ul>
					)
					: (
						<div className="empty-wallets">
							<p>
								No Solana wallet found in this browser. Install one, or open
								this page in your wallet app.
							</p>
							<ul className="wallet-list">
								{WALLET_LINKS.map((link) => (
									<li key={link.name} className="wallet-link">
										<strong>{link.name}</strong>
										<span>
											{link.browse && here && (
												<a href={link.browse(here)}>Open in app</a>
											)}
											<a href={link.install} target="_blank" rel="noreferrer">
												Get it
											</a>
										</span>
									</li>
								))}
							</ul>
						</div>
					)}
				{error && <p className="form-error" role="alert">{error}</p>}
				<p className="fine">
					Connecting shares your address only. Nothing is signed until you
					approve it in your wallet.
				</p>
			</div>
		</dialog>
	);
}
