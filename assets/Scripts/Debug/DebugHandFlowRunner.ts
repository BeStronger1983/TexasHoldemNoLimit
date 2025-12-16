import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';
import { Session } from '../Model/Session';
import { GameStateMachine } from '../Model/StateMachine/GameStateMachine';
import { SecureRng, type IEntropySource } from '../Services/Rng/SecureRng';
import { settingsService } from '../Services/SettingsService';

const { ccclass } = _decorator;

@ccclass('DebugHandFlowRunner')
export class DebugHandFlowRunner extends Component {
	start(): void {
		console.log(`[TEST] T2.2.DebugHandFlow schemaVersion=${GameConfig.schemaVersion}`);

		const settings = settingsService.load();
		const seed = 0xC0C0_5EED; // fixed for reproducible burn-on/off comparison

		const runOne = (label: string, burnCardEnabled: boolean, onDone?: () => void): void => {
			console.log(`\n[DebugHandFlowRunner] ===== ${label} burnCardEnabled=${burnCardEnabled} =====`);
			const rng = new SecureRng(new XorShift32Entropy(seed));
			const session = Session.createRandom(rng, { maxSeats: 9, gameplay: settings.gameplay, burnCardEnabled });
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
						onDone?.();
						return false;
					case 'Aborted':
						console.log(`[DebugHandFlowRunner] aborted reason=${result.reason} finalState=${result.finalState}`);
						onDone?.();
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
						onDone?.();
						return;
					}
					scheduleTick();
				}, stepDelaySec);
			};

			scheduleTick();
		};

		// Run twice to validate burn toggle affects draw sequence.
		runOne('RUN#1', true, () => {
			runOne('RUN#2', false);
		});
	}
}

class XorShift32Entropy implements IEntropySource {
	private state: number;

	constructor(seed: number) {
		// Xorshift32 doesn't like 0 state.
		const s = (seed >>> 0) || 0x1;
		this.state = s;
	}

	nextUint32(): number {
		let x = this.state >>> 0;
		x ^= (x << 13) >>> 0;
		x ^= x >>> 17;
		x ^= (x << 5) >>> 0;
		this.state = x >>> 0;
		return this.state;
	}
}
