import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';
import { SecureRng } from '../Services/Rng/SecureRng';

const { ccclass } = _decorator;

@ccclass('DebugRngRunner')
export class DebugRngRunner extends Component {
	start(): void {
		console.log(`[TEST] T1.1.DebugRng schemaVersion=${GameConfig.schemaVersion}`);

		// Run SecureRng once (not expected to be reproducible).
		const secure = new SecureRng();
		const secureInts: number[] = [];
		for (let i = 0; i < 20; i++) secureInts.push(secure.nextInt(52));
		const secureFloats: string[] = [];
		for (let i = 0; i < 5; i++) secureFloats.push(secure.nextFloat().toFixed(8));
		console.log('[DebugRngRunner] SecureRng nextInt(52) x20 =', secureInts.join(','));
		console.log('[DebugRngRunner] SecureRng nextFloat() x5 =', secureFloats.join(','));
	}
}
