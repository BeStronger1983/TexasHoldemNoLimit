export enum ActionType {
	Fold = 'Fold',
	Check = 'Check',
	Call = 'Call',
	Bet = 'Bet',
	Raise = 'Raise',
	AllIn = 'AllIn',
}

export interface Action {
	actorSeatIndex: number;
	type: ActionType;

	/**
	 * Amount of chips committed by this action (delta). For Check/Fold this should be 0.
	 *
	 * Note: Later milestones may add more detailed fields (e.g. raise-to).
	 */
	amount: number;
}

export function makeAction(actorSeatIndex: number, type: ActionType, amount: number = 0): Action {
	return {
		actorSeatIndex,
		type,
		amount: Math.max(0, Math.trunc(amount)),
	};
}
