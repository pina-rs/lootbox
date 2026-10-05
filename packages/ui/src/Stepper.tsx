/**
 * A whole-number field with chunky − and + buttons: quicker than typing for
 * copy counts and box counts, and it reads well on camera.
 */
import { useEffect, useId, useState } from "react";

export type StepperProps = Readonly<{
	label: string;
	value: number;
	min?: number;
	max?: number;
	step?: number;
	/** Omit for a read-only display, e.g. in a video frame. */
	onChange?: (value: number) => void;
	disabled?: boolean;
	/** Visible label; otherwise `label` is only announced. */
	showLabel?: boolean;
	describedBy?: string;
}>;

export function Stepper(
	{
		label,
		value,
		min = 0,
		max = Number.MAX_SAFE_INTEGER,
		step = 1,
		onChange,
		disabled,
		showLabel = false,
		describedBy,
	}: StepperProps,
) {
	const id = useId();
	const [draft, setDraft] = useState(String(value));
	const clamp = (next: number) =>
		Math.min(max, Math.max(min, Math.floor(next)));
	const readOnly = !onChange;

	// Typing passes through out-of-range text ("1" on the way to "15"); only
	// valid whole numbers reach the owner, and blur snaps back to the value.
	useEffect(() => setDraft(String(value)), [value]);

	return (
		<div className="stepper" data-disabled={disabled || undefined}>
			<label
				htmlFor={id}
				className={showLabel ? "stepper-label" : "visually-hidden"}
			>
				{label}
			</label>
			<div className="stepper-control">
				<button
					type="button"
					aria-label="Decrease"
					aria-controls={id}
					disabled={disabled || readOnly || value <= min}
					onClick={() => onChange?.(clamp(value - step))}
				>
					−
				</button>
				<input
					id={id}
					type="number"
					inputMode="numeric"
					min={min}
					max={max}
					step={step}
					value={draft}
					readOnly={readOnly}
					disabled={disabled}
					aria-describedby={describedBy}
					onChange={(event) => {
						const text = event.currentTarget.value;
						const next = Number(text);

						setDraft(text);
						if (
							text !== "" && Number.isInteger(next) && next >= min &&
							next <= max
						) {
							onChange?.(next);
						}
					}}
					onBlur={() => setDraft(String(value))}
				/>
				<button
					type="button"
					aria-label="Increase"
					aria-controls={id}
					disabled={disabled || readOnly || value >= max}
					onClick={() => onChange?.(clamp(value + step))}
				>
					+
				</button>
			</div>
		</div>
	);
}
