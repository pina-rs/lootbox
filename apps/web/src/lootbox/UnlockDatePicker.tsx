import { CalendarClock, Check, X } from "lucide-react";

type Props = Readonly<{
	value: string;
	disabled?: boolean;
	error?: string | undefined;
	onChange: (value: string) => void;
}>;

function localValue(date: Date): string {
	const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return shifted.toISOString().slice(0, 16);
}
function atTomorrow(hour: number) {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	date.setHours(hour, 0, 0, 0);
	return localValue(date);
}
function nextFriday() {
	const date = new Date();
	const distance = ((5 - date.getDay() + 7) % 7) || 7;
	date.setDate(date.getDate() + distance);
	date.setHours(12, 0, 0, 0);
	return localValue(date);
}

export function UnlockDatePicker({ value, disabled, error, onChange }: Props) {
	const [date = "", time = ""] = value.split("T");
	const update = (nextDate: string, nextTime: string) =>
		onChange(nextDate ? `${nextDate}T${nextTime || "00:00"}` : "");
	const selected = value && Number.isFinite(Date.parse(value))
		? new Date(value)
		: null;
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	return (
		<div className="unlock-picker">
			<div className="unlock-picker__head">
				<span>
					<CalendarClock size={17} />Opening window
				</span>
				<small>{timezone}</small>
			</div>
			<div className="unlock-picker__fields">
				<label className="field">
					Unlock date<input
						aria-label="Unlock date"
						aria-invalid={Boolean(error)}
						aria-describedby={error ? "error-opensAt" : "unlock-preview"}
						type="date"
						disabled={disabled}
						value={date}
						onChange={(event) => update(event.target.value, time)}
					/>
				</label>
				<label className="field">
					Time<input
						aria-label="Unlock time"
						aria-invalid={Boolean(error)}
						aria-describedby={error ? "error-opensAt" : "unlock-preview"}
						type="time"
						disabled={disabled}
						value={time}
						onChange={(event) => update(date, event.target.value)}
					/>
				</label>
			</div>
			<div className="unlock-picker__quick" aria-label="Quick unlock dates">
				<button
					type="button"
					disabled={disabled}
					onClick={() => onChange(localValue(new Date()))}
				>
					Now
				</button>
				<button
					type="button"
					disabled={disabled}
					onClick={() => onChange(atTomorrow(9))}
				>
					Tomorrow · 09:00
				</button>
				<button
					type="button"
					disabled={disabled}
					onClick={() => onChange(nextFriday())}
				>
					Next Friday · noon
				</button>
				{value && (
					<button
						type="button"
						disabled={disabled}
						onClick={() => onChange("")}
					>
						<X size={13} />Clear
					</button>
				)}
			</div>
			{error
				? <span id="error-opensAt" className="field-error">{error}</span>
				: (
					<p id="unlock-preview" className="unlock-picker__preview">
						<Check size={14} />
						{selected
							? `Boxes unlock ${selected.toLocaleString()}`
							: "Boxes can open immediately after minting"}
					</p>
				)}
		</div>
	);
}
