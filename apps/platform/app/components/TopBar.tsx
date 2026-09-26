/**
 * The one persistent navigation bar: logo home, Explore, Create, wallet.
 */
import { useSelectedWalletAccount } from "@solana/react";
import { type UiWallet, useDisconnect } from "@wallet-standard/react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useRevalidator } from "react-router";

import { shortAddress } from "../lib/bytes.js";
import { useSession } from "../wallet/session.js";
import { useHydrated, useWalletUi } from "../wallet/WalletProvider.js";

export function Logo() {
	return (
		<svg
			className="logo-mark"
			viewBox="0 0 64 64"
			aria-hidden="true"
			width={34}
			height={34}
		>
			<path
				d="M12 30c0-10 8.5-17 20-17s20 7 20 17v4H12z"
				fill="var(--teal)"
				stroke="var(--ink)"
				strokeWidth="3.5"
				strokeLinejoin="round"
			/>
			<rect
				x="12"
				y="30"
				width="40"
				height="22"
				rx="3"
				fill="var(--teal)"
				stroke="var(--ink)"
				strokeWidth="3.5"
			/>
			<path d="M12 30h40" stroke="var(--gold)" strokeWidth="5" />
			<rect
				x="26"
				y="25"
				width="12"
				height="15"
				rx="3"
				fill="var(--gold)"
				stroke="var(--ink)"
				strokeWidth="3"
			/>
			<circle cx="32" cy="31" r="2.2" fill="var(--ink)" />
		</svg>
	);
}

function DisconnectItem(
	{ wallet, onDone }: Readonly<{ wallet: UiWallet; onDone: () => void }>,
) {
	const [, setAccount] = useSelectedWalletAccount();
	const [busy, disconnect] = useDisconnect(wallet);

	return (
		<button
			type="button"
			role="menuitem"
			disabled={busy}
			onClick={async () => {
				await disconnect().catch(() => {
					// Some wallets refuse programmatic disconnects; forget it locally anyway.
				});
				setAccount(undefined);
				onDone();
			}}
		>
			Disconnect
		</button>
	);
}

function WalletMenu() {
	const [account, , wallets] = useSelectedWalletAccount();
	const { signedIn } = useSession();
	const { openConnect } = useWalletUi();
	const revalidator = useRevalidator();
	const [open, setOpen] = useState(false);
	const menu = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;

		const close = (event: Event) => {
			if (
				event instanceof KeyboardEvent
					? event.key === "Escape"
					: !menu.current?.contains(event.target as Node)
			) setOpen(false);
		};

		document.addEventListener("pointerdown", close);
		document.addEventListener("keydown", close);

		return () => {
			document.removeEventListener("pointerdown", close);
			document.removeEventListener("keydown", close);
		};
	}, [open]);

	if (!account) {
		return (
			<button
				type="button"
				className="button button-primary button-small"
				onClick={openConnect}
			>
				Connect
			</button>
		);
	}

	const wallet = wallets.find((item) =>
		item.accounts.some((candidate) => candidate.address === account.address)
	);

	return (
		<div className="wallet-menu" ref={menu}>
			<button
				type="button"
				className="wallet-pill"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				{wallet && <img src={wallet.icon} alt="" width={20} height={20} />}
				<span data-testid="wallet-address">
					{shortAddress(account.address)}
				</span>
				{signedIn && <span className="signed-dot" aria-label="signed in" />}
			</button>
			{open && (
				<div className="menu" role="menu">
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							void navigator.clipboard?.writeText(account.address);
							setOpen(false);
						}}
					>
						Copy address
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							setOpen(false);
							openConnect();
						}}
					>
						Switch wallet
					</button>
					{signedIn && (
						<button
							type="button"
							role="menuitem"
							onClick={async () => {
								await fetch("/api/auth/logout", { method: "POST" });
								setOpen(false);
								await revalidator.revalidate();
							}}
						>
							Sign out
						</button>
					)}
					{wallet && (
						<DisconnectItem
							wallet={wallet}
							onDone={() => setOpen(false)}
						/>
					)}
				</div>
			)}
		</div>
	);
}

export function TopBar() {
	const hydrated = useHydrated();

	return (
		<header className="topbar">
			<div className="topbar-inner">
				<Link to="/" className="brand" aria-label="lootbox.so home">
					<Logo />
					<span className="brand-word">lootbox</span>
				</Link>
				<nav aria-label="Main" className="topnav">
					<NavLink to="/explore">Explore</NavLink>
					<NavLink to="/create">Create</NavLink>
				</nav>
				<div className="topbar-wallet">
					{hydrated ? <WalletMenu /> : (
						<button
							type="button"
							className="button button-primary button-small"
							disabled
						>
							Connect
						</button>
					)}
				</div>
			</div>
		</header>
	);
}
