import "@fontsource/bungee/400.css";
import "@fontsource-variable/space-grotesk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.js";
import "./styles.css";
import "./workshop.css";

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
	throw new Error("missing application root");
}

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
