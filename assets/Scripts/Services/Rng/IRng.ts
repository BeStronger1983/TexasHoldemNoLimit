export interface IRng {
	/**
	 * Returns an integer in [0, maxExclusive).
	 */
	nextInt(maxExclusive: number): number;

	/**
	 * Returns a float in [0, 1).
	 */
	nextFloat(): number;
}

function toPositiveSafeInt(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.trunc(value));
}

/**
 * Base RNG that is driven by a 32-bit unsigned integer generator.
 *
 * All implementations that share this base will have consistent `nextInt/nextFloat` behavior.
 */
export abstract class Uint32RngBase implements IRng {
	protected abstract nextUint32(): number;

	nextFloat(): number {
		// Divide by 2^32 to get [0,1).
		return (this.nextUint32() >>> 0) / 0x100000000;
	}

	nextInt(maxExclusive: number): number {
		const max = toPositiveSafeInt(maxExclusive);
		if (max <= 0) return 0;
		if (max === 1) return 0;

		// Rejection sampling to avoid modulo bias.
		const range = 0x100000000;
		const limit = range - (range % max);
		while (true) {
			const x = this.nextUint32() >>> 0;
			if (x < limit) return x % max;
		}
	}
}
