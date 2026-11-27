import { openDB } from 'idb';
import { DEFAULT_SETTINGS, samples, type Reading, type Settings } from './model';

const database = () => openDB('origin-reader-v2', 1, { upgrade(db) { db.createObjectStore('readings', { keyPath: 'id' }); db.createObjectStore('preferences'); } });
export async function loadLibrary(): Promise<Reading[]> {
  const db = await database();
  if (!await db.get('preferences', 'initialized')) {
    const tx = db.transaction(['readings', 'preferences'], 'readwrite');
    for (const reading of samples) await tx.objectStore('readings').put(reading);
    await tx.objectStore('preferences').put(true, 'initialized');
    await tx.done;
  }
  return db.getAll('readings');
}
export async function saveReading(reading: Reading) { await (await database()).put('readings', reading); }
export async function deleteReading(id: string) { await (await database()).delete('readings', id); }
export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem('origin-reader-settings') || '{}');
    return {
      words: Math.max(1, Math.min(12, Number(s.words) || DEFAULT_SETTINGS.words)),
      fontSize: Math.max(24, Math.min(64, Number(s.fontSize) || DEFAULT_SETTINGS.fontSize)),
      wpm: Math.max(60, Math.min(600, Number(s.wpm) || DEFAULT_SETTINGS.wpm)),
      font: s.font === 'sans' ? 'sans' : 'serif',
      theme: ['light', 'dark', 'system'].includes(s.theme) ? s.theme : 'light',
    };
  } catch { return DEFAULT_SETTINGS; }
}
export function saveSettings(s: Settings) { localStorage.setItem('origin-reader-settings', JSON.stringify(s)); }
