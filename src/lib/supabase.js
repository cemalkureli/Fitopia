import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const SUPABASE_URL      = Constants.expoConfig?.extra?.supabaseUrl      ?? '';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey  ?? '';

// SecureStore max 2048 byte — JWT token daha uzun olabileceği için parçalara böl
const CHUNK = 1800;

const SecureStorage = {
  async getItem(key) {
    try {
      const n = await SecureStore.getItemAsync(`${key}__n`);
      if (n === null) return SecureStore.getItemAsync(key);
      const parts = await Promise.all(
        Array.from({ length: parseInt(n) }, (_, i) => SecureStore.getItemAsync(`${key}__${i}`))
      );
      return parts.every(p => p !== null) ? parts.join('') : null;
    } catch { return null; }
  },
  async setItem(key, value) {
    try {
      if (value.length <= CHUNK) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
      const chunks = [];
      for (let i = 0; i < value.length; i += CHUNK) chunks.push(value.slice(i, i + CHUNK));
      await SecureStore.setItemAsync(`${key}__n`, String(chunks.length));
      await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}__${i}`, c)));
    } catch {}
  },
  async removeItem(key) {
    try {
      const n = await SecureStore.getItemAsync(`${key}__n`);
      if (n !== null) {
        await Promise.all(
          Array.from({ length: parseInt(n) }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`))
        );
        await SecureStore.deleteItemAsync(`${key}__n`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:          SecureStorage,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});

// ─── Auth helpers ──────────────────────────────────────────────────────────────
export async function signUp({ email, password, fullName }) {
  const clean = email.trim().toLowerCase();
  if (!clean || !password || password.length < 6) throw new Error('Geçersiz giriş bilgileri.');
  const { data, error } = await supabase.auth.signUp({
    email: clean, password,
    options: { data: { full_name: fullName?.trim() } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(), password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { error } = await supabase
    .from('profiles').upsert({ id: userId, ...updates });
  if (error) throw error;
}
