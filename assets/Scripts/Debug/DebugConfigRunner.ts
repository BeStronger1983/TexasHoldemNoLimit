import { _decorator, Component } from 'cc';

import { GameConfig } from '../Config/GameConfig';
import { settingsService } from '../Services/SettingsService';

const { ccclass } = _decorator;

@ccclass('DebugConfigRunner')
export class DebugConfigRunner extends Component {
	start(): void {
		const seedLabel = GameConfig.debugSeedEnabled ? String(GameConfig.debugSeed) : 'disabled';
		console.log(`[TEST] T0.0 seed=${seedLabel} schemaVersion=${GameConfig.schemaVersion}`);
		console.log('[DebugConfigRunner] GameConfig=', GameConfig);

		console.log(`[DebugConfigRunner] SettingsService storageKey=${settingsService.storageKey}`);
		const loaded = settingsService.load();
		console.log('[DebugConfigRunner] Settings loaded=', loaded);
	}
}
