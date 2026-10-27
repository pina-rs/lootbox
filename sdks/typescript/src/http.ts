/** Byte and time limits for an upstream response, including its streamed body. */
export type ResponseLimits = Readonly<{
	maxBytes: number;
	timeoutMs: number;
	fetch?: typeof fetch;
}>;

/** Reject a stalled operation even when an injected transport ignores abort. */
async function withAbort<T>(
	operation: () => Promise<T>,
	signal: AbortSignal,
): Promise<T> {
	signal.throwIfAborted();
	let abort: () => void = () => {};
	const aborted = new Promise<never>((_resolve, reject) => {
		abort = () => reject(signal.reason);
		signal.addEventListener("abort", abort, { once: true });
	});

	try {
		return await Promise.race([operation(), aborted]);
	} finally {
		signal.removeEventListener("abort", abort);
	}
}

/** Consume at most `maxBytes` of decoded response bytes and cancel excess input. */
export async function readBoundedText(
	response: Response,
	maxBytes: number,
	signal: AbortSignal,
): Promise<string> {
	const declared = response.headers.get("Content-Length");

	if (declared !== null && Number(declared) > maxBytes) {
		void response.body?.cancel().catch(() => {});
		throw new RangeError("upstream response exceeds the byte limit");
	}

	if (!response.body) return "";

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;

	try {
		while (true) {
			const { done, value } = await withAbort(() => reader.read(), signal);
			signal.throwIfAborted();

			if (done) break;

			size += value.byteLength;

			if (size > maxBytes) {
				throw new RangeError("upstream response exceeds the byte limit");
			}

			chunks.push(value);
		}
	} finally {
		// Cancel without waiting: an adversarial source can leave cancel pending.
		void reader.cancel().catch(() => {});
		reader.releaseLock();
	}

	const bytes = new Uint8Array(size);
	let offset = 0;

	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** Fetch an upstream body under one mandatory deadline and streaming byte cap. */
export async function fetchBoundedText(
	input: RequestInfo | URL,
	init: RequestInit,
	limits: ResponseLimits,
): Promise<Readonly<{ response: Response; text: string }>> {
	const signal = AbortSignal.any([
		AbortSignal.timeout(limits.timeoutMs),
		...(init.signal ? [init.signal] : []),
	]);
	const fetcher = limits.fetch ?? globalThis.fetch.bind(globalThis);
	const response = await withAbort(
		() => fetcher(input, { ...init, redirect: "error", signal }),
		signal,
	);
	const text = await readBoundedText(response, limits.maxBytes, signal);

	return { response, text };
}
