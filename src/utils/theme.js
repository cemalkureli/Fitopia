// LiftShift-inspired midnight-dark palette with Fitopia lime accent
export const C = {
  // Backgrounds (slate series — daha derin, "premium siyah" tonlar)
  bg:      '#060911',   // deepest — near-black premium base
  s1:      '#0c1220',   // surface 1 (kart zemini)
  s2:      '#161f30',   // surface 2
  s3:      '#26324a',   // surface 3
  // Borders — ince açık gri kenar (Apple-pill hissi, kartlara netlik verir)
  border:  '#2a3750',
  border2: '#3a4a68',
  // Brand accents
  lime:    '#e8f44a',   // Fitopia primary
  teal:    '#14b8a6',   // secondary accent
  blue:    '#38bdf8',   // info / pull
  purple:  '#a78bfa',
  green:   '#34d399',
  orange:  '#fb923c',
  red:     '#f87171',
  // Text
  text:    '#f1f5f9',
  muted:   '#94a3b8',
  dim:     '#475569',
};

export const DOT = {
  lime:   C.lime,
  teal:   C.teal,
  red:    C.red,
  blue:   C.blue,
  purple: C.purple,
  green:  C.green,
  orange: C.orange,
};

export const TAG_BG = {
  lime:   'rgba(232,244,74,0.12)',
  teal:   'rgba(20,184,166,0.12)',
  red:    'rgba(248,113,113,0.12)',
  blue:   'rgba(56,189,248,0.12)',
  purple: 'rgba(167,139,250,0.12)',
  green:  'rgba(52,211,153,0.12)',
  orange: 'rgba(251,146,60,0.12)',
};

// Font families (Sora — loaded in App.js via @expo-google-fonts/sora)
export const F = {
  thin:      'Sora_100Thin',
  extralight:'Sora_200ExtraLight',
  light:     'Sora_300Light',
  regular:   'Sora_400Regular',
  medium:    'Sora_500Medium',
  semibold:  'Sora_600SemiBold',
  bold:      'Sora_700Bold',
  extrabold: 'Sora_800ExtraBold',
};

// Gradient helpers
export const GRAD = {
  lime:  ['#e8f44a', '#a3c200'],
  teal:  ['#14b8a6', '#0d9488'],
  dark:  ['#0f172a', '#020617'],
  card:  ['#1e293b', '#0f172a'],
};
