import type { Card } from './Card';
import type { Player } from './Player';

export enum Street {
	Preflop = 'Preflop',
	Flop = 'Flop',
	Turn = 'Turn',
	River = 'River',
	Showdown = 'Showdown',
}

export type Seat = Player | null;

export interface TableInit {
	maxSeats?: number;
}

export class Table {
	readonly maxSeats: number;
	readonly seats: Seat[];

	communityCards: Card[];

	buttonSeatIndex: number | null;
	smallBlindSeatIndex: number | null;
	bigBlindSeatIndex: number | null;

	street: Street;

	// Placeholder for future milestones (betting state machine, pot manager, etc.).
	actionState: unknown;
	potManager: unknown;

	constructor(init?: TableInit) {
		this.maxSeats = Math.max(2, Math.trunc(init?.maxSeats ?? 9));
		this.seats = Array.from({ length: this.maxSeats }, () => null);

		this.communityCards = [];
		this.buttonSeatIndex = null;
		this.smallBlindSeatIndex = null;
		this.bigBlindSeatIndex = null;
		this.street = Street.Preflop;

		this.actionState = null;
		this.potManager = null;
	}

	setSeat(seatIndex: number, player: Player | null): void {
		this.assertSeatIndex(seatIndex);
		this.seats[seatIndex] = player;
		if (player) player.seatIndex = seatIndex;
	}

	getSeat(seatIndex: number): Seat {
		this.assertSeatIndex(seatIndex);
		return this.seats[seatIndex];
	}

	getOccupiedSeatIndices(): number[] {
		const result: number[] = [];
		for (let i = 0; i < this.seats.length; i++) {
			if (this.seats[i]) result.push(i);
		}
		return result;
	}

	private assertSeatIndex(seatIndex: number): void {
		const i = Math.trunc(seatIndex);
		if (i < 0 || i >= this.maxSeats) throw new Error(`Invalid seatIndex=${seatIndex} (maxSeats=${this.maxSeats})`);
	}
}
