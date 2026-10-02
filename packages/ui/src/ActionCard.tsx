/**
 * One way to hand boxes out: an illustration, a title, a one-line promise,
 * and whatever form or status the path needs underneath.
 */
import type { ReactNode } from "react";

import { AirdropIcon, CurveIcon } from "./icons.tsx";

export type ActionKind = "airdrop" | "curve";

export type ActionCardProps = Readonly<{
	kind: ActionKind;
	title: string;
	summary: string;
	/** A short state such as "Open" or "Sold out". */
	status?: string;
	children?: ReactNode;
	id?: string;
}>;

export function ActionCard(
	{ kind, title, summary, status, children, id }: ActionCardProps,
) {
	const Icon = kind === "airdrop" ? AirdropIcon : CurveIcon;
	const headingId = id ? `${id}-title` : undefined;

	return (
		<section
			className="action-card"
			data-kind={kind}
			id={id}
			aria-labelledby={headingId}
		>
			<header className="action-card-head">
				<Icon className="action-card-icon" width={56} height={56} />
				<div>
					<h3 id={headingId}>{title}</h3>
					<p>{summary}</p>
				</div>
				{status && <span className="action-card-status">{status}</span>}
			</header>
			{children && <div className="action-card-body">{children}</div>}
		</section>
	);
}
