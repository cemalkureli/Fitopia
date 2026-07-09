/**
 * exercises.js — Uygulamanın TEK egzersiz veri kaynağı (1324 egzersiz).
 * Kaynak: hasaneyldrm/exercises-dataset (veri: MIT). Medya (GIF + thumbnail):
 * © Gym Visual — https://gymvisual.com/ (180×180, atıf zorunlu). Medya jsDelivr
 * CDN'inden çekilir; uygulama şişmez. Eski Supabase `exercises` tablosu, webm
 * oynatıcı ve mascot PNG'lerinin yerini alır.
 */
import RAW from './exercises.json';

const CDN = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main';
export const MEDIA_ATTRIBUTION = '© Gym Visual — gymvisual.com';

export const gifUrl   = (m) => `${CDN}/videos/${m}.gif`;
export const thumbUrl = (m) => `${CDN}/images/${m}.jpg`;

export const EXERCISES = RAW;

// ── Kategori (body_part) ──────────────────────────────────────────────────────
export const CATEGORIES = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'neck'];
export const CAT_LABEL = {
  chest:     { tr: 'Göğüs',  en: 'Chest' },
  back:      { tr: 'Sırt',   en: 'Back' },
  shoulders: { tr: 'Omuz',   en: 'Shoulders' },
  arms:      { tr: 'Kol',    en: 'Arms' },
  legs:      { tr: 'Bacak',  en: 'Legs' },
  core:      { tr: 'Karın',  en: 'Core' },
  cardio:    { tr: 'Kardio', en: 'Cardio' },
  neck:      { tr: 'Boyun',  en: 'Neck' },
};
export const CAT_ICON = {
  chest: 'body-outline', back: 'accessibility-outline', shoulders: 'barbell-outline',
  arms: 'fitness-outline', legs: 'walk-outline', core: 'ellipse-outline',
  cardio: 'heart-outline', neck: 'person-outline',
};
export const CAT_COLOR = {
  chest: '#ef4444', back: '#3b82f6', shoulders: '#a855f7', arms: '#06b6d4',
  legs: '#38bdf8', core: '#84cc16', cardio: '#f43f5e', neck: '#94a3b8',
};

// ── Kas (muscle_group slug — BodyMap ile ortak) ───────────────────────────────
export const MUSCLE_LABEL = {
  chest:        { tr: 'Göğüs',      en: 'Chest' },
  deltoids:     { tr: 'Omuz',       en: 'Shoulders' },
  biceps:       { tr: 'Biseps',     en: 'Biceps' },
  triceps:      { tr: 'Triseps',    en: 'Triceps' },
  forearm:      { tr: 'Önkol',      en: 'Forearms' },
  abs:          { tr: 'Karın',      en: 'Abs' },
  obliques:     { tr: 'Yan Karın',  en: 'Obliques' },
  quadriceps:   { tr: 'Kuadriseps', en: 'Quads' },
  hamstring:    { tr: 'Hamstring',  en: 'Hamstrings' },
  gluteal:      { tr: 'Kalça',      en: 'Glutes' },
  calves:       { tr: 'Baldır',     en: 'Calves' },
  trapezius:    { tr: 'Trapez',     en: 'Traps' },
  'upper-back': { tr: 'Sırt',       en: 'Upper Back' },
  'lower-back': { tr: 'Alt Sırt',   en: 'Lower Back' },
  adductors:    { tr: 'İç Bacak',   en: 'Adductors' },
};
export const MUSCLE_COLOR = {
  chest: '#ef4444', deltoids: '#f97316', biceps: '#06b6d4', triceps: '#8b5cf6',
  forearm: '#818cf8', abs: '#4ade80', obliques: '#84cc16', quadriceps: '#38bdf8',
  hamstring: '#0ea5e9', gluteal: '#fb923c', calves: '#7dd3fc', trapezius: '#e879f9',
  'upper-back': '#f43f5e', 'lower-back': '#a855f7', adductors: '#22d3ee',
};

// ── Ekipman ───────────────────────────────────────────────────────────────────
// En sık kullanılan ekipmanlar filtre için (geri kalanı "diğer"e düşer).
export const EQUIPMENTS = [
  'body weight', 'dumbbell', 'barbell', 'cable', 'machine', 'kettlebell', 'band', 'other',
];
export const EQUIP_LABEL = {
  'body weight': { tr: 'Vücut Ağırlığı', en: 'Body Weight' },
  dumbbell:      { tr: 'Dambıl',          en: 'Dumbbell' },
  barbell:       { tr: 'Halter',          en: 'Barbell' },
  cable:         { tr: 'Kablo',           en: 'Cable' },
  machine:       { tr: 'Makine',          en: 'Machine' },
  kettlebell:    { tr: 'Kettlebell',      en: 'Kettlebell' },
  band:          { tr: 'Direnç Bandı',    en: 'Band' },
  other:         { tr: 'Diğer',           en: 'Other' },
};
export const EQUIP_ICON = {
  'body weight': 'body-outline', dumbbell: 'barbell-outline', barbell: 'barbell',
  cable: 'git-commit-outline', machine: 'construct-outline', kettlebell: 'fitness-outline',
  band: 'infinite-outline', other: 'ellipsis-horizontal',
};
// Ham ekipman → filtre grubu
export function equipGroup(raw) {
  const e = (raw || '').toLowerCase();
  if (e === 'body weight' || e === 'assisted' || e === 'weighted') return 'body weight';
  if (e.includes('dumbbell')) return 'dumbbell';
  if (e.includes('barbell') || e === 'trap bar' || e === 'hammer') return 'barbell';
  if (e === 'cable') return 'cable';
  if (e.includes('machine') || e === 'smith machine') return 'machine';
  if (e === 'kettlebell') return 'kettlebell';
  if (e.includes('band')) return 'band';
  return 'other';
}

// ── BodyMap slug → egzersiz filtre yüklemi ────────────────────────────────────
// Büyük bölgeler kategoriden, kol/bacak/kaslar muscle alanından eşlenir.
export const BODY_SLUG_FILTER = {
  chest:        { kind: 'cat',    value: 'chest' },
  deltoids:     { kind: 'cat',    value: 'shoulders' },
  'upper-back': { kind: 'cat',    value: 'back' },
  abs:          { kind: 'cat',    value: 'core' },
  obliques:     { kind: 'muscle', value: 'obliques' },
  biceps:       { kind: 'muscle', value: 'biceps' },
  triceps:      { kind: 'muscle', value: 'triceps' },
  forearm:      { kind: 'muscle', value: 'forearm' },
  quadriceps:   { kind: 'muscle', value: 'quadriceps' },
  hamstring:    { kind: 'muscle', value: 'hamstring' },
  gluteal:      { kind: 'muscle', value: 'gluteal' },
  calves:       { kind: 'muscle', value: 'calves' },
  adductors:    { kind: 'cat',    value: 'legs' },
  trapezius:    { kind: 'muscle', value: 'trapezius' },
  'lower-back': { kind: 'muscle', value: 'lower-back' },
};

// ── Sorgu yardımcıları ────────────────────────────────────────────────────────
export function filterExercises({ search = '', cat = '', muscle = '', equip = '' } = {}) {
  const q = search.trim().toLowerCase();
  return EXERCISES.filter(e => {
    if (cat && e.cat !== cat) return false;
    if (muscle && e.muscle !== muscle) return false;
    if (equip && equipGroup(e.equip) !== equip) return false;
    if (q && !e.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

export const getById = (id) => EXERCISES.find(e => e.id === id) || null;
export const getByName = (name) => EXERCISES.find(e => e.name === name) || null;

// Egzersiz kaydını görsel/etiketlerle zenginleştir (UI kolaylığı)
export function decorate(e, lang = 'tr') {
  if (!e) return null;
  return {
    ...e,
    thumb: thumbUrl(e.m),
    gif:   gifUrl(e.m),
    catLabel:    CAT_LABEL[e.cat]?.[lang] ?? e.cat,
    catColor:    CAT_COLOR[e.cat] ?? '#94a3b8',
    muscleLabel: MUSCLE_LABEL[e.muscle]?.[lang] ?? e.target ?? '',
    steps:       (lang === 'en' ? e.se : e.st) ?? [],
    instr:       (lang === 'en' ? e.ie : e.it) ?? '',
  };
}
