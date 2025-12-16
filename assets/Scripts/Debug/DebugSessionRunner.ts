import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';
import { Session } from '../Model/Session';
import { settingsService } from '../Services/SettingsService';
import { SecureRng } from '../Services/Rng/SecureRng';

const { ccclass } = _decorator;

@ccclass('DebugSessionRunner')
export class DebugSessionRunner extends Component {
	start(): void {
		console.log(`[TEST] T1.3.DebugSession schemaVersion=${GameConfig.schemaVersion}`);

		const settings = settingsService.load();
		const gameplay = settings.gameplay;

		const logSessionSnapshot = (label: string, session: Session): void => {
			console.log(
				`[DebugSessionRunner] ${label} N=${session.players.length} humanSeat=${session.humanSeatIndex} result=${session.result}`,
			);
			for (let i = 0; i < session.table.maxSeats; i++) {
				const p = session.table.getSeat(i);
				if (!p) {
					console.log(`[DebugSessionRunner] ${label} Seat ${i}: <empty>`);
					continue;
				}
				console.log(
					`[DebugSessionRunner] ${label} Seat ${i}: name=${p.name} isHuman=${p.isHuman} status=${p.status} stack=${p.stack} contrib=${p.contributionThisHand}`,
				);
			}
		};

		// Case A: Normal start + 2 consecutive hands to verify button moves clockwise.
		{
			const rng = new SecureRng();
			const session = Session.createRandom(rng, { maxSeats: 9, gameplay });
			const hand1 = session.startHand();
			logSessionSnapshot('[CaseA.Hand1]', session);
			console.log(
				`[DebugSessionRunner] [CaseA.Hand1] hand#${hand1.handNumber} button=${hand1.buttonSeatIndex} sb=${hand1.smallBlindSeatIndex} bb=${hand1.bigBlindSeatIndex}`,
			);
			console.log('[DebugSessionRunner] [CaseA.Hand1] postedAntes=', hand1.postedAntes);
			console.log('[DebugSessionRunner] [CaseA.Hand1] postedBlinds=', hand1.postedBlinds);

			const hand2 = session.startHand();
			logSessionSnapshot('[CaseA.Hand2]', session);
			console.log(
				`[DebugSessionRunner] [CaseA.Hand2] hand#${hand2.handNumber} button=${hand2.buttonSeatIndex} sb=${hand2.smallBlindSeatIndex} bb=${hand2.bigBlindSeatIndex}`,
			);
			console.log('[DebugSessionRunner] [CaseA.Hand2] postedAntes=', hand2.postedAntes);
			console.log('[DebugSessionRunner] [CaseA.Hand2] postedBlinds=', hand2.postedBlinds);
		}

		// Case B: Force a bot to bust and leave the table.
		{
			const rng = new SecureRng();
			const session = Session.createRandom(rng, { maxSeats: 9, gameplay });
			session.startHand();
			const bot = session.players.find((p) => !p.isHuman);
			if (!bot) throw new Error('CaseB: expected a bot');
			bot.stack = 0;
			session.applyBrokeRules();
			logSessionSnapshot('[CaseB.AfterBotBust]', session);
			console.log(`[DebugSessionRunner] [CaseB.AfterBotBust] bustedBot=${bot.name} seat=${bot.seatIndex} result=${session.result}`);
		}

		// Case C: Force human bust => session failed.
		{
			const rng = new SecureRng();
			const session = Session.createRandom(rng, { maxSeats: 9, gameplay });
			session.startHand();
			const human = session.players.find((p) => p.isHuman);
			if (!human) throw new Error('CaseC: missing human');
			human.stack = 0;
			session.applyBrokeRules();
			logSessionSnapshot('[CaseC.AfterHumanBust]', session);
			console.log(`[DebugSessionRunner] [CaseC.AfterHumanBust] result=${session.result}`);
		}

		// Case D: Force all bots bust => human wins.
		{
			const rng = new SecureRng();
			const session = Session.createRandom(rng, { maxSeats: 9, gameplay });
			session.startHand();
			for (const p of session.players) {
				if (p.isHuman) continue;
				p.stack = 0;
			}
			session.applyBrokeRules();
			logSessionSnapshot('[CaseD.AfterBotsBusted]', session);
			console.log(`[DebugSessionRunner] [CaseD.AfterBotsBusted] result=${session.result}`);
		}
	}
}
