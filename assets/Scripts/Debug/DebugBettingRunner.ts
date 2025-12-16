import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';
import { getFirstToActSeatIndex } from '../Model/ActionOrder';
import { makeAction, ActionType } from '../Model/Action';
import { BettingRound } from '../Model/Betting/BettingRound';
import { Player, PlayerStatus } from '../Model/Player';
import { Session } from '../Model/Session';
import { Street } from '../Model/Table';
import { settingsService } from '../Services/SettingsService';
import { SecureRng } from '../Services/Rng/SecureRng';

const { ccclass } = _decorator;

@ccclass('DebugBettingRunner')
export class DebugBettingRunner extends Component {
	start(): void {
		console.log(`[TEST] T2.4.DebugBetting schemaVersion=${GameConfig.schemaVersion}`);

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

		const postBlindsLikeStartHand = (session: Session): Record<number, number> => {
			const sb = session.table.smallBlindSeatIndex;
			const bb = session.table.bigBlindSeatIndex;
			if (typeof sb !== 'number' || typeof bb !== 'number') throw new Error('Missing blind seat indices');

			const sbPlayer = session.table.getSeat(sb);
			const bbPlayer = session.table.getSeat(bb);
			if (!sbPlayer || !bbPlayer) throw new Error('Blind seats must be occupied');

			const posted: Record<number, number> = {};
			const sbPay = Math.min(gameplay.smallBlind, sbPlayer.stack);
			sbPlayer.stack -= sbPay;
			sbPlayer.contributionThisHand += sbPay;
			posted[sb] = sbPay;
			if (sbPlayer.stack === 0 && sbPay > 0) sbPlayer.status = PlayerStatus.AllIn;

			const bbPay = Math.min(gameplay.bigBlind, bbPlayer.stack);
			bbPlayer.stack -= bbPay;
			bbPlayer.contributionThisHand += bbPay;
			posted[bb] = bbPay;
			if (bbPlayer.stack === 0 && bbPay > 0) bbPlayer.status = PlayerStatus.AllIn;

			return posted;
		};

		const dumpOptions = (round: BettingRound, seatIndex: number, label: string): void => {
			const p = round.table.getSeat(seatIndex);
			if (!p) throw new Error('Expected occupied seat');
			const opts = round.getActionOptions(seatIndex);
			const actions = Array.from(opts.actions.values()).join(',');
			console.log(
				`[${label}] seat=${seatIndex} status=${p.status} stack=${p.stack} betThisStreet=${round.betThisStreet[seatIndex]} ` +
					`toCall=${opts.toCall} currentBet=${opts.currentBet} lastRaiseInc=${opts.lastRaiseIncrement} minRaiseTo=${opts.minRaiseTo ?? 'null'} ` +
					`raiseBlocked=${opts.raiseBlockedByShortAllIn} actions={${actions}}`,
			);
		};

		const runScenario = (label: string, round: BettingRound, actions: ReturnType<typeof makeAction>[]): void => {
			console.log(`\n[DebugBettingRunner] Scenario ${label} begin`);
			let step = 0;
			while (!round.isFinished) {
				if (typeof round.nextToActSeatIndex !== 'number') throw new Error('Round not finished but nextToAct is null');
				dumpOptions(round, round.nextToActSeatIndex, `${label}.Before`);

				const a = actions[step];
				if (!a) throw new Error(`[${label}] Missing scripted action at step=${step}`);
				console.log(`[${label}] apply step=${step} action=${a.type} actor=${a.actorSeatIndex} amount=${a.amount}`);
				round.applyAction(a);
				step++;
			}

			console.log(`[DebugBettingRunner] Scenario ${label} end reason=${round.endReason}`);
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

		// --- T2.4 fixed betting scripts ---
		// Script 1: folds until only one player remains.
		{
			const session = buildFixedSession(9, [0, 2, 4], 0);
			const postedBlinds = postBlindsLikeStartHand(session);
			const first = getFirstToActSeatIndex(session.table, Street.Preflop);
			const round = new BettingRound({
				table: session.table,
				firstToActSeatIndex: first,
				bigBlind: gameplay.bigBlind,
				startingBetsBySeatIndex: postedBlinds,
			});

			// Seats: [0,2,4], button=0 -> SB=2, BB=4 -> firstToAct=0.
			// UTG(0) folds, SB(2) folds -> BB(4) wins.
			runScenario('FoldToWinner.Preflop', round, [makeAction(0, ActionType.Fold), makeAction(2, ActionType.Fold)]);
		}

		// Script 2: normal bet/raise/call sequence that ends when all matched and acted.
		{
			const session = buildFixedSession(9, [0, 2, 4], 0);
			// Use flop betting (no forced bets this street).
			const first = getFirstToActSeatIndex(session.table, Street.Flop);
			const round = new BettingRound({
				table: session.table,
				firstToActSeatIndex: first,
				bigBlind: gameplay.bigBlind,
			});

			// BTN=0 so postflop firstToAct=SB(2).
			// SB bets 20, BB raises to 60, BTN calls 60, SB calls 40.
			runScenario('BetRaiseCall.Flop', round, [
				makeAction(2, ActionType.Bet, 20),
				makeAction(4, ActionType.Raise, 60),
				makeAction(0, ActionType.Call, 60),
				makeAction(2, ActionType.Call, 40),
			]);
		}

		// Script 3: all players go all-in; round ends with AllIn.
		{
			const session = buildFixedSession(9, [0, 2, 4], 0);
			// Short stacks to force all-in quickly.
			for (const seatIndex of [0, 2, 4]) {
				const p = session.table.getSeat(seatIndex);
				if (!p) continue;
				p.stack = 50;
			}
			const first = getFirstToActSeatIndex(session.table, Street.Flop);
			const round = new BettingRound({
				table: session.table,
				firstToActSeatIndex: first,
				bigBlind: gameplay.bigBlind,
			});

			// Everyone all-in (SB first).
			runScenario('AllIn.Flop', round, [
				makeAction(2, ActionType.AllIn, 50),
				makeAction(4, ActionType.AllIn, 50),
				makeAction(0, ActionType.AllIn, 50),
			]);
		}
	}
}
