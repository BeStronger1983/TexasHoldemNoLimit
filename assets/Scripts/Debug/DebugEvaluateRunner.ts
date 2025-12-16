import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';

const { ccclass } = _decorator;

@ccclass('DebugEvaluateRunner')
export class DebugEvaluateRunner extends Component {
	start(): void {
		console.log(`[TEST] T2.0.DebugEvaluate schemaVersion=${GameConfig.schemaVersion}`);

		// T2.0 only: ensure the Scene prints clear phase markers.
		// The real evaluate7 + fixed test cases will be implemented in T2.6.
		console.log('[DebugEvaluateRunner] Note: this is a placeholder for T2.0 (log-only).');
		console.log('[DebugEvaluateRunner] state=Evaluate7');
		console.log('[DebugEvaluateRunner] sampleInput=As Ks Qs Js Ts 2d 3c');
	}
}
