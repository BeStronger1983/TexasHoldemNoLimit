import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';

const { ccclass } = _decorator;

@ccclass('DebugRngRunner')
export class DebugRngRunner extends Component {
	start(): void {
		const seedLabel = GameConfig.debugSeedEnabled ? String(GameConfig.debugSeed) : 'disabled';
		console.log(`[TEST] T1.0.DebugRng seed=${seedLabel} schemaVersion=${GameConfig.schemaVersion}`);
		console.log('[DebugRngRunner] Ready. Implement T1.1 (IRng/SeededRng/SecureRng) next to print sequences.');
	}
}
