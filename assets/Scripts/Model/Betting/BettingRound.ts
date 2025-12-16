import { ActionType, type Action } from '../Action';
import { GameConfig } from '../../Config/GameConfig';
import { PlayerStatus } from '../Player';
import type { Table } from '../Table';

export type BettingRoundEndReason = 'OnlyOneUnfolded' | 'AllActiveMatchedAndActed' | 'AllIn';

export interface BettingRoundInit {
	table: Table;
	firstToActSeatIndex: number;

	/** Minimum bet size for postflop and baseline min-raise increment. Typically = big blind. */
	bigBlind: number;

	/** Initial committed chips for this street (e.g. SB/BB on preflop). Ante should NOT be included. */
	startingBetsBySeatIndex?: Record<number, number>;

	reopenOnShortAllinRaise?: boolean;
}

export interface BettingActionOptions {
	seatIndex: number;
	toCall: number;
	currentBet: number;
	lastRaiseIncrement: number;
	minBet: number;
	minRaiseTo: number | null;
	maxCommit: number;
	actions: ReadonlySet<ActionType>;

	/** For convenience (delta amounts in our Action model). */
	callAmount: number;
	minBetAmount: number;
	minRaiseAmount: number | null;
	allInAmount: number;

	/** If true, this seat is blocked from raising due to a short all-in raise (when config disables reopen). */
	raiseBlockedByShortAllIn: boolean;
}

function safeInt(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.trunc(value));
}

function countInHandNotFolded(table: Table): number {
	let c = 0;
	for (let i = 0; i < table.maxSeats; i++) {
		const p = table.getSeat(i);
		if (!p) continue;
		if (p.status === PlayerStatus.Out) continue;
		if (p.status === PlayerStatus.Folded) continue;
		c++;
	}
	return c;
}

function findNextActiveSeatIndex(table: Table, fromSeatIndex: number): number | null {
	for (let step = 0; step < table.maxSeats; step++) {
		const i = (fromSeatIndex + 1 + step) % table.maxSeats;
		const p = table.getSeat(i);
		if (!p) continue;
		if (p.status !== PlayerStatus.Active) continue;
		return i;
	}
	return null;
}

export class BettingRound {
	readonly table: Table;
	readonly bigBlind: number;
	readonly reopenOnShortAllinRaise: boolean;

	/** Per-seat committed chips for this street (not the whole hand). */	
	readonly betThisStreet: number[];

	currentBet: number;
	lastRaiseIncrement: number;

	nextToActSeatIndex: number | null;
	isFinished: boolean;
	endReason: BettingRoundEndReason | null;

	private hasActedSinceReopen: boolean[];
	private shortRaiseOccurredSinceReopen: boolean;

	constructor(init: BettingRoundInit) {
		this.table = init.table;
		this.bigBlind = Math.max(1, safeInt(init.bigBlind));
		this.reopenOnShortAllinRaise = init.reopenOnShortAllinRaise ?? GameConfig.reopenOnShortAllinRaise;

		this.betThisStreet = Array.from({ length: this.table.maxSeats }, () => 0);
		this.currentBet = 0;

		if (init.startingBetsBySeatIndex) {
			// Avoid Object.entries to stay compatible with older TS lib targets.
			for (const k in init.startingBetsBySeatIndex) {
				const v = init.startingBetsBySeatIndex[k];
				const seatIndex = Math.trunc(Number(k));
				if (seatIndex < 0 || seatIndex >= this.table.maxSeats) continue;
				this.betThisStreet[seatIndex] = safeInt(v);
				this.currentBet = Math.max(this.currentBet, this.betThisStreet[seatIndex]);
			}
		}

		// Baseline rule: if street is unopened, minimum bet is big blind.
		// If already opened by forced bets (preflop blinds), min raise increment starts at currentBet (== BB).
		this.lastRaiseIncrement = this.currentBet > 0 ? Math.max(1, this.currentBet) : this.bigBlind;

		this.hasActedSinceReopen = Array.from({ length: this.table.maxSeats }, () => false);
		this.shortRaiseOccurredSinceReopen = false;

		this.nextToActSeatIndex = init.firstToActSeatIndex;
		this.isFinished = false;
		this.endReason = null;

		this.recomputeTerminalState();
	}

	getToCall(seatIndex: number): number {
		const p = this.table.getSeat(seatIndex);
		if (!p) return 0;
		if (p.status !== PlayerStatus.Active) return 0;
		return Math.max(0, this.currentBet - this.betThisStreet[seatIndex]);
	}

	getMinRaiseTo(seatIndex: number): number | null {
		const p = this.table.getSeat(seatIndex);
		if (!p) return null;
		if (p.status !== PlayerStatus.Active) return null;
		if (this.currentBet <= 0) return null; // raise doesn't exist when unopened
		return this.currentBet + this.lastRaiseIncrement;
	}

	getActionOptions(seatIndex: number): BettingActionOptions {
		const p = this.table.getSeat(seatIndex);
		if (!p) throw new Error(`No player at seatIndex=${seatIndex}`);

		const maxCommit = p.status === PlayerStatus.Active ? safeInt(p.stack) : 0;
		const toCall = this.getToCall(seatIndex);

		const minBet = this.bigBlind;
		const minRaiseTo = this.getMinRaiseTo(seatIndex);
		const minRaiseAmount = minRaiseTo !== null ? Math.max(0, minRaiseTo - this.betThisStreet[seatIndex]) : null;

		const callAmount = p.status === PlayerStatus.Active ? Math.min(maxCommit, toCall) : 0;
		const allInAmount = p.status === PlayerStatus.Active ? maxCommit : 0;

		const actions = new Set<ActionType>();
		const raiseBlockedByShortAllIn =
			p.status === PlayerStatus.Active && this.shortRaiseOccurredSinceReopen && this.hasActedSinceReopen[seatIndex];

		if (p.status === PlayerStatus.Active) {
			actions.add(ActionType.Fold);

			if (toCall === 0) {
				actions.add(ActionType.Check);
				if (maxCommit > 0) {
					actions.add(ActionType.AllIn);
					// Bet is only meaningful when unopened; otherwise it's a check.
					if (this.currentBet === 0) actions.add(ActionType.Bet);
				}
			} else {
				if (maxCommit > 0) actions.add(ActionType.AllIn);
				actions.add(ActionType.Call);
				// Raise is only possible if player can make at least minRaiseTo and is not blocked by short all-in.
				if (!raiseBlockedByShortAllIn && minRaiseTo !== null) {
					const canReachMinRaise = this.betThisStreet[seatIndex] + maxCommit >= minRaiseTo;
					const canDoMoreThanCall = maxCommit > toCall;
					if (canReachMinRaise && canDoMoreThanCall) actions.add(ActionType.Raise);
				}
			}
		}

		return {
			seatIndex,
			toCall,
			currentBet: this.currentBet,
			lastRaiseIncrement: this.lastRaiseIncrement,
			minBet,
			minRaiseTo,
			maxCommit,
			actions,
			callAmount,
			minBetAmount: minBet,
			minRaiseAmount,
			allInAmount,
			raiseBlockedByShortAllIn,
		};
	}

	applyAction(action: Action): void {
		if (this.isFinished) throw new Error(`BettingRound already finished (reason=${this.endReason ?? 'unknown'})`);
		if (typeof this.nextToActSeatIndex !== 'number') throw new Error('No nextToActSeatIndex (round already closed)');
		if (action.actorSeatIndex !== this.nextToActSeatIndex) {
			throw new Error(`Out-of-turn action: actor=${action.actorSeatIndex}, expected=${this.nextToActSeatIndex}`);
		}

		const seatIndex = action.actorSeatIndex;
		const p = this.table.getSeat(seatIndex);
		if (!p) throw new Error(`No player at seatIndex=${seatIndex}`);
		if (p.status !== PlayerStatus.Active) throw new Error(`Player at seatIndex=${seatIndex} cannot act (status=${p.status})`);

		const opts = this.getActionOptions(seatIndex);
		if (!opts.actions.has(action.type)) {
			throw new Error(
				`Illegal action type=${action.type} at seatIndex=${seatIndex} (toCall=${opts.toCall}, currentBet=${opts.currentBet})`,
			);
		}

		switch (action.type) {
			case ActionType.Fold: {
				if (action.amount !== 0) throw new Error('Fold amount must be 0');
				p.status = PlayerStatus.Folded;
				this.hasActedSinceReopen[seatIndex] = true;
				break;
			}
			case ActionType.Check: {
				if (action.amount !== 0) throw new Error('Check amount must be 0');
				if (opts.toCall !== 0) throw new Error(`Cannot check when toCall=${opts.toCall}`);
				this.hasActedSinceReopen[seatIndex] = true;
				break;
			}
			case ActionType.Call: {
				if (opts.toCall <= 0) throw new Error('Call is only valid when facing a bet');
				const expected = opts.callAmount;
				if (safeInt(action.amount) !== expected) {
					throw new Error(`Call amount mismatch: got=${action.amount}, expected=${expected}`);
				}
				this.commitChips(p, seatIndex, expected);
				this.hasActedSinceReopen[seatIndex] = true;
				break;
			}
			case ActionType.Bet: {
				if (this.currentBet !== 0) throw new Error('Bet is only valid when unopened (currentBet=0)');
				const betAmount = safeInt(action.amount);
				if (betAmount < this.bigBlind) throw new Error(`Bet below minBet=${this.bigBlind}: got=${betAmount}`);
				if (betAmount > p.stack) throw new Error('Bet exceeds stack');

				this.commitChips(p, seatIndex, betAmount);

				this.currentBet = this.betThisStreet[seatIndex];
				this.lastRaiseIncrement = Math.max(1, betAmount);
				this.onFullReopen(seatIndex);
				break;
			}
			case ActionType.Raise: {
				if (this.currentBet <= 0) throw new Error('Raise is only valid when facing a bet');
				if (opts.raiseBlockedByShortAllIn) throw new Error('Raise blocked due to short all-in raise (no reopen)');

				const raiseDelta = safeInt(action.amount);
				if (raiseDelta > p.stack) throw new Error('Raise exceeds stack');

				const totalBet = this.betThisStreet[seatIndex] + raiseDelta;
				const minRaiseTo = this.currentBet + this.lastRaiseIncrement;
				if (totalBet < minRaiseTo) {
					throw new Error(`Raise-to below minRaiseTo=${minRaiseTo}: got raiseTo=${totalBet}`);
				}

				this.commitChips(p, seatIndex, raiseDelta);

				const raiseInc = totalBet - this.currentBet;
				this.currentBet = totalBet;
				this.lastRaiseIncrement = Math.max(1, raiseInc);
				this.onFullReopen(seatIndex);
				break;
			}
			case ActionType.AllIn: {
				const allIn = safeInt(action.amount);
				if (allIn !== safeInt(p.stack)) throw new Error(`AllIn amount must equal stack=${p.stack}, got=${action.amount}`);
				if (allIn <= 0) throw new Error('AllIn amount must be > 0');

				const prevCurrentBet = this.currentBet;
				const prevLastRaiseInc = this.lastRaiseIncrement;
				const prevTotal = this.betThisStreet[seatIndex];

				this.commitChips(p, seatIndex, allIn);

				const newTotal = this.betThisStreet[seatIndex];
				if (newTotal <= prevCurrentBet) {
					// All-in call (or short call): does not increase currentBet.
					this.hasActedSinceReopen[seatIndex] = true;
					break;
				}

				// All-in bet/raise increases the current bet.
				this.currentBet = newTotal;
				const inc = newTotal - prevCurrentBet;

				if (prevCurrentBet === 0) {
					// First bet of the street (all-in).
					// If it meets min bet, treat it as a normal bet opening; otherwise keep baseline min-raise increment.
					if (newTotal >= this.bigBlind) {
						this.lastRaiseIncrement = Math.max(1, newTotal);
						this.onFullReopen(seatIndex);
					} else {
						this.lastRaiseIncrement = this.bigBlind;
						// Do not mark shortRaiseOccurredSinceReopen here; nobody has acted yet, and raising is still allowed.
						this.hasActedSinceReopen[seatIndex] = true;
					}
					break;
				}

				// Facing a bet: this is an all-in raise.
				const isFullRaise = inc >= prevLastRaiseInc;
				if (isFullRaise) {
					this.lastRaiseIncrement = Math.max(1, inc);
					this.onFullReopen(seatIndex);
					break;
				}

				// Short all-in raise.
				if (this.reopenOnShortAllinRaise) {
					// Reopen is allowed, but the minimum raise increment remains based on the last full raise.
					// (i.e. do not shrink lastRaiseIncrement to the short amount).
					this.onFullReopen(seatIndex);
					break;
				}

				// Default: no reopen. Players who already acted since the last full raise cannot re-raise.
				this.shortRaiseOccurredSinceReopen = true;
				this.hasActedSinceReopen[seatIndex] = true;
				break;
			}
			default:
				throw new Error(`Unsupported action type=${action.type as never}`);
		}

		this.recomputeTerminalState();
		if (!this.isFinished) {
			this.nextToActSeatIndex = this.pickNextToActAfter(seatIndex);
			this.recomputeTerminalState();
		}
	}

	private commitChips(p: { stack: number; contributionThisHand: number; status: PlayerStatus }, seatIndex: number, delta: number): void {
		const pay = Math.max(0, Math.trunc(delta));
		if (pay <= 0) return;
		if (pay > p.stack) throw new Error('Commit exceeds stack');
		p.stack -= pay;
		p.contributionThisHand += pay;
		this.betThisStreet[seatIndex] += pay;
		if (p.stack === 0) p.status = PlayerStatus.AllIn;
	}

	private onFullReopen(aggressorSeatIndex: number): void {
		this.shortRaiseOccurredSinceReopen = false;
		for (let i = 0; i < this.table.maxSeats; i++) {
			const p = this.table.getSeat(i);
			if (!p) continue;
			if (p.status !== PlayerStatus.Active) continue;
			this.hasActedSinceReopen[i] = false;
		}
		this.hasActedSinceReopen[aggressorSeatIndex] = true;
	}

	private pickNextToActAfter(fromSeatIndex: number): number | null {
		return findNextActiveSeatIndex(this.table, fromSeatIndex);
	}

	private recomputeTerminalState(): void {
		if (countInHandNotFolded(this.table) <= 1) {
			this.isFinished = true;
			this.endReason = 'OnlyOneUnfolded';
			this.nextToActSeatIndex = null;
			return;
		}

		let anyActive = false;
		let anyCanAct = false;
		let allNonFoldedAreAllIn = true;

		for (let i = 0; i < this.table.maxSeats; i++) {
			const p = this.table.getSeat(i);
			if (!p) continue;
			if (p.status === PlayerStatus.Out) continue;
			if (p.status === PlayerStatus.Folded) continue;

			if (p.status === PlayerStatus.Active) {
				anyActive = true;
				allNonFoldedAreAllIn = false;

				const matched = this.betThisStreet[i] >= this.currentBet;
				const acted = this.hasActedSinceReopen[i];
				if (!matched || !acted) anyCanAct = true;
			}
		}

		if (!anyActive) {
			// Everyone left is all-in.
			this.isFinished = true;
			this.endReason = 'AllIn';
			this.nextToActSeatIndex = null;
			return;
		}

		if (allNonFoldedAreAllIn) {
			this.isFinished = true;
			this.endReason = 'AllIn';
			this.nextToActSeatIndex = null;
			return;
		}

		if (!anyCanAct) {
			this.isFinished = true;
			this.endReason = 'AllActiveMatchedAndActed';
			this.nextToActSeatIndex = null;
			return;
		}

		// Otherwise still running.
		this.isFinished = false;
		this.endReason = null;
	}
}
