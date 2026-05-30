/**
 * Lightweight in-memory + AsyncStorage cache layer.
 * Stale-while-revalidate: returns cached data instantly,
 * then re-fetches in background if TTL expired.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory store (survives tab switches, cleared on app kill)
const mem = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 min default

export async function cacheGet(key) {
  // 1. Check memory first (fastest)
  const m = mem.get(key);
  if (m && Date.now() < m.exp) return { data: m.data, stale: false };

  // 2. Check AsyncStorage (survives navigation)
  try {
    const raw = await AsyncStorage.getItem(`fc_${key}`);
    if (raw) {
      const { data, exp } = JSON.parse(raw);
      const stale = Date.now() > exp;
      mem.set(key, { data, exp }); // warm memory
      return { data, stale };
    }
  } catch {}
  return null;
}

export async function cacheSet(key, data, ttl = DEFAULT_TTL) {
  const exp = Date.now() + ttl;
  mem.set(key, { data, exp });
  try {
    await AsyncStorage.setItem(`fc_${key}`, JSON.stringify({ data, exp }));
  } catch {}
}

export function cacheClear(key) {
  mem.delete(key);
  AsyncStorage.removeItem(`fc_${key}`).catch(() => {});
}

export function cacheClearAll() {
  mem.clear();
}

// TTL constants
export const TTL = {
  EXERCISES:  60 * 60 * 1000,  // 1 hour — rarely changes
  RATINGS:     5 * 60 * 1000,  // 5 min
  PROFILE:    10 * 60 * 1000,  // 10 min
  WORKOUTS:    2 * 60 * 1000,  // 2 min
};
