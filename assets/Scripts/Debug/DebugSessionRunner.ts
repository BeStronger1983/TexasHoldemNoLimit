import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';

const { ccclass } = _decorator;

@ccclass('DebugSessionRunner')
export class DebugSessionRunner extends Component {
	start(): void {
		const seedLabel = GameConfig.debugSeedEnabled ? String(GameConfig.debugSeed) : 'disabled';
		console.log(`[TEST] T1.0.DebugSession seed=${seedLabel} schemaVersion=${GameConfig.schemaVersion}`);
		console.log('[DebugSessionRunner] Ready. Implement T1.3 (Session/Hand init) next to print seats/button/blinds.');
	}
}
