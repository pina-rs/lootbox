import "@fontsource/bungee/400.css";
import "@fontsource-variable/space-grotesk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import LaunchApp from "./LaunchApp.js";
import Rules from "./Rules.js";
import "./launch.css";

/** Mount the public recipient site or its official rules page. */
export function mountLaunch(root: HTMLElement, route: string): void {
	createRoot(root).render(
		<StrictMode>
			{route === "/rules" ? <Rules /> : <LaunchApp />}
		</StrictMode>,
	);
}
