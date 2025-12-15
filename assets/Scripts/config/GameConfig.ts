export type AiDifficulty = 'easy' | 'normal' | 'hard';

export interface GameConfigData {
	startingStack: number;
	smallBlind: number;
	bigBlind: number;
	ante: number;
	burnCardEnabled: boolean;
	reopenOnShortAllinRaise: boolean;
	aiDifficulty: AiDifficulty;
	aiThinkTimeEnabled: boolean;
	aiThinkTimeMsMin: number;
	aiThinkTimeMsMax: number;
	animationSpeed: number;
	skipAnimations: boolean;
	debugSeedEnabled: boolean;
	debugSeed: number;
	logEnabled: boolean;
	schemaVersion: number;
}

export const GameConfig: Readonly<GameConfigData> = Object.freeze({
	startingStack: 1000,
	smallBlind: 5,
	bigBlind: 10,
	ante: 0,
	burnCardEnabled: true,
	reopenOnShortAllinRaise: false,
	aiDifficulty: 'normal',
	aiThinkTimeEnabled: true,
	aiThinkTimeMsMin: 300,
	aiThinkTimeMsMax: 1200,
	animationSpeed: 1,
	skipAnimations: false,
	debugSeedEnabled: false,
	debugSeed: 1,
	logEnabled: true,
	schemaVersion: 1,
});
