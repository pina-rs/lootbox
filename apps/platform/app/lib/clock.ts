/**
 * The cluster's clock, read from the Clock sysvar: the exact timestamp the
 * program compares reveal dates against. `getBlockTime` can lag it (and does
 * not follow Surfpool time travel), so every reveal check uses this instead.
 */
import { address, createSolanaRpc, getBase64Encoder } from "@solana/kit";

const CLOCK_SYSVAR = address("SysvarC1ock11111111111111111111111111111111");
/** `Clock` layout: slot, epoch_start_timestamp, epoch, leader_schedule_epoch, unix_timestamp. */
const UNIX_TIMESTAMP_OFFSET = 32;

export async function clusterTime(
	rpc: ReturnType<typeof createSolanaRpc>,
): Promise<number> {
	const { value } = await rpc.getAccountInfo(CLOCK_SYSVAR, {
		encoding: "base64",
		commitment: "processed",
	}).send();

	if (!value) throw new Error("The cluster did not return its clock");

	const bytes = getBase64Encoder().encode(value.data[0]);

	return Number(
		new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigInt64(
			UNIX_TIMESTAMP_OFFSET,
			true,
		),
	);
}
