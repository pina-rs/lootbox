import { describe, expect, it, vi } from "vitest";

import { readFormData, readJson } from "./context.js";

function streamedRequest(
	chunks: readonly Uint8Array[],
	headers: HeadersInit = {},
) {
	let index = 0;
	const cancel = vi.fn();
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			const chunk = chunks[index++];

			if (chunk) controller.enqueue(chunk);
			else controller.close();
		},
		cancel,
	}, { highWaterMark: 0 });
	const init = { method: "POST", body, headers, duplex: "half" };

	return {
		request: new Request("https://example.test", init),
		cancel,
		read: () => index,
	};
}

describe("bounded request parsing", () => {
	it("cancels oversized chunked JSON before reading the rest", async () => {
		const { request, cancel, read } = streamedRequest([
			new Uint8Array(8),
			new Uint8Array(8),
			new Uint8Array(100),
		]);

		await expect(readJson(request, 10)).rejects.toMatchObject({ status: 413 });
		expect(cancel).toHaveBeenCalledOnce();
		expect(read()).toBe(2);
	});

	it("counts UTF-8 bytes and accepts the exact boundary", async () => {
		const bytes = new TextEncoder().encode('"é"');

		await expect(readJson(streamedRequest([bytes]).request, 3)).rejects
			.toMatchObject({ status: 413 });
		await expect(readJson(streamedRequest([bytes]).request, 4)).resolves.toBe(
			"é",
		);
	});

	it.each(["", "{", '"\ud800'])(
		"rejects empty or malformed JSON %j",
		async (body) => {
			await expect(
				readJson(new Request("https://example.test", { method: "POST", body })),
			).rejects.toMatchObject({ status: 400 });
		},
	);

	it.each([undefined, "1"])(
		"caps multipart independently of declared length %s",
		async (length) => {
			const headers = new Headers({
				"Content-Type": "multipart/form-data; boundary=x",
			});

			if (length) headers.set("Content-Length", length);

			const { request, cancel, read } = streamedRequest([
				new Uint8Array(8),
				new Uint8Array(8),
				new Uint8Array(100),
			], headers);

			await expect(readFormData(request, 10)).rejects.toMatchObject({
				status: 413,
			});
			expect(cancel).toHaveBeenCalledOnce();
			expect(read()).toBe(2);
		},
	);

	it("parses bounded multipart files and rejects malformed forms", async () => {
		const form = new FormData();
		form.set("file", new File(["cover"], "cover.png", { type: "image/png" }));
		const parsed = await readFormData(
			new Request("https://example.test", { method: "POST", body: form }),
			1024,
		);

		const file = parsed.get("file");

		expect(file).toBeInstanceOf(File);

		if (!(file instanceof File)) throw new Error("Expected a file");

		expect(await file.text()).toBe("cover");
		await expect(
			readFormData(
				new Request("https://example.test", { method: "POST", body: "broken" }),
				1024,
			),
		).rejects.toMatchObject({ status: 400 });
	});
});
