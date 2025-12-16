import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';

const { ccclass } = _decorator;

type HandFlowDebugState =
	| 'Boot'
	| 'MainMenu'
	| 'TableSetup'
	| 'PostingBlinds'
	| 'DealHoleCards'
	| 'BettingPreflop'
	| 'DealFlop'
	| 'BettingFlop'
	| 'DealTurn'
	| 'BettingTurn'
	| 'DealRiver'
	| 'BettingRiver'
	| 'Showdown'
	| 'Payout'
	| 'HandSummary'
	| 'NextHandOrExit';

@ccclass('DebugHandFlowRunner')
export class DebugHandFlowRunner extends Component {
	start(): void {
		console.log(`[TEST] T2.0.DebugHandFlow schemaVersion=${GameConfig.schemaVersion}`);

		// T2.0 only: ensure the Scene prints clear phase markers.
		// The real hand-flow state machine will be implemented in T2.1+.
		const states: HandFlowDebugState[] = [
			'Boot',
			'MainMenu',
			'TableSetup',
			'PostingBlinds',
			'DealHoleCards',
			'BettingPreflop',
			'DealFlop',
			'BettingFlop',
			'DealTurn',
			'BettingTurn',
			'DealRiver',
			'BettingRiver',
			'Showdown',
			'Payout',
			'HandSummary',
			'NextHandOrExit',
		];

		console.log('[DebugHandFlowRunner] Note: this is a placeholder flow for T2.0 (log-only).');

		if (GameConfig.skipAnimations) {
			for (const s of states) {
				console.log(`[DebugHandFlowRunner] state=${s}`);
			}
			console.log('[DebugHandFlowRunner] done');
			return;
		}

		const stepDelaySec = 0.15 / Math.max(0.0001, GameConfig.animationSpeed);
		states.forEach((s, i) => {
			this.scheduleOnce(() => {
				console.log(`[DebugHandFlowRunner] state=${s}`);
				if (i === states.length - 1) console.log('[DebugHandFlowRunner] done');
			}, stepDelaySec * i);
		});
	}
}
