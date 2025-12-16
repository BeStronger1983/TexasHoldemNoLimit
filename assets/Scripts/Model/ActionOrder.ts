import { PlayerStatus } from './Player';
import { Street, type Table } from './Table';

function getSeatsNotOut(table: Table): number[] {
	const result: number[] = [];
	for (let i = 0; i < table.maxSeats; i++) {
		const p = table.getSeat(i);
		if (!p) continue;
		if (p.status === PlayerStatus.Out) continue;
		result.push(i);
	}
	return result;
}

function canActInBetting(table: Table, seatIndex: number): boolean {
	const p = table.getSeat(seatIndex);
	if (!p) return false;
	if (p.status !== PlayerStatus.Active) return false;
	return true;
}

function findNextSeatIndex(table: Table, startSeatIndex: number, includeStart: boolean, predicate: (seatIndex: number) => boolean): number {
	for (let step = 0; step < table.maxSeats; step++) {
		const offset = includeStart ? step : step + 1;
		const i = (startSeatIndex + offset) % table.maxSeats;
		if (predicate(i)) return i;
	}
	throw new Error('No matching seat found');
}

function getNextSeatNotOutAfter(table: Table, fromSeatIndex: number): number {
	return findNextSeatIndex(table, fromSeatIndex, false, (i) => {
		const p = table.getSeat(i);
		if (!p) return false;
		if (p.status === PlayerStatus.Out) return false;
		return true;
	});
}

function isHeadsUpHand(table: Table): boolean {
	return getSeatsNotOut(table).length === 2;
}

/**
 * 回傳指定街別「第一位應行動」的 seat index。
 *
 * - Preflop：
 *   - 3+ 人：從 BB 左手邊（UTG）開始
 *   - Heads-up：Button（同時是 SB）先行
 * - Postflop（Flop/Turn/River）：
 *   - 3+ 人：從 BTN 左手邊第一位仍在局玩家開始
 *   - Heads-up：BB 先行
 *
 * 會自動略過無法行動者（Folded/AllIn/Out/空位）。
 */
export function getFirstToActSeatIndex(table: Table, street: Street): number {
	const buttonSeatIndex = table.buttonSeatIndex;
	const bigBlindSeatIndex = table.bigBlindSeatIndex;
	if (typeof buttonSeatIndex !== 'number') throw new Error('buttonSeatIndex is not set');
	if (typeof bigBlindSeatIndex !== 'number') throw new Error('bigBlindSeatIndex is not set');

	const hu = isHeadsUpHand(table);
	let startSeatIndex: number;

	if (street === Street.Preflop) {
		startSeatIndex = hu ? buttonSeatIndex : getNextSeatNotOutAfter(table, bigBlindSeatIndex);
	} else if (street === Street.Flop || street === Street.Turn || street === Street.River) {
		startSeatIndex = hu ? bigBlindSeatIndex : getNextSeatNotOutAfter(table, buttonSeatIndex);
	} else {
		throw new Error(`Unsupported street for first-to-act: ${street}`);
	}

	return findNextSeatIndex(table, startSeatIndex, true, (i) => canActInBetting(table, i));
}
