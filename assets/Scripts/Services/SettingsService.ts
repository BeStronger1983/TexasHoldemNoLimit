import { sys } from 'cc';

import { GameConfig, type AiDifficulty } from '../Config/GameConfig';

export interface AudioSettings {
	bgmVolume: number; // 0..1
	sfxVolume: number; // 0..1
}

export interface GameplaySettings {
	startingStack: number;
	smallBlind: number;
	bigBlind: number;
	ante: number;
}

export interface AiSettings {
	difficulty: AiDifficulty;
	thinkTimeEnabled: boolean;
	thinkTimeMsMin: number;
	thinkTimeMsMax: number;
}

export interface SettingsDataV2 {
	schemaVersion: 2;
	audio: AudioSettings;
	gameplay: GameplaySettings;
	ai: AiSettings;
}

export type SettingsData = SettingsDataV2;

export interface IKeyValueStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

class SysLocalStorage implements IKeyValueStorage {
	getItem(key: string): string | null {
		return sys.localStorage.getItem(key);
	}
	setItem(key: string, value: string): void {
		sys.localStorage.setItem(key, value);
	}
	removeItem(key: string): void {
		sys.localStorage.removeItem(key);
	}
}

const STORAGE_KEY = 'TexasHoldemNoLimit.Settings';
const CURRENT_SCHEMA_VERSION = 2 as const;

function clamp01(value: number): number {
	if (!Number.isFinite(value)) return 1;
	return Math.max(0, Math.min(1, value));
}

function toSafeInt(value: unknown, fallback: number): number {
	if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return Math.trunc(parsed);
	}
	return fallback;
}

function toSafeBool(value: unknown, fallback: boolean): boolean {
	if (typeof value === 'boolean') return value;
	if (value === 0) return false;
	if (value === 1) return true;
	return fallback;
}

function isAiDifficulty(value: unknown): value is AiDifficulty {
	return value === 'easy' || value === 'normal' || value === 'hard';
}

function cloneDefaults(): SettingsData {
	// JSON clone is enough for this simple data.
	return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as SettingsData;
}

function sanitizeSettings(candidate: Partial<SettingsData> | null | undefined): SettingsData {
	const base = cloneDefaults();
	if (!candidate || typeof candidate !== 'object') return base;

	const anyCandidate = candidate as any;

	// audio
	if (anyCandidate.audio && typeof anyCandidate.audio === 'object') {
		base.audio.bgmVolume = clamp01(Number(anyCandidate.audio.bgmVolume));
		base.audio.sfxVolume = clamp01(Number(anyCandidate.audio.sfxVolume));
	}

	// gameplay
	if (anyCandidate.gameplay && typeof anyCandidate.gameplay === 'object') {
		const startingStack = Math.max(1, toSafeInt(anyCandidate.gameplay.startingStack, base.gameplay.startingStack));
		const smallBlind = Math.max(0, toSafeInt(anyCandidate.gameplay.smallBlind, base.gameplay.smallBlind));
		const bigBlind = Math.max(0, toSafeInt(anyCandidate.gameplay.bigBlind, base.gameplay.bigBlind));
		const ante = Math.max(0, toSafeInt(anyCandidate.gameplay.ante, base.gameplay.ante));

		base.gameplay.startingStack = startingStack;
		base.gameplay.smallBlind = smallBlind;
		base.gameplay.bigBlind = Math.max(bigBlind, smallBlind);
		base.gameplay.ante = ante;
	}

	// ai
	if (anyCandidate.ai && typeof anyCandidate.ai === 'object') {
		base.ai.difficulty = isAiDifficulty(anyCandidate.ai.difficulty) ? anyCandidate.ai.difficulty : base.ai.difficulty;
		base.ai.thinkTimeEnabled = toSafeBool(anyCandidate.ai.thinkTimeEnabled, base.ai.thinkTimeEnabled);
		base.ai.thinkTimeMsMin = Math.max(0, toSafeInt(anyCandidate.ai.thinkTimeMsMin, base.ai.thinkTimeMsMin));
		base.ai.thinkTimeMsMax = Math.max(0, toSafeInt(anyCandidate.ai.thinkTimeMsMax, base.ai.thinkTimeMsMax));
		if (base.ai.thinkTimeMsMax < base.ai.thinkTimeMsMin) {
			const tmp = base.ai.thinkTimeMsMax;
			base.ai.thinkTimeMsMax = base.ai.thinkTimeMsMin;
			base.ai.thinkTimeMsMin = tmp;
		}
	}

	return base;
}

function migrateV1ToV2(raw: any): Partial<SettingsDataV2> {
	// Drop all legacy debug/seed fields.
	return {
		audio: raw?.audio,
		gameplay: raw?.gameplay,
		ai: raw?.ai,
	} as Partial<SettingsDataV2>;
}

const DEFAULT_SETTINGS: SettingsData = {
	schemaVersion: 2,
	audio: {
		bgmVolume: 1,
		sfxVolume: 1,
	},
	gameplay: {
		startingStack: GameConfig.startingStack,
		smallBlind: GameConfig.smallBlind,
		bigBlind: GameConfig.bigBlind,
		ante: GameConfig.ante,
	},
	ai: {
		difficulty: GameConfig.aiDifficulty,
		thinkTimeEnabled: GameConfig.aiThinkTimeEnabled,
		thinkTimeMsMin: GameConfig.aiThinkTimeMsMin,
		thinkTimeMsMax: GameConfig.aiThinkTimeMsMax,
	},
};

export class SettingsService {
	readonly storageKey: string;
	private readonly storage: IKeyValueStorage;

	constructor(storage: IKeyValueStorage = new SysLocalStorage(), storageKey: string = STORAGE_KEY) {
		this.storage = storage;
		this.storageKey = storageKey;
	}

	getDefaults(): SettingsData {
		return cloneDefaults();
	}

	load(): SettingsData {
		const raw = this.storage.getItem(this.storageKey);
		if (!raw) return this.getDefaults();

		try {
			const parsed = JSON.parse(raw) as any;
			const schemaVersion = toSafeInt(parsed?.schemaVersion, 0);

			if (schemaVersion === CURRENT_SCHEMA_VERSION) {
				return sanitizeSettings(parsed as Partial<SettingsData>);
			}

			// Migrate legacy schemaVersion=1 by dropping debug/seed fields.
			if (schemaVersion === 1) {
				const migrated = sanitizeSettings(migrateV1ToV2(parsed));
				this.save(migrated);
				return migrated;
			}

			// Unknown version -> reset.
			return this.reset();
		} catch {
			return this.reset();
		}
	}

	save(settings: SettingsData): void {
		const toStore: SettingsData = {
			...sanitizeSettings(settings),
			schemaVersion: CURRENT_SCHEMA_VERSION,
		};
		this.storage.setItem(this.storageKey, JSON.stringify(toStore));
	}

	reset(): SettingsData {
		const defaults = this.getDefaults();
		defaults.schemaVersion = CURRENT_SCHEMA_VERSION;
		this.storage.removeItem(this.storageKey);
		this.storage.setItem(this.storageKey, JSON.stringify(defaults));
		return defaults;
	}

	updateAudio(patch: Partial<AudioSettings>): SettingsData {
		const current = this.load();
		const next: SettingsData = {
			...current,
			audio: {
				...current.audio,
				...patch,
			},
		};
		this.save(next);
		return this.load();
	}

	updateGameplay(patch: Partial<GameplaySettings>): SettingsData {
		const current = this.load();
		const next: SettingsData = {
			...current,
			gameplay: {
				...current.gameplay,
				...patch,
			},
		};
		this.save(next);
		return this.load();
	}

	updateAi(patch: Partial<AiSettings>): SettingsData {
		const current = this.load();
		const next: SettingsData = {
			...current,
			ai: {
				...current.ai,
				...patch,
			},
		};
		this.save(next);
		return this.load();
	}
}

export const settingsService = new SettingsService();
