import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';

const { ccclass } = _decorator;

@ccclass('DebugBettingRunner')
export class DebugBettingRunner extends Component {
	start(): void {
		console.log(`[TEST] T2.0.DebugBetting schemaVersion=${GameConfig.schemaVersion}`);

		// T2.0 only: ensure the Scene prints clear phase markers.
		// Detailed betting rules + legal actions will be implemented in T2.4.
		console.log('[DebugBettingRunner] Note: this is a placeholder for T2.0 (log-only).');

		console.log('[DebugBettingRunner] state=BettingPreflop');
		console.log('[DebugBettingRunner] state=ComputeLegalActions');
		console.log('[DebugBettingRunner] state=ApplyActionSequence');
		console.log('[DebugBettingRunner] state=EndBettingRound');
	}
}
