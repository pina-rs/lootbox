/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** `localnet` (default), `devnet`, or `mainnet`. */
	readonly VITE_SOLANA_CLUSTER?: string;
	/** RPC endpoint for devnet/mainnet. Localnet reads it from the control plane. */
	readonly VITE_RPC_URL?: string;
	/** Locked treasury (template) address the recipient site presents. */
	readonly VITE_TREASURY?: string;
}
