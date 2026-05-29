export default {
  expo: {
    name: 'Fitopia',
    slug: 'fitopia',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/os.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    splash: { image: './assets/splash.png', backgroundColor: '#07080b', resizeMode: 'contain' },
    android: {
      package: 'com.fitopia.app',
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#07080b' },
    },
    ios: { bundleIdentifier: 'com.fitopia.app' },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
