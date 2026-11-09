import { StorageSchemaV1 } from '../domain/types';
import { createDefaultStorageState, migrateStorageData } from './migrations';

export const STORAGE_KEY = 'habits_garden_storage_v1';

export function loadStorageState(): StorageSchemaV1 {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultStorageState();
  }
  try {
    const rawText = window.localStorage.getItem(STORAGE_KEY);
    if (!rawText) {
      return createDefaultStorageState();
    }
    const parsed = JSON.parse(rawText);
    return migrateStorageData(parsed);
  } catch {
    return createDefaultStorageState();
  }
}

export function saveStorageState(state: StorageSchemaV1): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const payload: StorageSchemaV1 = {
      ...state,
      version: 1,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Игнорируем ошибки квоты localStorage в приватном режиме
  }
}

export function cloneStorageState(state: StorageSchemaV1): StorageSchemaV1 {
  return JSON.parse(JSON.stringify(state)) as StorageSchemaV1;
}
