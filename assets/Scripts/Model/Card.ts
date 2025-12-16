export enum Suit {
	Clubs = 'C',
	Diamonds = 'D',
	Hearts = 'H',
	Spades = 'S',
}

export enum Rank {
	Two = 2,
	Three = 3,
	Four = 4,
	Five = 5,
	Six = 6,
	Seven = 7,
	Eight = 8,
	Nine = 9,
	Ten = 10,
	Jack = 11,
	Queen = 12,
	King = 13,
	Ace = 14,
}

export function rankToString(rank: Rank): string {
	switch (rank) {
		case Rank.Two: return '2';
		case Rank.Three: return '3';
		case Rank.Four: return '4';
		case Rank.Five: return '5';
		case Rank.Six: return '6';
		case Rank.Seven: return '7';
		case Rank.Eight: return '8';
		case Rank.Nine: return '9';
		case Rank.Ten: return 'T';
		case Rank.Jack: return 'J';
		case Rank.Queen: return 'Q';
		case Rank.King: return 'K';
		case Rank.Ace: return 'A';
		default: return String(rank);
	}
}

export function suitToString(suit: Suit): string {
	return suit;
}

export class Card {
	readonly suit: Suit;
	readonly rank: Rank;

	constructor(rank: Rank, suit: Suit) {
		this.rank = rank;
		this.suit = suit;
	}

	toShortString(): string {
		return `${rankToString(this.rank)}${suitToString(this.suit)}`;
	}
}
