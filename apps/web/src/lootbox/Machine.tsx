import { LockKeyhole, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";

export type MachinePhase =
	| "received"
	| "idle"
	| "commit"
	| "burn"
	| "reveal"
	| "revealed"
	| "redeemed";
const particles = Array.from({ length: 18 }, (_, index) =>
	({
		"--particle-angle": `${index * 20}deg`,
		"--particle-distance": `${105 + (index % 4) * 18}px`,
		"--particle-delay": `${(index % 5) * 35}ms`,
	}) as CSSProperties);

export function LootboxMachine({ phase }: { phase: MachinePhase }) {
	return (
		<div
			className={`machine machine--${phase}`}
			data-phase={phase}
			data-testid="lootbox-machine"
			aria-hidden="true"
		>
			<div className="machine__orbit">
				<span>SEALED</span>
				<span>UNKNOWN</span>
				<span>YOURS</span>
			</div>
			<div className="machine__shadow" />
			<div className="crate">
				<div className="crate__light" />
				<div className="crate__lid">
					<div className="crate__lid-panel">
						<LockKeyhole size={28} strokeWidth={2.5} />
						<span>LOOT / PINA</span>
					</div>
				</div>
				<div className="crate__body">
					<div className="crate__hazard" />
					<div className="crate__mark">
						<span>HANDLE WITH CURIOSITY</span>
						<strong>UNKNOWN</strong>
					</div>
					{["a", "b", "c", "d"].map((name) => (
						<div key={name} className={`crate__rivet crate__rivet--${name}`} />
					))}
				</div>
			</div>
			<div className="machine__core">
				<Sparkles size={56} strokeWidth={1.5} />
			</div>
			<div className="particles">
				{particles.map((style, index) => <i key={index} style={style} />)}
			</div>
		</div>
	);
}
