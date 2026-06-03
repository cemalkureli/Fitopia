# Fitopia

Fitopia is a React Native fitness tracking app built with Expo — workout logging, exercise library, training plans, progress tracking, and an interactive muscle-map mascot. Backend: Supabase.

## Stack

| Layer | Tech |
|---|---|
| Framework | React Native + Expo SDK 52 |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| Navigation | React Navigation v6 (Bottom Tabs) |
| Animations | React Native Reanimated v3 |
| Storage | AsyncStorage (session + workout logs) |
| Video | expo-video (WebM VP9) |
| Icons | @expo/vector-icons (Ionicons) |
| i18n | Custom t() system — TR / EN |

## Features

- **Auth** — Email/password, session persisted via AsyncStorage (auto-login)
- **Home** — Active program today card, weekly activity, workout stats
- **Workouts** — Custom workout builder, exercise picker, per-exercise set/rep/RIR logging
- **Exercises** — Library with filters, WebM video previews, community rating
- **Templates** — Training plan templates (bilingual), drag-to-day builder, set-as-active
- **Progress** — Mascot with interactive muscle zones → navigate to exercises, measurements, overload charts
- **Profile** — Avatar, body stats, gender, units (kg/lb, cm/in), language toggle

## Setup

### 1. Clone & install

```bash
git clone https://github.com/cemalkureli/Fitopia.git
cd Fitopia
npm install
```

### 2. Environment

Create `.env` in project root:
```
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### 3. Start

```bash
npx expo start --android
```

## Project Structure

```
src/
├── lib/supabase.js          # Supabase client (AsyncStorage session)
├── context/
│   ├── LanguageContext.js   # TR/EN language provider
│   ├── UnitsContext.js      # kg/lb, cm/in
│   └── MuscleFilterContext.js # Mascot → exercises filter bridge
├── screens/
│   ├── auth/LoginScreen.js
│   ├── auth/RegisterScreen.js
│   ├── HomeScreen.js        # Dashboard + active program
│   ├── ExercisesScreen.js   # 3-tab: Library / Workouts / Templates
│   ├── ProgramScreen.js     # Active program day cards + logging
│   ├── ProgressScreen.js    # Mascot, measurements, overload
│   └── ProfileScreen.js     # User settings
├── components/
│   ├── MascotFlipCard.js    # Interactive muscle zones (tap → exercises)
│   └── ExerciseMedia.js     # expo-video WebM player
├── data/
│   ├── trainingPlans.js     # Static template plans (TR+EN)
│   └── zoneData.js          # Muscle zone lookup tables (auto-generated)
└── utils/
    ├── cache.js             # Stale-while-revalidate cache (mem + AsyncStorage)
    ├── i18n.js              # Translation keys TR/EN
    ├── storage.js           # AsyncStorage helpers
    └── theme.js             # Color palette
assets/
├── mascot_male/             # front.png, back.png + zone masks
├── mascot_female/           # front.png, back.png + zone masks
└── zones/                   # Per-muscle overlay PNGs (auto-generated)
scripts/
├── process_assets.js        # Generates zone lookup tables from mask images
└── comfyui_muscle_prompts.txt # ComfyUI prompts for muscle overlays
```

## License

Private — All rights reserved © Cemal Kureli
