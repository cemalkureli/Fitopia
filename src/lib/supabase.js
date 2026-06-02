import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? Constants.expoConfig?.extra?.supabaseUrl      ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? Constants.expoConfig?.extra?.supabaseAnonKey  ?? '';

// AsyncStorage: boyut sınırı yok, cross-platform güvenilir, oturum kalıcı
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,   // uygulama kapansa da oturum açık kalır
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
