import {
	Box,
	Check,
	ChevronRight,
	Coins,
	Flame,
	LockKeyhole,
	PackageOpen,
	Radio,
	ShieldCheck,
	Sparkles,
	Zap,
} from "lucide-react";
import {
	type CSSProperties,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	createDemoGateway,
	formatSol,
	type LootboxGateway,
	type OpeningReceipt,
	type OpeningStage,
} from "./lootbox/gateway.js";

type MachinePhase =
	| "received"
	| "idle"
	| OpeningStage
	| "revealed"
	| "redeemed";

type ParticleProperties = CSSProperties & {
	"--particle-angle": string;
	"--particle-distance": string;
	"--particle-delay": string;
};

const particleStyles: readonly ParticleProperties[] = Array.from(
	{ length: 18 },
	(_, index) => ({
		"--particle-angle": `${index * 20}deg`,
		"--particle-distance": `${105 + (index % 4) * 18}px`,
		"--particle-delay": `${(index % 5) * 35}ms`,
	}),
);

const phaseCopy: Record<
	MachinePhase,
	{ eyebrow: string; title: string; detail: string }
> = {
	received: {
		eyebrow: "INCOMING DROP",
		title: "A sealed relic found you.",
		detail: "Its reward does not exist yet. Your reveal creates the moment.",
	},
	idle: {
		eyebrow: "READY TO CRACK",
		title: "Unknown cargo. Known odds.",
		detail:
			"Opening burns one box, then binds the payout to oracle randomness.",
	},
	commit: {
		eyebrow: "01 / COMMIT",
		title: "Locking the future…",
		detail: "Your wallet owns a fresh, unrevealed randomness commitment.",
	},
	burn: {
		eyebrow: "02 / BURN",
		title: "Seal consumed.",
		detail: "The box token is gone. Neither side can walk back the draw.",
	},
	reveal: {
		eyebrow: "03 / REVEAL",
		title: "The vault is answering…",
		detail: "Switchboard entropy is being mixed into this opening.",
	},
	revealed: {
		eyebrow: "DROP IDENTIFIED",
		title: "The relic chose you.",
		detail: "Your reward is settled and ready to redeem.",
	},
	redeemed: {
		eyebrow: "REDEMPTION COMPLETE",
		title: "Reward secured.",
		detail: "The terminal receipt can now close and return its rent.",
	},
};

function phaseIndex(phase: MachinePhase): number {
	if (phase === "commit") return 1;
	if (phase === "burn") return 2;
	if (["reveal", "revealed", "redeemed"].includes(phase)) return 3;
	return 0;
}

function LootboxMachine({ phase }: { phase: MachinePhase }) {
	const active = ["commit", "burn", "reveal"].includes(phase);
	const open = phase === "revealed" || phase === "redeemed";

	return (
		<div
			className={`machine machine--${phase}`}
			data-phase={phase}
			data-testid="lootbox-machine"
			aria-label={active
				? "Lootbox opening in progress"
				: open
				? "Lootbox opened"
				: "Sealed lootbox"}
		>
			<div className="machine__orbit" aria-hidden="true">
				<span>COMMIT</span>
				<span>BURN</span>
				<span>REVEAL</span>
			</div>
			<div className="machine__shadow" />
			<div className="crate">
				<div className="crate__light" />
				<div className="crate__lid">
					<div className="crate__lid-panel">
						<LockKeyhole size={28} strokeWidth={2.5} />
						<span>LBX–07</span>
					</div>
				</div>
				<div className="crate__body">
					<div className="crate__hazard" />
					<div className="crate__mark">
						<span>PINA</span>
						<strong>UNKNOWN</strong>
					</div>
					<div className="crate__rivet crate__rivet--a" />
					<div className="crate__rivet crate__rivet--b" />
					<div className="crate__rivet crate__rivet--c" />
					<div className="crate__rivet crate__rivet--d" />
				</div>
			</div>
			<div className="machine__core" aria-hidden="true">
				<Sparkles size={56} strokeWidth={1.5} />
			</div>
			<div className="particles" aria-hidden="true">
				{particleStyles.map((style, index) => <i key={index} style={style} />)}
			</div>
		</div>
	);
}

function ProtocolRail({ phase }: { phase: MachinePhase }) {
	const current = phaseIndex(phase);
	const steps = [
		{ label: "Commit", icon: Radio },
		{ label: "Burn", icon: Flame },
		{ label: "Reveal", icon: Zap },
	] as const;

	return (
		<ol className="protocol-rail" aria-label="Opening protocol">
			{steps.map(({ label, icon: Icon }, index) => {
				const step = index + 1;
				const complete = current > step || phase === "revealed" ||
					phase === "redeemed";
				const active = current === step &&
					!["revealed", "redeemed"].includes(phase);

				return (
					<li
						className={active ? "is-active" : complete ? "is-complete" : ""}
						key={label}
					>
						<span className="protocol-rail__icon">
							{complete ? <Check size={15} /> : <Icon size={15} />}
						</span>
						<span>{label}</span>
					</li>
				);
			})}
		</ol>
	);
}

function App() {
	const gateway = useRef<LootboxGateway>(createDemoGateway());
	const [phase, setPhase] = useState<MachinePhase>("received");
	const [inventory, setInventory] = useState(3);
	const [balance, setBalance] = useState(0n);
	const [receipt, setReceipt] = useState<OpeningReceipt | null>(null);
	const copy = phaseCopy[phase];
	const isBusy = ["commit", "burn", "reveal"].includes(phase);
	const odds = gateway.current.plan.outcomes;
	const funded = useMemo(
		() => formatSol(gateway.current.plan.requiredCollateralLamports),
		[],
	);

	useEffect(() => {
		const timeout = globalThis.setTimeout(() => setPhase("idle"), 900);
		return () => globalThis.clearTimeout(timeout);
	}, []);

	async function openBox() {
		if (isBusy || inventory === 0) return;

		setReceipt(null);
		let burned = false;
		const nextReceipt = await gateway.current.open((stage) => {
			setPhase(stage);

			if (stage === "burn" && !burned) {
				burned = true;
				setInventory((count) => Math.max(0, count - 1));
			}
		});
		setReceipt(nextReceipt);
		setPhase("revealed");
	}

	function redeem() {
		if (!receipt || phase !== "revealed") return;
		setBalance((value) => value + receipt.reward.rewardLamports);
		setPhase("redeemed");
	}

	function prepareNext() {
		setReceipt(null);
		setPhase("idle");
	}

	return (
		<div className="app-shell">
			<header className="topbar">
				<a className="brand" href="#top" aria-label="Lootbox home">
					<span className="brand__glyph">
						<PackageOpen size={22} />
					</span>
					<span>LOOTBOX</span>
					<small>by Pina</small>
				</a>
				<div className="network-pill">
					<i /> SURFPOOL SANDBOX
				</div>
				<div
					className="wallet-chip"
					aria-label={`Sandbox balance ${formatSol(balance)}`}
				>
					<Coins size={16} />
					<span data-testid="wallet-balance">{formatSol(balance)}</span>
				</div>
			</header>

			<main id="top">
				<section className="hero-copy">
					<div className="hero-copy__index">DROP / 007</div>
					<p className="eyebrow">{copy.eyebrow}</p>
					<h1>{copy.title}</h1>
					<p className="hero-copy__detail" aria-live="polite">{copy.detail}</p>
				</section>

				<section className="play-grid">
					<aside className="drop-panel panel">
						<div className="panel__label">YOUR DROP</div>
						<div className="drop-count">
							<Box size={24} />
							<strong data-testid="inventory-count">{inventory}</strong>
							<span>sealed</span>
						</div>
						<div className="serial-block">
							<span>EDITION</span>
							<strong>GENESIS / 250</strong>
							<span>MINT</span>
							<strong>9vKp…mN2x</strong>
						</div>
						<ProtocolRail phase={phase} />
					</aside>

					<div className="stage">
						<LootboxMachine phase={phase} />
						{receipt && ["revealed", "redeemed"].includes(phase)
							? (
								<div
									className={`reward-card reward-card--${receipt.reward.accent}`}
									data-testid="reward-card"
								>
									<p>{receipt.reward.tier} DROP</p>
									<h2>{receipt.reward.name}</h2>
									<strong>{formatSol(receipt.reward.rewardLamports)}</strong>
									<small>{receipt.signature}</small>
								</div>
							)
							: null}

						<div className="action-zone">
							{phase === "revealed"
								? (
									<button
										className="primary-action primary-action--redeem"
										onClick={redeem}
										type="button"
									>
										Redeem reward <ChevronRight size={20} />
									</button>
								)
								: phase === "redeemed" && inventory > 0
								? (
									<button
										className="primary-action"
										onClick={prepareNext}
										type="button"
									>
										Load next box <ChevronRight size={20} />
									</button>
								)
								: (
									<button
										className="primary-action"
										disabled={isBusy || inventory === 0 || phase === "received"}
										onClick={() => void openBox()}
										type="button"
									>
										{isBusy
											? "Opening protocol active"
											: inventory === 0
											? "No boxes remain"
											: "Crack the seal"}
										{isBusy
											? <Radio className="spin-icon" size={20} />
											: <Zap size={20} />}
									</button>
								)}
							<p>One click · three irreversible steps</p>
						</div>
					</div>

					<aside className="odds-panel panel">
						<div className="panel__label">REWARD SPECTRUM</div>
						<ul className="odds-list">
							{odds.map((outcome, index) => (
								<li key={outcome.label}>
									<div>
										<span>0{index + 1}</span>
										<strong>{outcome.label}</strong>
									</div>
									<b>{outcome.probability}%</b>
									<i style={{ width: `${outcome.probability}%` }} />
								</li>
							))}
						</ul>
						<div className="funding-stamp">
							<ShieldCheck size={21} />
							<div>
								<span>WORST-CASE FUNDED</span>
								<strong>{funded}</strong>
							</div>
						</div>
					</aside>
				</section>

				<section className="trust-strip" aria-label="Protocol guarantees">
					<div>
						<Radio />
						<span>ORACLE</span>
						<strong>Switchboard ABI</strong>
					</div>
					<div>
						<Flame />
						<span>OPEN</span>
						<strong>Burn before reveal</strong>
					</div>
					<div>
						<ShieldCheck />
						<span>VAULT</span>
						<strong>Fully collateralized</strong>
					</div>
					<div>
						<Sparkles />
						<span>DRAW</span>
						<strong>Bias-free selection</strong>
					</div>
				</section>
			</main>

			<footer>
				<span>PROGRAM</span>
				<code>Bp6AJD…xzg4op</code>
				<span className="footer__push">PINA / NO_STD / SOLANA</span>
			</footer>
		</div>
	);
}

export default App;
