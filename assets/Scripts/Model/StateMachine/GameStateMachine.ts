import { makeEvent, type GameEvent, GameEventType } from '../GameEvent';
import { Deck } from '../Deck';
import { PlayerStatus } from '../Player';
import { Session } from '../Session';
import { Street } from '../Table';

import { GameState } from './GameState';

export type StateMachineStatus = 'InProgress' | 'Finished' | 'Aborted';

export interface GameStateMachineLimits {
	maxTotalSteps: number;
	maxVisitsPerState: number;
}

export interface GameStateMachineContext {
	/**
	 * A session that already has seated players. If omitted, the state machine will create one on TableSetup.
	 */
	session?: Session;

	/**
	 * For Debug scenes: when true, state machine stops after one hand.
	 */
	stopAfterOneHand?: boolean;

	limits?: Partial<GameStateMachineLimits>;
}

export type StepResult =
	| {
			type: 'Transition';
			from: GameState;
			to: GameState;
			events: GameEvent[];
		}
	| {
			type: 'Finished';
			finalState: GameState;
			events: GameEvent[];
		}
	| {
			type: 'Aborted';
			finalState: GameState;
			reason: string;
			events: GameEvent[];
		};

interface InternalRuntime {
	handStarted: boolean;
	handNumberStarted: number | null;
	abortedReason: string | null;
}

const DEFAULT_LIMITS: GameStateMachineLimits = {
	maxTotalSteps: 200,
	maxVisitsPerState: 20,
};

export class GameStateMachine {
	state: GameState;
	status: StateMachineStatus;

	private ctx: GameStateMachineContext;
	private runtime: InternalRuntime;
	private totalSteps: number;
	private visits: Map<GameState, number>;
	private limits: GameStateMachineLimits;

	constructor(ctx: GameStateMachineContext, initialState: GameState = GameState.Boot) {
		this.ctx = ctx;
		this.state = initialState;
		this.status = 'InProgress';
		this.runtime = {
			handStarted: false,
			handNumberStarted: null,
			abortedReason: null,
		};
		this.totalSteps = 0;
		this.visits = new Map();
		this.limits = Object.freeze({
			...DEFAULT_LIMITS,
			...(ctx.limits ?? {}),
		});
	}

	get session(): Session | undefined {
		return this.ctx.session;
	}

	step(): StepResult {
		const events: GameEvent[] = [];

		const nonRunning = this.getNonRunningResult(events);
		if (nonRunning) return nonRunning;

		const limited = this.enforceStepAndVisitLimits(events);
		if (limited) return limited;

		return this.runCurrentState(events);
	}

	private getNonRunningResult(events: GameEvent[]): StepResult | null {
		if (this.status === 'InProgress') return null;
		if (this.status === 'Finished') {
			return { type: 'Finished', finalState: this.state, events };
		}
		return {
			type: 'Aborted',
			finalState: this.state,
			reason: this.runtime.abortedReason ?? 'State machine is not running',
			events,
		};
	}

	private enforceStepAndVisitLimits(events: GameEvent[]): StepResult | null {
		this.totalSteps++;
		if (this.totalSteps > this.limits.maxTotalSteps) {
			return this.abortToMainMenu(
				`Exceeded maxTotalSteps=${this.limits.maxTotalSteps} (possible deadlock)`,
				events,
			);
		}

		const visitCount = (this.visits.get(this.state) ?? 0) + 1;
		this.visits.set(this.state, visitCount);
		if (visitCount > this.limits.maxVisitsPerState) {
			return this.abortToMainMenu(
				`Exceeded maxVisitsPerState=${this.limits.maxVisitsPerState} at state=${this.state} (possible deadlock)`,
				events,
			);
		}

		return null;
	}

	private runCurrentState(events: GameEvent[]): StepResult {
		switch (this.state) {
			case GameState.Boot:
				return this.onBoot(events);
			case GameState.MainMenu:
				return this.onMainMenu(events);
			case GameState.TableSetup:
				return this.onTableSetup(events);
			case GameState.PostingBlinds:
				return this.onPostingBlinds(events);
			case GameState.DealHoleCards:
				return this.onDealHoleCards(events);
			case GameState.BettingPreflop:
				return this.onAutoAdvanceBetting('BettingPreflop (auto-advance placeholder in T2.1)', GameState.DealFlop, events);
			case GameState.DealFlop:
				return this.onDealFlop(events);
			case GameState.BettingFlop:
				return this.onAutoAdvanceBetting('BettingFlop (auto-advance placeholder in T2.1)', GameState.DealTurn, events);
			case GameState.DealTurn:
				return this.onDealTurn(events);
			case GameState.BettingTurn:
				return this.onAutoAdvanceBetting('BettingTurn (auto-advance placeholder in T2.1)', GameState.DealRiver, events);
			case GameState.DealRiver:
				return this.onDealRiver(events);
			case GameState.BettingRiver:
				return this.onAutoAdvanceBetting('BettingRiver (auto-advance placeholder in T2.1)', GameState.Showdown, events);
			case GameState.Showdown:
				return this.onShowdown(events);
			case GameState.Payout:
				return this.onPayout(events);
			case GameState.HandSummary:
				return this.onHandSummary(events);
			case GameState.NextHandOrExit:
				return this.onNextHandOrExit(events);
			default:
				return this.abortToMainMenu(`Unknown state=${this.state as never}`, events);
		}
	}

	private onBoot(events: GameEvent[]): StepResult {
		events.push(makeEvent(GameEventType.Info, 'Boot'));
		return this.transitionTo(GameState.MainMenu, events);
	}

	private onMainMenu(events: GameEvent[]): StepResult {
		events.push(makeEvent(GameEventType.Info, 'MainMenu'));
		return this.transitionTo(GameState.TableSetup, events);
	}

	private onTableSetup(events: GameEvent[]): StepResult {
		events.push(makeEvent(GameEventType.Info, 'TableSetup'));
		if (!this.ctx.session) {
			return this.abortToMainMenu('Missing Session in context (TableSetup cannot create one in T2.1)', events);
		}
		return this.transitionTo(GameState.PostingBlinds, events);
	}

	private onPostingBlinds(events: GameEvent[]): StepResult {
		if (!this.ctx.session) return this.abortToMainMenu('Missing Session', events);
		try {
			const info = this.ctx.session.startHand();
			this.runtime.handStarted = true;
			this.runtime.handNumberStarted = info.handNumber;
			events.push(
				makeEvent(GameEventType.Info, `HandStarted #${info.handNumber}`, {
					buttonSeatIndex: info.buttonSeatIndex,
					smallBlindSeatIndex: info.smallBlindSeatIndex,
					bigBlindSeatIndex: info.bigBlindSeatIndex,
					postedAntes: info.postedAntes,
					postedBlinds: info.postedBlinds,
				}),
			);
			return this.transitionTo(GameState.DealHoleCards, events);
		} catch (err) {
			return this.abortToMainMenu(`PostingBlinds failed: ${asErrorMessage(err)}`, events);
		}
	}

	private onDealHoleCards(events: GameEvent[]): StepResult {
		if (!this.runtime.handStarted) return this.abortToMainMenu('Guard failed: hand not started', events);
		if (!this.ctx.session) return this.abortToMainMenu('Missing Session', events);
		try {
			const session = this.ctx.session;
			const table = session.table;
			if (typeof table.smallBlindSeatIndex !== 'number') {
				return this.abortToMainMenu('DealHoleCards failed: smallBlindSeatIndex is not set', events);
			}

			// New deck per hand.
			const deck = new Deck();
			deck.shuffle(session.rng);
			table.deck = deck;
			table.burnCards = [];
			table.communityCards = [];
			table.street = Street.Preflop;

			events.push(
				makeEvent(GameEventType.DeckShuffled, 'DeckShuffled', {
					remaining: deck.count,
				}),
			);

			const dealOrder = buildDealOrderFrom(session, table.smallBlindSeatIndex);
			for (let round = 1; round <= 2; round++) {
				for (const seatIndex of dealOrder) {
					const p = table.getSeat(seatIndex);
					if (!p) continue;
					if (p.status === PlayerStatus.Out) continue;
					const card = deck.drawOne();
					p.holeCards.push(card);
					events.push(
						makeEvent(GameEventType.CardsDealt, 'HoleCardDealt', {
							seatIndex,
							round,
							card: card.toShortString(),
							remaining: deck.count,
						}),
					);
				}
			}
			return this.transitionTo(GameState.BettingPreflop, events);
		} catch (err) {
			return this.abortToMainMenu(`DealHoleCards failed: ${asErrorMessage(err)}`, events);
		}
	}

	private onDealFlop(events: GameEvent[]): StepResult {
		if (!this.runtime.handStarted) return this.abortToMainMenu('Guard failed: hand not started', events);
		if (!this.ctx.session) return this.abortToMainMenu('Missing Session', events);
		try {
			const session = this.ctx.session;
			const table = session.table;
			const deck = table.deck;
			if (!deck) return this.abortToMainMenu('DealFlop failed: missing deck (expected DealHoleCards first)', events);

			this.burnIfEnabled(session, deck, 'Flop', events);

			const flop = deck.draw(3);
			table.communityCards.push(...flop);
			table.street = Street.Flop;
			events.push(
				makeEvent(GameEventType.CardsDealt, 'FlopDealt', {
					cards: flop.map((c) => c.toShortString()),
					remaining: deck.count,
				}),
			);

			return this.transitionTo(GameState.BettingFlop, events);
		} catch (err) {
			return this.abortToMainMenu(`DealFlop failed: ${asErrorMessage(err)}`, events);
		}
	}

	private onDealTurn(events: GameEvent[]): StepResult {
		if (!this.runtime.handStarted) return this.abortToMainMenu('Guard failed: hand not started', events);
		if (!this.ctx.session) return this.abortToMainMenu('Missing Session', events);
		try {
			const session = this.ctx.session;
			const table = session.table;
			const deck = table.deck;
			if (!deck) return this.abortToMainMenu('DealTurn failed: missing deck (expected DealHoleCards first)', events);

			this.burnIfEnabled(session, deck, 'Turn', events);

			const turn = deck.drawOne();
			table.communityCards.push(turn);
			table.street = Street.Turn;
			events.push(
				makeEvent(GameEventType.CardsDealt, 'TurnDealt', {
					card: turn.toShortString(),
					remaining: deck.count,
				}),
			);

			return this.transitionTo(GameState.BettingTurn, events);
		} catch (err) {
			return this.abortToMainMenu(`DealTurn failed: ${asErrorMessage(err)}`, events);
		}
	}

	private onDealRiver(events: GameEvent[]): StepResult {
		if (!this.runtime.handStarted) return this.abortToMainMenu('Guard failed: hand not started', events);
		if (!this.ctx.session) return this.abortToMainMenu('Missing Session', events);
		try {
			const session = this.ctx.session;
			const table = session.table;
			const deck = table.deck;
			if (!deck) return this.abortToMainMenu('DealRiver failed: missing deck (expected DealHoleCards first)', events);

			this.burnIfEnabled(session, deck, 'River', events);

			const river = deck.drawOne();
			table.communityCards.push(river);
			table.street = Street.River;
			events.push(
				makeEvent(GameEventType.CardsDealt, 'RiverDealt', {
					card: river.toShortString(),
					remaining: deck.count,
				}),
			);

			return this.transitionTo(GameState.BettingRiver, events);
		} catch (err) {
			return this.abortToMainMenu(`DealRiver failed: ${asErrorMessage(err)}`, events);
		}
	}

	private burnIfEnabled(session: Session, deck: Deck, streetLabel: 'Flop' | 'Turn' | 'River', events: GameEvent[]): void {
		if (!session.rules.burnCardEnabled) return;
		const table = session.table;
		const burn = deck.drawOne();
		table.burnCards.push(burn);
		events.push(
			makeEvent(GameEventType.CardsDealt, 'BurnCard', {
				street: streetLabel,
				card: burn.toShortString(),
				remaining: deck.count,
			}),
		);
	}

	private onAutoAdvanceBetting(message: string, next: GameState, events: GameEvent[]): StepResult {
		events.push(makeEvent(GameEventType.Info, message));
		return this.transitionTo(next, events);
	}

	private onShowdown(events: GameEvent[]): StepResult {
		events.push(makeEvent(GameEventType.Info, 'Showdown (placeholder in T2.1)'));
		return this.transitionTo(GameState.Payout, events);
	}

	private onPayout(events: GameEvent[]): StepResult {
		events.push(makeEvent(GameEventType.Info, 'Payout (placeholder in T2.1)'));
		return this.transitionTo(GameState.HandSummary, events);
	}

	private onHandSummary(events: GameEvent[]): StepResult {
		events.push(makeEvent(GameEventType.Info, 'HandSummary'));
		return this.transitionTo(GameState.NextHandOrExit, events);
	}

	private onNextHandOrExit(events: GameEvent[]): StepResult {
		events.push(makeEvent(GameEventType.Info, 'NextHandOrExit'));

		// For DebugHandFlow: stop after one hand.
		if (this.ctx.stopAfterOneHand ?? true) {
			this.status = 'Finished';
			return {
				type: 'Finished',
				finalState: this.state,
				events,
			};
		}

		// Otherwise, attempt to start next hand if session still in progress.
		if (!this.ctx.session) return this.abortToMainMenu('Missing Session', events);
		if (this.ctx.session.result !== 'InProgress') {
			this.status = 'Finished';
			return { type: 'Finished', finalState: this.state, events };
		}

		return this.transitionTo(GameState.PostingBlinds, events);
	}

	private transitionTo(next: GameState, events: GameEvent[]): StepResult {
		const from = this.state;
		this.state = next;
		return { type: 'Transition', from, to: next, events };
	}

	private abortToMainMenu(reason: string, events: GameEvent[]): StepResult {
		this.runtime.abortedReason = reason;
		this.status = 'Aborted';
		events.push(makeEvent(GameEventType.Error, `Abort: ${reason}`));

		// Ensure we land in a safe state for callers.
		this.state = GameState.MainMenu;
		return { type: 'Aborted', finalState: this.state, reason, events };
	}
}

function asErrorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	try {
		return JSON.stringify(err);
	} catch {
		return String(err);
	}
}

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

function buildDealOrderFrom(session: Session, startSeatIndex: number): number[] {
	const seatsInHand = getSeatsInHand(session);
	if (seatsInHand.length < 2) throw new Error('Expected at least 2 seats in hand');

	const startPlayer = session.table.getSeat(startSeatIndex);
	if (!startPlayer || startPlayer.status === PlayerStatus.Out) {
		throw new Error(`Invalid deal start seatIndex=${startSeatIndex} (not in hand)`);
	}

	const order: number[] = [startSeatIndex];
	let cursor = startSeatIndex;
	for (let i = 1; i < seatsInHand.length; i++) {
		cursor = getNextSeatInHandAfter(session, cursor);
		order.push(cursor);
	}
	return order;
}
