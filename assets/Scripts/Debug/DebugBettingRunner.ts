import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';
import { getFirstToActSeatIndex } from '../Model/ActionOrder';
import { Player, PlayerStatus } from '../Model/Player';
import { Session } from '../Model/Session';
import { Street } from '../Model/Table';
import { settingsService } from '../Services/SettingsService';
import { SecureRng } from '../Services/Rng/SecureRng';

const { ccclass } = _decorator;

@ccclass('DebugBettingRunner')
export class DebugBettingRunner extends Component {
	start(): void {
		console.log(`[TEST] T2.3.DebugBetting schemaVersion=${GameConfig.schemaVersion}`);

		const gameplay = settingsService.load().gameplay;
		const rng = new SecureRng();

		const logFirstActors = (label: string, session: Session): void => {
			const t = session.table;
			console.log(
				`[DebugBettingRunner] ${label} button=${t.buttonSeatIndex} sb=${t.smallBlindSeatIndex} bb=${t.bigBlindSeatIndex}`,
			);
			console.log(
				`[DebugBettingRunner] ${label} firstToAct preflop=${getFirstToActSeatIndex(t, Street.Preflop)} flop=${getFirstToActSeatIndex(
					t,
					Street.Flop,
				)} turn=${getFirstToActSeatIndex(t, Street.Turn)} river=${getFirstToActSeatIndex(t, Street.River)}`,
			);
		};

		const buildFixedSession = (maxSeats: number, occupiedSeats: number[], buttonSeatIndex: number): Session => {
			const session = new Session(rng, { maxSeats, gameplay });
			const pickNextSeatedAfter = (fromSeatIndex: number): number => {
				for (let step = 0; step < session.table.maxSeats; step++) {
					const i = (fromSeatIndex + 1 + step) % session.table.maxSeats;
					const p = session.table.getSeat(i);
					if (!p) continue;
					return i;
				}
				throw new Error('No next seated player found');
			};

			// Clear any table state and re-seat players deterministically.
			for (let i = 0; i < session.table.maxSeats; i++) session.table.setSeat(i, null);
			session.players = [];
			session.handNumber = 1;

			for (const seatIndex of occupiedSeats) {
				const isHuman = seatIndex === occupiedSeats[0];
				const name = isHuman ? 'You' : `Bot@${seatIndex}`;
				const id = isHuman ? 'HUMAN' : `BOT_${seatIndex}`;
				const p = new Player({ id, name, isHuman, stack: gameplay.startingStack, seatIndex });
				session.players.push(p);
				session.table.setSeat(seatIndex, p);
			}

			// Assign blinds using the same rule as Session.startHand.
			session.table.buttonSeatIndex = buttonSeatIndex;
			if (occupiedSeats.length === 2) {
				session.table.smallBlindSeatIndex = buttonSeatIndex;
				session.table.bigBlindSeatIndex = pickNextSeatedAfter(buttonSeatIndex);
			} else {
				session.table.smallBlindSeatIndex = pickNextSeatedAfter(buttonSeatIndex);
				session.table.bigBlindSeatIndex = pickNextSeatedAfter(session.table.smallBlindSeatIndex);
			}

			return session;
		};

		// Case A: 4-handed (3+ players) fixed seats.
		// Expect:
		// - Preflop firstToAct = UTG = next seat after BB
		// - Postflop firstToAct = next seat after BTN
		{
			const session = buildFixedSession(9, [0, 2, 4, 6], 0);
			logFirstActors('[CaseA.4Handed]', session);
		}

		// Case B: Heads-up.
		// Expect (Spec §12): button=SB; preflop button first; postflop BB first.
		{
			const session = buildFixedSession(9, [1, 7], 1);
			logFirstActors('[CaseB.HeadsUp]', session);
		}

		// Case C: 4-handed with non-acting players to ensure we skip Folded/AllIn.
		// Setup: seats [0,2,4,6], button=0 => normal postflop first-to-act would be seat 2.
		// We force:
		// - seat 2 = AllIn (still in hand, but cannot act)
		// - seat 6 = Folded (cannot act)
		// Expected postflop first-to-act becomes seat 0.
		{
			const session = buildFixedSession(9, [0, 2, 4, 6], 0);
			const p2 = session.table.getSeat(2);
			const p6 = session.table.getSeat(6);
			if (!p2 || !p6) throw new Error('CaseC: expected seats 2 and 6 occupied');
			p2.status = PlayerStatus.AllIn;
			p6.status = PlayerStatus.Folded;
			logFirstActors('[CaseC.SkipAllInFolded]', session);
		}
	}
}
