import type { ReactNode } from "react";

import { assetUrl } from "./assets.js";

/** Link to the official rules page, carrying the localnet treasury override. */
export function RulesLink({ children }: Readonly<{ children: ReactNode }>) {
	return <a href={`${assetUrl("rules")}${location.search}`}>{children}</a>;
}
