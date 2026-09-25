import "@fontsource/bungee/400.css";
import "@fontsource-variable/space-grotesk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import LaunchApp from "./LaunchApp.js";
import "./launch.css";

/** Mount the public recipient site. */
export function mountLaunch(root: HTMLElement): void {
	createRoot(root).render(
		<StrictMode>
			<LaunchApp />
		</StrictMode>,
	);
}
