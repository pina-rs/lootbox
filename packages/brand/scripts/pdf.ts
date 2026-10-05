/**
 * Vector PDFs of the exported SVGs, printed by headless Chrome. Its PDF
 * backend turns SVG clip paths into real PDF clipping paths, which every
 * viewer and print RIP draws alike; converters that emulate clips with soft
 * masks lose the pupils and lid straps in macOS Preview.
 *
 * Needs Playwright's Chromium: `pnpm --dir apps/platform exec playwright
 * install chromium`.
 */
import { chromium } from "playwright-core";

export type PdfPage = Readonly<{
	title: string;
	/** The SVG's own size in CSS px. Chrome prints 1 px as 0.75 pt. */
	width: number;
	height: number;
}>;

export type PdfJob = Readonly<{ svg: string; page: PdfPage }>;

/** Chrome stamps the print time; a fixed stamp keeps re-exports identical. */
const STAMP = "D:20260928000000+00'00'";

export async function printPdfs(jobs: readonly PdfJob[]): Promise<Buffer[]> {
	const browser = await chromium.launch();

	try {
		const tab = await browser.newPage();
		const pdfs: Buffer[] = [];

		for (const { svg, page } of jobs) {
			await tab.setContent(
				`<!doctype html><html><head><meta charset="utf-8"><title>${page.title}</title>` +
					"<style>@page{margin:0}html,body{margin:0}svg{display:block}</style>" +
					`</head><body>${svg}</body></html>`,
			);
			pdfs.push(pinDates(
				await tab.pdf({
					width: `${page.width}px`,
					height: `${page.height}px`,
					printBackground: true,
					pageRanges: "1",
				}),
			));
		}

		return pdfs;
	} finally {
		await browser.close();
	}
}

/** Replace the print-time stamps in place, keeping every byte offset. */
function pinDates(pdf: Buffer): Buffer {
	const text = pdf.toString("latin1");
	const pinned = text.replace(
		/\/(CreationDate|ModDate) \(D:\d{14}\+00'00'\)/g,
		(_match, key: string) => `/${key} (${STAMP})`,
	);

	// The cross-reference table stores byte offsets, so the length must hold.
	if (pinned.length !== text.length) {
		throw new Error("Pinning the PDF's dates changed its length");
	}

	return Buffer.from(pinned, "latin1");
}
