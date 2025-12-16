import type { IRng } from '../Services/Rng/IRng';

import { GameConfig } from '../Config/GameConfig';
import type { GameplaySettings } from '../Services/SettingsService';
import { Player, PlayerStatus, type PlayerInit } from './Player';
import { Table } from './Table';
import { Street } from './Table';

export type SessionResult = 'InProgress' | 'HumanBusted' | 'HumanWon';

export interface SessionInit {
	maxSeats?: number;
	gameplay?: GameplaySettings;
	burnCardEnabled?: boolean;
}

export interface SessionRules {
	burnCardEnabled: boolean;
}

export interface HandStartInfo {
	handNumber: number;
	buttonSeatIndex: number;
	smallBlindSeatIndex: number;
	bigBlindSeatIndex: number;
	postedAntes: Record<number, number>; // seatIndex -> amount
	postedBlinds: Record<number, number>; // seatIndex -> amount
}

function toSafeInt(value: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.trunc(value);
}

function shuffleInPlace<T>(arr: T[], rng: IRng): void {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = rng.nextInt(i + 1);
		const tmp = arr[i];
		arr[i] = arr[j];
		arr[j] = tmp;
	}
}

export class Session {
	readonly table: Table;
	readonly rng: IRng;
	readonly gameplay: GameplaySettings;
	readonly rules: SessionRules;

	players: Player[];
	handNumber: number;

	result: SessionResult;

	constructor(rng: IRng, init?: SessionInit) {
		this.rng = rng;
		this.table = new Table({ maxSeats: init?.maxSeats ?? 9 });
		this.rules = Object.freeze({
			burnCardEnabled: init?.burnCardEnabled ?? GameConfig.burnCardEnabled,
		});

		// Prefer SettingsService gameplay values when provided; fall back to GameConfig.
		const startingStack = Math.max(
			1,
			toSafeInt(init?.gameplay?.startingStack ?? GameConfig.startingStack, GameConfig.startingStack),
		);
		const smallBlind = Math.max(0, toSafeInt(init?.gameplay?.smallBlind ?? GameConfig.smallBlind, GameConfig.smallBlind));
		const bigBlindRaw = Math.max(0, toSafeInt(init?.gameplay?.bigBlind ?? GameConfig.bigBlind, GameConfig.bigBlind));
		const ante = Math.max(0, toSafeInt(init?.gameplay?.ante ?? GameConfig.ante, GameConfig.ante));
		this.gameplay = Object.freeze({
			startingStack,
			smallBlind,
			bigBlind: Math.max(bigBlindRaw, smallBlind),
			ante,
		});

		this.players = [];
		this.handNumber = 0;
		this.result = 'InProgress';
	}

	static createRandom(rng: IRng, init?: SessionInit): Session {
		const session = new Session(rng, init);
		session.startNewSession();
		return session;
	}

	get humanSeatIndex(): number {
		const human = this.players.find((p) => p.isHuman);
		if (!human || typeof human.seatIndex !== 'number') throw new Error('Human not seated');
		return human.seatIndex;
	}

	get activeSeatIndices(): number[] {
		const result: number[] = [];
		for (let i = 0; i < this.table.maxSeats; i++) {
			const p = this.table.getSeat(i);
			if (!p) continue;
			if (p.status === PlayerStatus.Out) continue;
			if (p.stack <= 0) continue;
			result.push(i);
		}
		return result;
	}

	private pickNextActiveSeatAfter(fromSeatIndex: number): number {
		for (let step = 0; step < this.table.maxSeats; step++) {
			const i = (fromSeatIndex + 1 + step) % this.table.maxSeats;
			const p = this.table.getSeat(i);
			if (!p) continue;
			if (p.status === PlayerStatus.Out) continue;
			if (p.stack <= 0) continue;
			return i;
		}
		throw new Error('No active seat found');
	}

	startNewSession(): void {
		// Clear table.
		for (let i = 0; i < this.table.maxSeats; i++) this.table.setSeat(i, null);

		this.players = [];
		this.handNumber = 0;
		this.result = 'InProgress';

		// Random N in [2, 9] but capped by maxSeats.
		const maxPlayers = Math.min(9, this.table.maxSeats);
		const n = Math.min(maxPlayers, this.rng.nextInt(8) + 2);

		// Randomly pick N distinct seats.
		const seats = Array.from({ length: this.table.maxSeats }, (_, i) => i);
		shuffleInPlace(seats, this.rng);
		const chosenSeats = seats.slice(0, n);

		// Choose which of the N is human.
		const humanIndex = this.rng.nextInt(n);

		let botCounter = 1;
		for (let i = 0; i < n; i++) {
			const isHuman = i === humanIndex;
			const id = isHuman ? 'HUMAN' : `BOT_${botCounter}`;
			const name = isHuman ? 'You' : `Bot-${botCounter}`;
			const init: PlayerInit = {
				id,
				name,
				isHuman,
				stack: this.gameplay.startingStack,
				seatIndex: chosenSeats[i],
			};
			const player = new Player(init);
			this.players.push(player);
			this.table.setSeat(chosenSeats[i], player);
			if (!isHuman) botCounter++;
		}

		// Reset dealer/button positions.
		this.table.buttonSeatIndex = null;
		this.table.smallBlindSeatIndex = null;
		this.table.bigBlindSeatIndex = null;
	}

	startHand(): HandStartInfo {
		if (this.result !== 'InProgress') throw new Error(`Session already ended: ${this.result}`);

		// Remove broke bots / detect session end before starting a new hand.
		this.applyBrokeRules();
		if (this.result !== 'InProgress') throw new Error(`Cannot start hand, session ended: ${this.result}`);

		const activeSeats = this.activeSeatIndices;
		if (activeSeats.length < 2) {
			// If only human remains, applyBrokeRules should have ended the session. Otherwise treat as end.
			this.result = 'HumanWon';
			throw new Error('Not enough active players to start a hand');
		}

		// Reset per-hand state.
		for (const p of this.players) p.resetForNewHand();
		this.table.deck = null;
		this.table.burnCards = [];
		this.table.communityCards = [];
		this.table.street = Street.Preflop;

		this.handNumber++;

		// Button: first hand random among active; later move clockwise to next active.
		let buttonSeatIndex: number;
		if (typeof this.table.buttonSeatIndex !== 'number') {
			buttonSeatIndex = activeSeats[this.rng.nextInt(activeSeats.length)];
		} else {
			buttonSeatIndex = this.pickNextActiveSeatAfter(this.table.buttonSeatIndex);
		}

		// Blinds seats (Heads-up special case):
		// - HU: Button is SB, other is BB
		// - 3+: SB is next after button, BB next after SB
		let smallBlindSeatIndex: number;
		let bigBlindSeatIndex: number;
		if (activeSeats.length === 2) {
			smallBlindSeatIndex = buttonSeatIndex;
			bigBlindSeatIndex = this.pickNextActiveSeatAfter(buttonSeatIndex);
		} else {
			smallBlindSeatIndex = this.pickNextActiveSeatAfter(buttonSeatIndex);
			bigBlindSeatIndex = this.pickNextActiveSeatAfter(smallBlindSeatIndex);
		}

		this.table.buttonSeatIndex = buttonSeatIndex;
		this.table.smallBlindSeatIndex = smallBlindSeatIndex;
		this.table.bigBlindSeatIndex = bigBlindSeatIndex;

		const postedAntes: Record<number, number> = {};
		const postedBlinds: Record<number, number> = {};

		// Post antes.
		if (this.gameplay.ante > 0) {
			for (let i = 0; i < this.table.maxSeats; i++) {
				const p = this.table.getSeat(i);
				if (!p) continue;
				if (p.status === PlayerStatus.Out) continue;
				if (p.stack <= 0) continue;

				const pay = Math.min(this.gameplay.ante, p.stack);
				p.stack -= pay;
				p.contributionThisHand += pay;
				postedAntes[i] = pay;
				if (p.stack === 0 && pay > 0) p.status = PlayerStatus.AllIn;
			}
		}

		// Post blinds.
		const sbPlayer = this.table.getSeat(smallBlindSeatIndex);
		const bbPlayer = this.table.getSeat(bigBlindSeatIndex);
		if (!sbPlayer || !bbPlayer) throw new Error('Blind seats must be occupied');

		const sbPay = Math.min(this.gameplay.smallBlind, sbPlayer.stack);
		sbPlayer.stack -= sbPay;
		sbPlayer.contributionThisHand += sbPay;
		postedBlinds[smallBlindSeatIndex] = sbPay;
		if (sbPlayer.stack === 0 && sbPay > 0) sbPlayer.status = PlayerStatus.AllIn;

		const bbPay = Math.min(this.gameplay.bigBlind, bbPlayer.stack);
		bbPlayer.stack -= bbPay;
		bbPlayer.contributionThisHand += bbPay;
		postedBlinds[bigBlindSeatIndex] = bbPay;
		if (bbPlayer.stack === 0 && bbPay > 0) bbPlayer.status = PlayerStatus.AllIn;

		return {
			handNumber: this.handNumber,
			buttonSeatIndex,
			smallBlindSeatIndex,
			bigBlindSeatIndex,
			postedAntes,
			postedBlinds,
		};
	}

	applyBrokeRules(): void {
		// If human is broke -> session failed.
		const human = this.players.find((p) => p.isHuman);
		if (!human) throw new Error('Missing human player');
		if (human.stack <= 0) {
			human.status = PlayerStatus.Out;
			this.result = 'HumanBusted';
			return;
		}

		// Bots with stack=0 leave table.
		for (const p of this.players) {
			if (p.isHuman) continue;
			if (p.stack > 0) continue;
			p.status = PlayerStatus.Out;
			if (typeof p.seatIndex === 'number') {
				this.table.setSeat(p.seatIndex, null);
			}
		}

		// If only human remains with chips -> win.
		let remainingWithChips = 0;
		let remainingHumanWithChips = false;
		for (const p of this.players) {
			if (p.stack <= 0) continue;
			remainingWithChips++;
			if (p.isHuman) remainingHumanWithChips = true;
		}
		if (remainingWithChips === 1 && remainingHumanWithChips) {
			this.result = 'HumanWon';
		}
	}
}
