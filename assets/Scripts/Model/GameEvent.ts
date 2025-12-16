export enum GameEventType {
	Info = 'Info',
	Warning = 'Warning',
	Error = 'Error',

	DeckShuffled = 'DeckShuffled',
	CardsDealt = 'CardsDealt',
	PlayerSatDown = 'PlayerSatDown',
	PlayerAction = 'PlayerAction',
}

export interface GameEvent {
	type: GameEventType;
	message: string;
	payload?: unknown;
	timestampMs?: number;
}

export function makeEvent(type: GameEventType, message: string, payload?: unknown): GameEvent {
	return {
		type,
		message,
		payload,
		timestampMs: Date.now(),
	};
}
