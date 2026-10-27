import { describe, expect, it } from "vitest";
import { fetchBoundedText, readBoundedText } from "./http.js";

describe("bounded upstream responses", () => {
	it("accepts exactly the byte cap, including multibyte text", async () => {
		const result = await fetchBoundedText("https://upstream.test", {}, {
			maxBytes: 4,
			timeoutMs: 100,
			fetch: async (_input, init) => {
				expect(init?.redirect).toBe("error");

				return new Response("éé");
			},
		});

		expect(result.text).toBe("éé");
	});

	it.each([undefined, "1"])(
		"cancels chunked excess with length %s",
		async (length) => {
			let pulls = 0;
			let canceled = false;
			const stream = new ReadableStream<Uint8Array>({
				pull(controller) {
					pulls += 1;
					controller.enqueue(new Uint8Array(4));
				},
				cancel() {
					canceled = true;
				},
			});
			const response = new Response(stream, {
				headers: length ? { "Content-Length": length } : {},
			});

			await expect(readBoundedText(response, 8, AbortSignal.timeout(100)))
				.rejects.toThrow("byte limit");
			expect(canceled).toBe(true);
			expect(pulls).toBeLessThanOrEqual(4);
		},
	);

	it("rejects an excessive declared length before reading", async () => {
		let canceled = false;
		const response = new Response(
			new ReadableStream({
				cancel() {
					canceled = true;
				},
			}),
			{ headers: { "Content-Length": "1000" } },
		);

		await expect(readBoundedText(response, 8, AbortSignal.timeout(100)))
			.rejects.toThrow("byte limit");
		expect(canceled).toBe(true);
	});

	it("keeps the size error when the source rejects cancellation", async () => {
		const response = new Response(
			new ReadableStream({
				cancel() {
					return Promise.reject(new Error("cancel failed"));
				},
			}),
			{ headers: { "Content-Length": "1000" } },
		);

		await expect(readBoundedText(response, 8, AbortSignal.timeout(100)))
			.rejects.toThrow("byte limit");
		await new Promise((resolve) => setTimeout(resolve, 0));
	});

	it("times out a body that never produces a chunk and cancels it", async () => {
		let canceled = false;
		const response = new Response(
			new ReadableStream({
				cancel() {
					canceled = true;
				},
			}),
		);

		await expect(fetchBoundedText("https://upstream.test", {}, {
			maxBytes: 32,
			timeoutMs: 20,
			fetch: async () => response,
		})).rejects.toMatchObject({ name: "TimeoutError" });
		expect(canceled).toBe(true);
	});

	it("times out a transport that ignores its signal", async () => {
		await expect(fetchBoundedText("https://upstream.test", {}, {
			maxBytes: 32,
			timeoutMs: 20,
			fetch: () => new Promise<Response>(() => {}),
		})).rejects.toMatchObject({ name: "TimeoutError" });
	});

	it("preserves caller cancellation", async () => {
		const controller = new AbortController();
		let requested = false;
		controller.abort(new Error("run deadline"));

		await expect(fetchBoundedText("https://upstream.test", {
			signal: controller.signal,
		}, {
			maxBytes: 32,
			timeoutMs: 100,
			fetch: () => {
				requested = true;

				return Promise.reject(new Error("transport must not start"));
			},
		})).rejects.toThrow("run deadline");
		expect(requested).toBe(false);
	});
});
