/**
 * Two surfaces share one static build: the public recipient site at `/` and
 * the local creator playground at `/playground`. Each loads only its own code
 * and styles, so the launch page never ships the workshop.
 */
const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
	throw new Error("missing application root");
}

const path = location.pathname.replace(/\/+$/, "");

if (path === "/playground") {
	const { mountPlayground } = await import("./playground-entry.js");

	mountPlayground(root);
} else {
	const { mountLaunch } = await import("./launch/entry.js");

	mountLaunch(root);
}

export {};
