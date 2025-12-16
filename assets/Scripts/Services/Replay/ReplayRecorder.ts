import { GameConfig } from '../../Config/GameConfig';
import type { Action } from '../../Model/Action';
import type { Card } from '../../Model/Card';
import type { HandStartInfo, Session } from '../../Model/Session';

export type ReplayLogVersion = 1;

export interface ReplaySeatLog {
	seatIndex: number;
	id: string;
	name: string;
	isHuman: boolean;
	startingStack: number;
}

export interface ReplayDeckDrawLog {
	tag: string;
	cards: string[];
	remaining?: number;
}

export interface ReplayHandLog {
	handNumber: number;
	buttonSeatIndex: number;
	smallBlindSeatIndex: number;
	bigBlindSeatIndex: number;
	postedAntes: Record<number, number>;
	postedBlinds: Record<number, number>;
	deck: {
		shuffledOrder?: string[];
		draws: ReplayDeckDrawLog[];
	};
	actions: Action[];
}

export interface ReplayLog {
	replayVersion: ReplayLogVersion;
	schemaVersion: number;
	taskId: string;
	createdAtMs: number;
	session: {
		maxSeats: number;
		playerCount: number;
		humanSeatIndex: number;
		seats: ReplaySeatLog[];
	};
	hands: ReplayHandLog[];
}

function cardsToShortStrings(cards: ReadonlyArray<Card>): string[] {
	return cards.map((c) => c.toShortString());
}

export class ReplayRecorder {
	private readonly log: ReplayLog;
	private currentHand: ReplayHandLog | null;

	constructor(taskId: string) {
		this.log = {
			replayVersion: 1,
			schemaVersion: GameConfig.schemaVersion,
			taskId,
			createdAtMs: Date.now(),
			session: {
				maxSeats: 0,
				playerCount: 0,
				humanSeatIndex: -1,
				seats: [],
			},
			hands: [],
		};
		this.currentHand = null;
	}

	beginSession(session: Session): void {
		const seats: ReplaySeatLog[] = [];
		for (let i = 0; i < session.table.maxSeats; i++) {
			const p = session.table.getSeat(i);
			if (!p) continue;
			seats.push({
				seatIndex: i,
				id: p.id,
				name: p.name,
				isHuman: p.isHuman,
				startingStack: session.gameplay.startingStack,
			});
		}

		seats.sort((a, b) => a.seatIndex - b.seatIndex);

		this.log.session = {
			maxSeats: session.table.maxSeats,
			playerCount: session.players.length,
			humanSeatIndex: session.humanSeatIndex,
			seats,
		};
	}

	beginHand(info: HandStartInfo): void {
		const hand: ReplayHandLog = {
			handNumber: info.handNumber,
			buttonSeatIndex: info.buttonSeatIndex,
			smallBlindSeatIndex: info.smallBlindSeatIndex,
			bigBlindSeatIndex: info.bigBlindSeatIndex,
			postedAntes: info.postedAntes,
			postedBlinds: info.postedBlinds,
			deck: { draws: [] },
			actions: [],
		};
		this.log.hands.push(hand);
		this.currentHand = hand;
	}

	recordDeckShuffled(shuffledOrder: ReadonlyArray<Card>): void {
		if (!this.currentHand) throw new Error('recordDeckShuffled called before beginHand');
		this.currentHand.deck.shuffledOrder = cardsToShortStrings(shuffledOrder);
	}

	recordDraw(tag: string, cards: ReadonlyArray<Card>, remaining?: number): void {
		if (!this.currentHand) throw new Error('recordDraw called before beginHand');
		this.currentHand.deck.draws.push({
			tag,
			cards: cardsToShortStrings(cards),
			remaining,
		});
	}

	recordAction(action: Action): void {
		if (!this.currentHand) throw new Error('recordAction called before beginHand');
		this.currentHand.actions.push(action);
	}

	build(): ReplayLog {
		return this.log;
	}
}
