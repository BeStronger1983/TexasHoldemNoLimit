import type { IRng } from '../Services/Rng/IRng';

import { Card, Rank, Suit } from './Card';

export class Deck {
	private cards: Card[];

	constructor(cards?: ReadonlyArray<Card>) {
		this.cards = cards ? Array.from(cards) : Deck.createStandard52();
	}

	static createStandard52(): Card[] {
		const suits: Suit[] = [Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades];
		const cards: Card[] = [];
		for (const suit of suits) {
			for (let r = Rank.Two; r <= Rank.Ace; r++) {
				cards.push(new Card(r as Rank, suit));
			}
		}
		return cards;
	}

	get count(): number {
		return this.cards.length;
	}

	peekTop(n: number): Card[] {
		const count = Math.max(0, Math.trunc(n));
		return this.cards.slice(0, count);
	}

	shuffle(rng: IRng): void {
		// Fisher–Yates shuffle.
		for (let i = this.cards.length - 1; i > 0; i--) {
			const j = rng.nextInt(i + 1);
			const tmp = this.cards[i];
			this.cards[i] = this.cards[j];
			this.cards[j] = tmp;
		}
	}

	drawOne(): Card {
		if (this.cards.length <= 0) throw new Error('Deck is empty');
		const c = this.cards[0];
		this.cards.splice(0, 1);
		return c;
	}

	draw(count: number): Card[] {
		const n = Math.max(0, Math.trunc(count));
		if (n === 0) return [];
		if (this.cards.length < n) throw new Error(`Deck has only ${this.cards.length} cards, cannot draw ${n}`);
		const drawn = this.cards.slice(0, n);
		this.cards.splice(0, n);
		return drawn;
	}
}
