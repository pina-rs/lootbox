import type { AppServices } from "./context.js";
import {
	deleteExpiredDrafts,
	deleteRetiredUpload,
	expiredUploads,
	retireUpload,
} from "./db.js";

type StorageCleanup = Readonly<{
	db: AppServices["db"];
	media: Pick<AppServices["media"], "delete">;
}>;

/** Delete R2 first; failed or interrupted deletion keeps its quota reservation. */
export async function deleteUnusedUpload(
	app: StorageCleanup,
	key: string,
	owner: string,
): Promise<boolean> {
	if (!(await retireUpload(app.db, key, owner))) return false;

	await app.media.delete(key);
	await deleteRetiredUpload(app.db, key);

	return true;
}

/** A bounded, idempotent maintenance pass also recovers crashed upload writes. */
export async function cleanupStorage(
	app: StorageCleanup,
	now: number,
): Promise<void> {
	await deleteExpiredDrafts(app.db, now);

	for (const upload of await expiredUploads(app.db, now)) {
		await deleteUnusedUpload(app, upload.key, upload.owner);
	}
}
