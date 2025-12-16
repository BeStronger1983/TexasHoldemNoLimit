import { makeEvent, type GameEvent, GameEventType } from '../GameEvent';
import { Session } from '../Session';

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

		if (this.status !== 'InProgress') {
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

		switch (this.state) {
			case GameState.Boot:
				events.push(makeEvent(GameEventType.Info, 'Boot'));
				return this.transitionTo(GameState.MainMenu, events);

			case GameState.MainMenu:
				events.push(makeEvent(GameEventType.Info, 'MainMenu'));
				return this.transitionTo(GameState.TableSetup, events);

			case GameState.TableSetup: {
				events.push(makeEvent(GameEventType.Info, 'TableSetup'));
				if (!this.ctx.session) {
					return this.abortToMainMenu('Missing Session in context (TableSetup cannot create one in T2.1)', events);
				}
				return this.transitionTo(GameState.PostingBlinds, events);
			}

			case GameState.PostingBlinds: {
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

			case GameState.DealHoleCards:
				if (!this.runtime.handStarted) return this.abortToMainMenu('Guard failed: hand not started', events);
				events.push(makeEvent(GameEventType.Info, 'DealHoleCards (placeholder in T2.1)'));
				return this.transitionTo(GameState.BettingPreflop, events);

			case GameState.BettingPreflop:
				events.push(makeEvent(GameEventType.Info, 'BettingPreflop (auto-advance placeholder in T2.1)'));
				return this.transitionTo(GameState.DealFlop, events);

			case GameState.DealFlop:
				events.push(makeEvent(GameEventType.Info, 'DealFlop (placeholder in T2.1)'));
				return this.transitionTo(GameState.BettingFlop, events);

			case GameState.BettingFlop:
				events.push(makeEvent(GameEventType.Info, 'BettingFlop (auto-advance placeholder in T2.1)'));
				return this.transitionTo(GameState.DealTurn, events);

			case GameState.DealTurn:
				events.push(makeEvent(GameEventType.Info, 'DealTurn (placeholder in T2.1)'));
				return this.transitionTo(GameState.BettingTurn, events);

			case GameState.BettingTurn:
				events.push(makeEvent(GameEventType.Info, 'BettingTurn (auto-advance placeholder in T2.1)'));
				return this.transitionTo(GameState.DealRiver, events);

			case GameState.DealRiver:
				events.push(makeEvent(GameEventType.Info, 'DealRiver (placeholder in T2.1)'));
				return this.transitionTo(GameState.BettingRiver, events);

			case GameState.BettingRiver:
				events.push(makeEvent(GameEventType.Info, 'BettingRiver (auto-advance placeholder in T2.1)'));
				return this.transitionTo(GameState.Showdown, events);

			case GameState.Showdown:
				events.push(makeEvent(GameEventType.Info, 'Showdown (placeholder in T2.1)'));
				return this.transitionTo(GameState.Payout, events);

			case GameState.Payout:
				events.push(makeEvent(GameEventType.Info, 'Payout (placeholder in T2.1)'));
				return this.transitionTo(GameState.HandSummary, events);

			case GameState.HandSummary:
				events.push(makeEvent(GameEventType.Info, 'HandSummary'));
				return this.transitionTo(GameState.NextHandOrExit, events);

			case GameState.NextHandOrExit: {
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

			default:
				return this.abortToMainMenu(`Unknown state=${this.state as never}`, events);
		}
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
