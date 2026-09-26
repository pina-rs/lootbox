import {
	LAYER,
	type LayerId,
	resolveTraits,
	type TraitVector,
} from "./layers.ts";

/**
 * Derived render rules for trait combinations that clash on screen.
 *
 * Rules change only how a vector is drawn, never what it is: odds, metadata,
 * and the URI ignore them. The SVG renderer applies them directly and the Rive
 * generator compiles each into its data-binding converters, so both agree.
 */
export type RuleEffect =
	| Readonly<{ kind: "hide"; layer: LayerId }>
	| Readonly<{ kind: "offset"; layer: LayerId; x: number; y: number }>;

export type RenderRule = Readonly<{
	name: string;
	/** Why the rule exists, for the catalog and reviewers. */
	reason: string;
	/** Every listed layer must show one of the listed traits. */
	when: Readonly<Partial<Record<LayerId, readonly number[]>>>;
	effect: RuleEffect;
}>;

/** Contents that rise above the lid line far enough to collide with trim on it. */
const TALL_CONTENTS = [0, 3, 6, 8, 11, 12];

export const RENDER_RULES: readonly RenderRule[] = Object.freeze([
	{
		name: "Tall contents clear the crown trim",
		reason:
			"A tall item or a paper crown would stack on the lid's crown trim; one crown at a time.",
		when: { contents: TALL_CONTENTS, decoration: [9] },
		effect: { kind: "hide", layer: "decoration" },
	},
	{
		name: "The keyhole eye joins the googly eyes",
		reason:
			"Three eyes read as a face once the lock drops below the googly pair.",
		when: { decoration: [11], lock: [8] },
		effect: { kind: "offset", layer: "lock", x: 0, y: 14 },
	},
]);

export type RenderPlan = Readonly<{
	hidden: ReadonlySet<LayerId>;
	offsets: Readonly<
		Partial<Record<LayerId, Readonly<{ x: number; y: number }>>>
	>;
}>;

export function ruleApplies(rule: RenderRule, traits: TraitVector): boolean {
	return Object.entries(rule.when).every(([layer, values]) =>
		values.includes(traits[LAYER[layer as LayerId]] ?? -1)
	);
}

/** Which layers to hide or nudge for `traits`. */
export function renderPlan(traits: TraitVector): RenderPlan {
	resolveTraits(traits);

	const hidden = new Set<LayerId>();
	const offsets: Partial<Record<LayerId, { x: number; y: number }>> = {};

	for (const rule of RENDER_RULES) {
		if (!ruleApplies(rule, traits)) {
			continue;
		}

		if (rule.effect.kind === "hide") {
			hidden.add(rule.effect.layer);
			continue;
		}

		const current = offsets[rule.effect.layer] ?? { x: 0, y: 0 };

		offsets[rule.effect.layer] = {
			x: current.x + rule.effect.x,
			y: current.y + rule.effect.y,
		};
	}

	return { hidden, offsets };
}
