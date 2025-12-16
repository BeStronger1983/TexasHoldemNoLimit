import { Uint32RngBase } from './IRng';

export interface IEntropySource {
	nextUint32(): number;
}

class CryptoEntropySource implements IEntropySource {
	private readonly buffer = new Uint32Array(1);
	private readonly getRandomValues: ((array: Uint32Array) => Uint32Array) | null;

	constructor() {
		const anyCrypto = (globalThis as any).crypto;
		this.getRandomValues = anyCrypto && typeof anyCrypto.getRandomValues === 'function'
			? anyCrypto.getRandomValues.bind(anyCrypto)
			: null;
	}

	nextUint32(): number {
		if (this.getRandomValues) {
			this.getRandomValues(this.buffer);
			return this.buffer[0] >>> 0;
		}
		// Fallback (non-crypto). This is acceptable for non-debug runs, and is still injectable for tests.
		return ((Math.random() * 0x100000000) >>> 0) >>> 0;
	}
}

/**
 * Non-deterministic RNG using Web Crypto when available.
 *
 * Note: For tests/debug, inject a deterministic entropy source.
 */
export class SecureRng extends Uint32RngBase {
	private readonly entropy: IEntropySource;

	constructor(entropySource?: IEntropySource) {
		super();
		this.entropy = entropySource ?? new CryptoEntropySource();
	}

	protected nextUint32(): number {
		return this.entropy.nextUint32() >>> 0;
	}
}
