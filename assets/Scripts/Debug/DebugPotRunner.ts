import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';

const { ccclass } = _decorator;

type DebugContribution = {
	seatIndex: number;
	contributionThisHand: number;
	isFolded: boolean;
};

@ccclass('DebugPotRunner')
export class DebugPotRunner extends Component {
	start(): void {
		console.log(`[TEST] T2.0.DebugPot schemaVersion=${GameConfig.schemaVersion}`);

		// T2.0 only: ensure the Scene prints clear phase markers.
		// Real side-pot build + eligible logic will be implemented in T2.5.
		console.log('[DebugPotRunner] Note: this is a placeholder for T2.0 (log-only).');
		console.log('[DebugPotRunner] state=BuildSidePots');

		const sample: DebugContribution[] = [
			{ seatIndex: 1, contributionThisHand: 30, isFolded: false },
			{ seatIndex: 4, contributionThisHand: 70, isFolded: false },
			{ seatIndex: 7, contributionThisHand: 120, isFolded: false },
			{ seatIndex: 8, contributionThisHand: 120, isFolded: true },
		];

		console.log('[DebugPotRunner] sampleContributions=', JSON.stringify(sample));
		console.log(
			'[DebugPotRunner] expectedExample (for humans): tiers like 30/70/120 should create multiple pots; eligible excludes folded players.',
		);
	}
}
