/**
 * Deterministic randomness. Every stochastic choice in the project (noise,
 * humanisation, crackle, coin scatter) draws from a `Random` seeded from a
 * string label, so `node render.ts` produces byte-identical audio every run.
 */
/** FNV-1a 32-bit hash, used to turn readable labels into seeds. */
export function hashLabel(label: string): number {
	let hash = 0x811c9dc5;

	for (let index = 0; index < label.length; index += 1) {
		hash ^= label.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return hash >>> 0;
}

/** Mulberry32: a small, fast, well-distributed 32-bit generator. */
export class Random {
	#state: number;

	constructor(seed: number) {
		this.#state = seed >>> 0;
	}

	static from(label: string): Random {
		return new Random(hashLabel(label));
	}

	/** Uniform in [0, 1). */
	next(): number {
		this.#state = (this.#state + 0x6d2b79f5) >>> 0;
		let t = this.#state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/** Uniform in [min, max). */
	range(min: number, max: number): number {
		return min + (max - min) * this.next();
	}

	/** Uniform in [-1, 1). */
	bipolar(): number {
		return this.next() * 2 - 1;
	}

	/** Integer in [min, max] inclusive. */
	integer(min: number, max: number): number {
		return min + Math.floor(this.next() * (max - min + 1));
	}

	chance(probability: number): boolean {
		return this.next() < probability;
	}

	/** Standard normal sample (Box–Muller). */
	gaussian(): number {
		const u = Math.max(this.next(), 1e-12);
		const v = this.next();

		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	}

	/** An independent stream whose seed depends on this stream and a label. */
	fork(label: string): Random {
		return new Random(hashLabel(label) ^ Math.floor(this.next() * 4294967296));
	}
}
