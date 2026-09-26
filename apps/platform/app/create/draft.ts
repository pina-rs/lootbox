/**
 * Wizard state: the draft being edited, saved to D1 as the creator types.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type { Cluster } from "../lib/clusters.js";
import { defaultExclusiveWeights } from "../lib/exclusive-nft.js";
import type { DraftBundle, DraftData } from "../lib/schemas.js";

export const STEPS = [
	"Details",
	"Prizes",
	"Consolation",
	"Review",
	"Launch",
] as const;

export type WizardState = Readonly<{
	id: string | null;
	cluster: Cluster;
	step: number;
	data: DraftData;
	/** Set once the draft's on-chain identity is pinned. */
	signing: boolean;
	template: string | null;
	boxMint: string | null;
}>;

export type WizardAction =
	| Readonly<{ type: "details"; patch: Partial<DraftData["details"]> }>
	| Readonly<{ type: "cluster"; cluster: Cluster }>
	| Readonly<{ type: "step"; step: number }>
	| Readonly<{ type: "bundles"; bundles: readonly DraftBundle[] }>
	| Readonly<{ type: "consolation"; patch: Partial<DraftData["consolation"]> }>
	| Readonly<{ type: "saved"; id: string }>
	| Readonly<{ type: "signing"; template: string; boxMint: string }>
	| Readonly<{ type: "reset"; state: WizardState }>;

export function emptyDraft(): DraftData {
	return {
		details: {
			name: "",
			symbol: "",
			description: "",
			coverKey: null,
			revealAt: null,
			timeZone: typeof Intl === "undefined"
				? "UTC"
				: Intl.DateTimeFormat().resolvedOptions().timeZone,
		},
		bundles: [],
		consolation: {
			enabled: false,
			count: 0,
			weights: defaultExclusiveWeights(),
		},
	};
}

export function wizardReducer(
	state: WizardState,
	action: WizardAction,
): WizardState {
	switch (action.type) {
		case "details":
			return {
				...state,
				data: {
					...state.data,
					details: { ...state.data.details, ...action.patch },
				},
			};
		case "cluster":
			return state.signing ? state : { ...state, cluster: action.cluster };
		case "step":
			return { ...state, step: action.step };
		case "bundles":
			return {
				...state,
				data: { ...state.data, bundles: [...action.bundles] },
			};
		case "consolation":
			return {
				...state,
				data: {
					...state.data,
					consolation: { ...state.data.consolation, ...action.patch },
				},
			};
		case "saved":
			return { ...state, id: action.id };
		case "signing":
			return {
				...state,
				signing: true,
				template: action.template,
				boxMint: action.boxMint,
			};
		case "reset":
			return action.state;
	}
}

/** A symbol suggestion from the name: "Summer Drop" → "SUMMER". */
export function suggestSymbol(name: string): string {
	const letters = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
	const words = letters.split(/\s+/).filter(Boolean);

	if (words.length === 0) return "";

	const first = words[0] ?? "";

	return (first.length >= 3 ? first : words.join("")).slice(0, 10);
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave. Saves only while the draft is still editable; once it
 * is launching, the chain is the source of truth.
 */
export function useAutosave(
	state: WizardState,
	dispatch: (action: WizardAction) => void,
	enabled: boolean,
): Readonly<{ status: SaveStatus; flush: () => Promise<void> }> {
	const [status, setStatus] = useState<SaveStatus>("idle");
	const first = useRef(true);
	const save = useCallback(async (snapshot: WizardState) => {
		setStatus("saving");

		const response = await fetch("/api/drafts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				...(snapshot.id ? { id: snapshot.id } : {}),
				cluster: snapshot.cluster,
				step: Math.min(snapshot.step, 4),
				data: snapshot.data,
			}),
		});

		if (!response.ok) {
			setStatus("error");
			throw new Error("Your draft could not be saved. Check your connection.");
		}

		const body: unknown = await response.json();
		const id = typeof body === "object" && body !== null
			? Reflect.get(body, "id")
			: null;

		if (typeof id === "string" && id !== snapshot.id) {
			dispatch({ type: "saved", id });
		}

		setStatus("saved");
	}, [dispatch]);

	useEffect(() => {
		if (!enabled || state.signing) return;

		// The loaded draft is already saved; only save after an edit.
		if (first.current) {
			first.current = false;
			return;
		}

		const timer = setTimeout(() => {
			void save(state).catch(() => setStatus("error"));
		}, 700);

		return () => clearTimeout(timer);
	}, [state.data, state.cluster, state.step, enabled, state.signing, save]);

	// Launching must never race the debounce: the server pins the saved draft.
	const flush = useCallback(() => save(state), [save, state]);

	return { status, flush };
}

export function useWizard(initial: WizardState) {
	return useReducer(wizardReducer, initial);
}
