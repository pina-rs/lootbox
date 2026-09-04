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
function afterHours(hours: number) {
	return localValue(new Date(Date.now() + hours * 3_600_000));
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
	const windowLength = selected
		? Math.max(0, selected.getTime() - Date.now())
		: 0;
	const windowDays = Math.floor(windowLength / 86_400_000);
	const windowHours = Math.floor(windowLength % 86_400_000 / 3_600_000);

	return (
		<div className="unlock-picker">
			<div className="unlock-picker__head">
				<span>
					<CalendarClock size={17} />Reveal schedule
				</span>
				<small>Your timezone · {timezone}</small>
			</div>
			<div className="unlock-picker__fields">
				<label className="field">
					Reveal date<input
						aria-label="Reveal date"
						aria-invalid={Boolean(error)}
						aria-describedby={error ? "error-opensAt" : "unlock-preview"}
						type="date"
						min={localValue(new Date()).slice(0, 10)}
						disabled={disabled}
						value={date}
						onChange={(event) => update(event.target.value, time)}
					/>
				</label>
				<label className="field">
					Time<input
						aria-label="Reveal time"
						aria-invalid={Boolean(error)}
						aria-describedby={error ? "error-opensAt" : "unlock-preview"}
						type="time"
						disabled={disabled}
						value={time}
						onChange={(event) => update(date, event.target.value)}
					/>
				</label>
			</div>
			<div className="unlock-picker__quick" aria-label="Quick reveal dates">
				<button
					type="button"
					disabled={disabled}
					onClick={() => onChange(afterHours(24))}
				>
					24 hours
				</button>
				<button
					type="button"
					disabled={disabled}
					onClick={() => onChange(afterHours(72))}
				>
					3 days
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
						<X size={13} />Clear date
					</button>
				)}
			</div>
			{error
				? <span id="error-opensAt" className="field-error">{error}</span>
				: (
					<p id="unlock-preview" className="unlock-picker__preview">
						<Check size={14} />
						{selected
							? `Reveal ${selected.toLocaleString()} · ${windowDays}d ${windowHours}h pre-reveal trading window`
							: "Choose a future reveal date before funding"}
					</p>
				)}
		</div>
	);
}
