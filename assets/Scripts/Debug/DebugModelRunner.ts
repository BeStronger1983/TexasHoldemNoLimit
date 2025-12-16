import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';
import { Deck } from '../Model/Deck';
import { ActionType, makeAction } from '../Model/Action';
import { GameEventType, makeEvent } from '../Model/GameEvent';
import { Player } from '../Model/Player';
import { Table } from '../Model/Table';
import { SecureRng } from '../Services/Rng/SecureRng';

const { ccclass } = _decorator;

@ccclass('DebugModelRunner')
export class DebugModelRunner extends Component {
	start(): void {
		console.log(`[TEST] T1.2.DebugModel schemaVersion=${GameConfig.schemaVersion}`);

		// Deck / shuffle / draw
		const rng = new SecureRng();
		const deck = new Deck();
		deck.shuffle(rng);
		const first10 = deck.draw(10);
		console.log('[DebugModelRunner] Shuffled deck draw(10)=', first10.map((c) => c.toShortString()).join(','));
		console.log('[DebugModelRunner] Deck remaining=', deck.count);

		// Players / table seats
		const table = new Table({ maxSeats: 9 });
		const p0 = new Player({ id: 'P0', name: 'You', isHuman: true, stack: 1000 });
		const p1 = new Player({ id: 'P1', name: 'Bot-1', isHuman: false, stack: 1000 });
		const p2 = new Player({ id: 'P2', name: 'Bot-2', isHuman: false, stack: 1000 });
		table.setSeat(0, p0);
		table.setSeat(3, p1);
		table.setSeat(7, p2);

		console.log('[DebugModelRunner] Table init street=', table.street);
		console.log('[DebugModelRunner] Occupied seats=', table.getOccupiedSeatIndices().join(','));
		for (let i = 0; i < table.maxSeats; i++) {
			const seat = table.getSeat(i);
			if (!seat) {
				console.log(`[DebugModelRunner] Seat ${i}: <empty>`);
				continue;
			}
			console.log(`[DebugModelRunner] Seat ${i}: name=${seat.name} isHuman=${seat.isHuman} status=${seat.status} stack=${seat.stack}`);
		}

		// Action / GameEvent (sample)
		const sampleAction = makeAction(0, ActionType.Call, 10);
		console.log('[DebugModelRunner] Sample Action=', sampleAction);

		const sampleEvent = makeEvent(
			GameEventType.PlayerAction,
			`Seat ${sampleAction.actorSeatIndex} ${sampleAction.type} amount=${sampleAction.amount}`,
			{ action: sampleAction },
		);
		console.log('[DebugModelRunner] Sample GameEvent=', sampleEvent);
	}
}
