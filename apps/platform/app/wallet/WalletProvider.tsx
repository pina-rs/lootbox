/**
 * Wallet Standard discovery and the selected account.
 *
 * Any wallet that registers with Wallet Standard and can sign Solana
 * transactions appears: Phantom, Solflare, Backpack, and the rest. No wallet
 * adapter packages and no private keys ever enter the app.
 */
import { SelectedWalletAccountContextProvider } from "@solana/react";
import type { UiWallet } from "@wallet-standard/react";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";

import { ConnectDialog } from "./ConnectDialog.js";

const STORAGE_KEY = "lootbox:wallet";

function canSignSolana(wallet: UiWallet): boolean {
	return wallet.chains.some((chain) => chain.startsWith("solana:")) &&
		wallet.features.includes("solana:signTransaction");
}

/** Storage can throw (private mode, blocked site data); the choice is a nicety. */
const stateSync = {
	getSelectedWallet(): string | null {
		try {
			return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
		} catch {
			return null;
		}
	},
	storeSelectedWallet(key: string): void {
		try {
			globalThis.localStorage?.setItem(STORAGE_KEY, key);
		} catch {
			// Remembering the wallet is optional.
		}
	},
	deleteSelectedWallet(): void {
		try {
			globalThis.localStorage?.removeItem(STORAGE_KEY);
		} catch {
			// Forgetting the wallet is optional.
		}
	},
};

type WalletUi = Readonly<{ openConnect: () => void }>;

const WalletUiContext = createContext<WalletUi>({ openConnect: () => {} });

/** Open the shared connect dialog from anywhere. */
export function useWalletUi(): WalletUi {
	return useContext(WalletUiContext);
}

export function WalletProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const hydrated = useHydrated();
	const ui = useMemo(() => ({ openConnect: () => setOpen(true) }), []);

	return (
		<SelectedWalletAccountContextProvider
			filterWallets={canSignSolana}
			stateSync={stateSync}
		>
			<WalletUiContext value={ui}>
				{children}
				{hydrated && (
					<ConnectDialog
						open={open}
						onClose={() => setOpen(false)}
					/>
				)}
			</WalletUiContext>
		</SelectedWalletAccountContextProvider>
	);
}

const noop = () => () => {};

/**
 * False during server rendering and hydration, true afterwards. Wallet state
 * only exists in the browser, so wallet UI waits for this to avoid a
 * hydration mismatch.
 */
export function useHydrated(): boolean {
	return useSyncExternalStore(noop, () => true, () => false);
}
