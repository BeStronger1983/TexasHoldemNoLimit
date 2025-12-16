import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';
import { Session } from '../Model/Session';
import { GameStateMachine } from '../Model/StateMachine/GameStateMachine';
import { SecureRng } from '../Services/Rng/SecureRng';
import { settingsService } from '../Services/SettingsService';

const { ccclass } = _decorator;

@ccclass('DebugHandFlowRunner')
export class DebugHandFlowRunner extends Component {
	start(): void {
		console.log(`[TEST] T2.1.DebugHandFlow schemaVersion=${GameConfig.schemaVersion}`);

		const settings = settingsService.load();
		const rng = new SecureRng();
		const session = Session.createRandom(rng, { maxSeats: 9, gameplay: settings.gameplay });

		const sm = new GameStateMachine({ session, stopAfterOneHand: true });
		console.log(`[DebugHandFlowRunner] state=${sm.state}`);

		const tickOnce = (): boolean => {
			const result = sm.step();
			for (const ev of result.events) {
				// Keep logs human-readable for validation.
				console.log(`[DebugHandFlowRunner] event type=${ev.type} msg=${ev.message}`, ev.payload ?? '');
			}
			switch (result.type) {
				case 'Transition':
					console.log(`[DebugHandFlowRunner] state=${result.to}`);
					return true;
				case 'Finished':
					console.log(`[DebugHandFlowRunner] done finalState=${result.finalState}`);
					return false;
				case 'Aborted':
					console.log(`[DebugHandFlowRunner] aborted reason=${result.reason} finalState=${result.finalState}`);
					return false;
			}
		};

		if (GameConfig.skipAnimations) {
			// Run to completion synchronously.
			while (tickOnce()) {
				// loop
			}
			return;
		}

		const stepDelaySec = 0.15 / Math.max(0.0001, GameConfig.animationSpeed);
		const maxTicks = 200;
		let tickCount = 0;

		const scheduleTick = (): void => {
			this.scheduleOnce(() => {
				tickCount++;
				const shouldContinue = tickOnce();
				if (!shouldContinue) return;
				if (tickCount >= maxTicks) {
					console.log('[DebugHandFlowRunner] aborted reason=Exceeded maxTicks (safety)');
					return;
				}
				scheduleTick();
			}, stepDelaySec);
		};

		scheduleTick();
	}
}
