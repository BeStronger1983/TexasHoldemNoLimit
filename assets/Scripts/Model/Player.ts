import type { Card } from './Card';

export enum PlayerStatus {
	Active = 'Active',
	Folded = 'Folded',
	AllIn = 'AllIn',
	Out = 'Out',
}

export interface PlayerInit {
	id: string;
	name: string;
	isHuman: boolean;
	stack: number;
	seatIndex?: number;
}

export class Player {
	readonly id: string;
	name: string;
	isHuman: boolean;
	seatIndex: number | null;

	status: PlayerStatus;
	stack: number;

	holeCards: Card[];

	// Chips invested in the pot across the whole hand.
	contributionThisHand: number;

	constructor(init: PlayerInit) {
		this.id = init.id;
		this.name = init.name;
		this.isHuman = init.isHuman;
		this.seatIndex = typeof init.seatIndex === 'number' ? init.seatIndex : null;

		this.status = PlayerStatus.Active;
		this.stack = Math.max(0, Math.trunc(init.stack));

		this.holeCards = [];
		this.contributionThisHand = 0;
	}

	resetForNewHand(): void {
		this.status = this.stack > 0 ? PlayerStatus.Active : PlayerStatus.Out;
		this.holeCards = [];
		this.contributionThisHand = 0;
	}
}
