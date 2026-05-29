# Fitopia

Fitopia is a React Native fitness tracking app built with Expo, featuring workout logging, exercise library, and progress tracking — backed by Supabase.

## Stack

| Layer | Tech |
|---|---|
| Framework | React Native + Expo SDK 52 |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| Navigation | React Navigation v6 (Bottom Tabs) |
| Animations | React Native Reanimated v3 |
| Storage | expo-secure-store (auth tokens), AsyncStorage (workout logs) |
| Video | expo-video (WebM VP9) |
| Icons | @expo/vector-icons (Ionicons) |

## Features

- **Auth** — Email/password login & register, JWT stored securely
- **Home** — Weekly activity tracker, workout stats, recent sessions
- **Program** — 7-day split program (Push/Pull/Leg), collapsible cards, set logging
- **Exercises** — 298-exercise library with WebM video previews, category filter, search
- **Progress** — Per-exercise history, PR tracking, mini volume charts
- **Profile** — Avatar upload (Supabase Storage), body stats, settings

## Setup

### 1. Clone

```bash
git clone https://github.com/cemalkureli/Fitopia.git
cd Fitopia
npm install
```

### 2. Supabase

Create a project at [supabase.com](https://supabase.com) and run the SQL in `src/lib/supabase.js` (see comment block at the bottom).

Update `app.config.js`:
```js
supabaseUrl: 'YOUR_SUPABASE_URL',
supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
```

### 3. Exercise Videos

Convert GIFs to WebM (requires ffmpeg):
```bash
# Run from project root
Get-ChildItem "path/to/gifs" -Filter "*.gif" | ForEach-Object {
  ffmpeg -i $_.FullName -c:v libvpx-vp9 -crf 33 -b:v 0 -loop 0 -an "assets/exercises/$($_.BaseName).webm" -y
}
```

### 4. Start

```bash
npx expo start --android
```

## Project Structure

```
src/
├── lib/
│   └── supabase.js        # Supabase client + auth helpers
├── navigation/            # (embedded in App.js)
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.js
│   │   └── RegisterScreen.js
│   ├── HomeScreen.js      # Dashboard
│   ├── ProgramScreen.js   # Weekly workout program
│   ├── ExercisesScreen.js # Exercise library
│   ├── ProgressScreen.js  # PR & history tracking
│   └── ProfileScreen.js   # User profile + avatar
├── components/
│   └── ExerciseMedia.js   # expo-video WebM player
└── utils/
    ├── theme.js            # Color palette
    └── storage.js          # AsyncStorage helpers
```

## Supabase Schema

```sql
-- profiles table (auto-populated via trigger on auth.users insert)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text, email text, weight numeric,
  height numeric, goal text, avatar_url text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;

-- Storage: avatars bucket (public read, owner write)
```

## License

Private — All rights reserved © Cemal Kureli
