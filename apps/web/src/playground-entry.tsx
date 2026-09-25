import "@fontsource/bungee/400.css";
import "@fontsource-variable/space-grotesk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.js";
import "./styles.css";
import "./workshop.css";

/** Mount the local Surfpool creator playground. */
export function mountPlayground(root: HTMLElement): void {
	document.title = "Lootbox playground";
	createRoot(root).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
}
