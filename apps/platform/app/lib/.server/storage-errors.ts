/** Map only known database budget failures; preserve unexpected errors. */
export function storageErrorResponse(error: unknown): Response {
	if (error instanceof Error && error.message.includes("storage_quota")) {
		return Response.json({
			error:
				"Storage limit reached. Discard unused drafts or images and try again.",
		}, { status: 429 });
	}

	if (error instanceof Error && error.message.includes("upload_unavailable")) {
		return Response.json({
			error: "That image is unavailable. Upload it again.",
		}, { status: 409 });
	}

	throw error;
}
