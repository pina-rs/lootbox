import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Chest, type ChestProps } from "./Chest.js";
import { initialOpening, type OpeningState } from "./openingMachine.js";

function props(overrides: Partial<ChestProps> = {}): ChestProps {
	return {
		state: initialOpening,
		armed: true,
		reducedMotion: false,
		onHold: vi.fn(),
		onRelease: vi.fn(),
		onCharged: vi.fn(),
		onBlocked: vi.fn(),
		onRevealFinished: vi.fn(),
		...overrides,
	};
}

const revealing: OpeningState = {
	phase: "revealing",
	result: { opening: "o", bundleIndex: 0, tier: "headline", signature: null },
};

describe("chest", () => {
	it("starts a hold on Space and ignores auto-repeat", () => {
		const handlers = props();

		render(<Chest {...handlers} />);

		const chest = screen.getByRole("button", {
			name: "Press and hold to open a box",
		});

		fireEvent.keyDown(chest, { key: " " });
		fireEvent.keyDown(chest, { key: " ", repeat: true });
		expect(handlers.onHold).toHaveBeenCalledOnce();
	});

	it("releases a charging hold on key up", () => {
		const handlers = props({ state: { phase: "charging", startedAt: 0 } });

		render(<Chest {...handlers} />);
		fireEvent.keyUp(screen.getByRole("button", { name: /hold to open/ }), {
			key: "Enter",
		});
		expect(handlers.onRelease).toHaveBeenCalledOnce();
	});

	it("rattles instead of charging when the chest is locked", () => {
		const handlers = props({ armed: false });

		render(<Chest {...handlers} />);
		fireEvent.pointerDown(
			screen.getByRole("button", { name: /Press to see why it is locked/ }),
		);
		expect(handlers.onBlocked).toHaveBeenCalledOnce();
		expect(handlers.onHold).not.toHaveBeenCalled();
	});

	it("finishes the reveal at once under reduced motion", () => {
		const reduced = props({ state: revealing, reducedMotion: true });

		render(<Chest {...reduced} />);
		expect(reduced.onRevealFinished).toHaveBeenCalledOnce();
		expect(screen.getByTestId("chest")).toHaveAttribute(
			"data-reaction",
			"big-prize",
		);
	});
});
