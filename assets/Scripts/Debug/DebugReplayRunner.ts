import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';
import { ActionType, makeAction } from '../Model/Action';
import { Deck } from '../Model/Deck';
import { PlayerStatus } from '../Model/Player';
import type { Session } from '../Model/Session';
import { Session as SessionClass } from '../Model/Session';
import { ReplayRecorder } from '../Services/Replay/ReplayRecorder';
import { settingsService } from '../Services/SettingsService';
import { SecureRng } from '../Services/Rng/SecureRng';

const { ccclass } = _decorator;

function getSeatsInHand(session: Session): number[] {
	const seats: number[] = [];
	for (let i = 0; i < session.table.maxSeats; i++) {
		const p = session.table.getSeat(i);
		if (!p) continue;
		if (p.status === PlayerStatus.Out) continue;
		seats.push(i);
	}
	return seats;
}

function getNextSeatInHandAfter(session: Session, fromSeatIndex: number): number {
	for (let step = 0; step < session.table.maxSeats; step++) {
		const i = (fromSeatIndex + 1 + step) % session.table.maxSeats;
		const p = session.table.getSeat(i);
		if (!p) continue;
		if (p.status === PlayerStatus.Out) continue;
		return i;
	}
	throw new Error('No seat in hand found');
}

function buildDealOrder(session: Session, buttonSeatIndex: number): number[] {
	const seatsInHand = getSeatsInHand(session);
	if (seatsInHand.length < 2) throw new Error('Expected at least 2 seats in hand');

	const order: number[] = [];
	let cursor = buttonSeatIndex;
	for (let i = 0; i < seatsInHand.length; i++) {
		cursor = getNextSeatInHandAfter(session, cursor);
		order.push(cursor);
	}
	return order;
}

@ccclass('DebugReplayRunner')
export class DebugReplayRunner extends Component {
	start(): void {
		console.log(`[TEST] T1.4.DebugReplay schemaVersion=${GameConfig.schemaVersion}`);
		if (!GameConfig.logEnabled) {
			console.log('[DebugReplayRunner] GameConfig.logEnabled=false, skip replay output');
			return;
		}

		const settings = settingsService.load();
		const gameplay = settings.gameplay;

		const rng = new SecureRng();
		const session = SessionClass.createRandom(rng, { maxSeats: 9, gameplay });

		const recorder = new ReplayRecorder('T1.4');
		recorder.beginSession(session);

		const hand = session.startHand();
		recorder.beginHand(hand);

		// Deck shuffle + draw sequence (hole cards only for this milestone).
		const deck = new Deck();
		deck.shuffle(rng);
		recorder.recordDeckShuffled(deck.peekTop(deck.count));

		const dealOrder = buildDealOrder(session, hand.buttonSeatIndex);
		for (let round = 1; round <= 2; round++) {
			for (const seatIndex of dealOrder) {
				const card = deck.drawOne();
				recorder.recordDraw(`hole:seat${seatIndex}:card${round}`, [card], deck.count);
			}
		}

		// Action sequence (sample; betting engine will replace this in Milestone 2).
		const bbPosted = hand.postedBlinds[hand.bigBlindSeatIndex] ?? session.gameplay.bigBlind;
		const firstActor = getNextSeatInHandAfter(session, hand.bigBlindSeatIndex);
		const secondActor = getNextSeatInHandAfter(session, firstActor);
		const thirdActor = getNextSeatInHandAfter(session, secondActor);

		const p1 = session.table.getSeat(firstActor);
		const p3 = session.table.getSeat(thirdActor);
		if (!p1 || !p3) throw new Error('Missing actors');

		const toCall1 = Math.max(0, bbPosted - p1.contributionThisHand);
		recorder.recordAction(makeAction(firstActor, ActionType.Call, Math.min(p1.stack, toCall1)));
		recorder.recordAction(makeAction(secondActor, ActionType.Fold, 0));

		const toCall3 = Math.max(0, bbPosted - p3.contributionThisHand);
		const raiseExtra = bbPosted; // simple: +1BB
		recorder.recordAction(makeAction(thirdActor, ActionType.Raise, Math.min(p3.stack, toCall3 + raiseExtra)));

		const replay = recorder.build();
		console.log('[DebugReplayRunner] replayLog=', JSON.stringify(replay));
	}
}
