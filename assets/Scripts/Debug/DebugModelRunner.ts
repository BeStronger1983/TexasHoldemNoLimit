import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';

const { ccclass } = _decorator;

@ccclass('DebugModelRunner')
export class DebugModelRunner extends Component {
	start(): void {
		const seedLabel = GameConfig.debugSeedEnabled ? String(GameConfig.debugSeed) : 'disabled';
		console.log(`[TEST] T1.0.DebugModel seed=${seedLabel} schemaVersion=${GameConfig.schemaVersion}`);
		console.log('[DebugModelRunner] Ready. Implement T1.2 (Card/Deck/Player/Table/GameEvent) next to print model state.');
	}
}
