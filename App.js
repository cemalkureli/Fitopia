import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { View, Text, StatusBar, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Sora_100Thin, Sora_200ExtraLight, Sora_300Light, Sora_400Regular,
  Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold,
} from '@expo-google-fonts/sora';

import { C, F } from './src/utils/theme';
import { supabase } from './src/lib/supabase';
import { LanguageProvider, useLang } from './src/context/LanguageContext';
import { LanguageSheetProvider } from './src/context/LanguageSheetContext';
import { UnitsProvider } from './src/context/UnitsContext';
import { MuscleFilterProvider } from './src/context/MuscleFilterContext';
import { t } from './src/utils/i18n';

import LoginScreen    from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import HomeScreen     from './src/screens/HomeScreen';
import ProgramScreen  from './src/screens/ProgramScreen';
import ExercisesScreen from './src/screens/ExercisesScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ProfileScreen  from './src/screens/ProfileScreen';
import AICoachScreen  from './src/screens/AICoachScreen';

SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    card:       C.s1,
    text:       C.text,
    border:     C.border,
    primary:    C.lime,
  },
};

const TAB_ICONS = {
  Ana:        { focused: 'home',        outline: 'home-outline' },
  Program:    { focused: 'barbell',     outline: 'barbell-outline' },
  Egzersizler:{ focused: 'fitness',     outline: 'fitness-outline' },
  İlerleme:   { focused: 'trending-up', outline: 'trending-up-outline' },
  Koç:        { focused: 'medal',       outline: 'medal-outline' },
  Profil:     { focused: 'person',      outline: 'person-outline' },
};

// ─── Üst başlık ───────────────────────────────────────────────────────────────
function Header() {
  const [now, setNow] = useState(new Date());
  const { lang } = useLang();
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const days_tr   = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
  const days_en   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months_tr = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const months_en = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const h   = String(now.getHours()).padStart(2,'0');
  const m   = String(now.getMinutes()).padStart(2,'0');
  const sec = String(now.getSeconds()).padStart(2,'0');
  const dayStr = lang === 'tr'
    ? `${days_tr[now.getDay()]}, ${now.getDate()} ${months_tr[now.getMonth()]}`
    : `${days_en[now.getDay()]}, ${months_en[now.getMonth()]} ${now.getDate()}`;
  return (
    <View style={{
      flexDirection:'row', alignItems:'center', justifyContent:'space-between',
      paddingHorizontal:16, paddingVertical:10,
      backgroundColor:C.bg, borderBottomWidth:1, borderBottomColor:C.border,
    }}>
      <Text style={{ color:C.lime, fontSize:20, fontFamily:F.extrabold, letterSpacing:1 }}>
        FITO<Text style={{ color:C.muted }}>/PIA</Text>
      </Text>
      <View style={{ alignItems:'flex-end' }}>
        <Text style={{ color:C.text, fontSize:16, fontFamily:F.bold, letterSpacing:0.5 }}>
          {h}:{m}<Text style={{ color:C.muted, fontSize:11, fontFamily:F.medium }}>:{sec}</Text>
        </Text>
        <Text style={{ color:C.muted, fontSize:10, fontFamily:F.medium }}>{dayStr}</Text>
      </View>
    </View>
  );
}

// ─── Özel Tab Bar — yüzen cam/glassy pill (Apple Fitness tarzı) ──────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[tb.outer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={tb.pill}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label   = options.tabBarLabel ?? route.name;
          const focused = state.index === index;
          const icons   = TAB_ICONS[route.name];
          const color   = focused ? C.lime : C.muted;

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.8}
              onPress={() => { if (!focused) navigation.navigate(route.name); }}
              style={tb.tab}
            >
              <View style={[tb.item, focused && tb.itemActive]}>
                {focused && (
                  <Animated.View entering={FadeIn.duration(180)} style={tb.activeBg} pointerEvents="none" />
                )}
                <Ionicons name={focused ? icons?.focused : icons?.outline} size={20} color={color} />
                <Text numberOfLines={1} style={[tb.label, { color }]}>{label.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  outer:      { backgroundColor: C.bg, paddingHorizontal: 12, paddingTop: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(18,25,42,0.92)', borderRadius: 26,
    borderWidth: 1, borderColor: 'rgba(148,170,214,0.22)',
    paddingVertical: 7, paddingHorizontal: 6,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  tab:        { flex: 1 },
  item:       { alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 7, borderRadius: 16, position: 'relative' },
  itemActive: {},
  activeBg:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(232,244,74,0.13)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(232,244,74,0.28)' },
  label:      { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.2 },
});

// ─── Ana Sekmeler ──────────────────────────────────────────────────────────────
function MainTabs({ onSignOut }) {
  const { lang } = useLang();
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }} edges={['top']}>
      <Header />
      <Tab.Navigator
        tabBar={props => <CustomTabBar {...props} lang={lang} />}
        screenOptions={{ headerShown:false }}
      >
        <Tab.Screen name="Ana"         component={HomeScreen}     options={{ tabBarLabel: t('tabHome', lang) }} />
        <Tab.Screen name="Program"     component={ProgramScreen}  options={{ tabBarLabel: lang === 'tr' ? 'WORKOUTS' : 'WORKOUTS' }} />
        <Tab.Screen name="Egzersizler" component={ExercisesScreen}options={{ tabBarLabel: t('tabExercises', lang) }} />
        <Tab.Screen name="İlerleme"    component={ProgressScreen} options={{ tabBarLabel: t('tabProgress', lang) }} />
        <Tab.Screen name="Koç"         component={AICoachScreen}  options={{ tabBarLabel: lang === 'tr' ? 'KOÇ' : 'COACH' }} />
        <Tab.Screen name="Profil"      options={{ tabBarLabel: t('tabProfile', lang) }}>
          {() => <ProfileScreen onSignOut={onSignOut} />}
        </Tab.Screen>
      </Tab.Navigator>
    </SafeAreaView>
  );
}

// ─── Kök bileşen ─────────────────────────────────────────────────────────────
export default function App() {
  const [session,   setSession]   = useState(undefined); // undefined = loading
  const [authMode,  setAuthMode]  = useState('login');   // 'login' | 'register'
  const [skipAuth,  setSkipAuth]  = useState(false);

  const [fontsLoaded] = useFonts({
    Sora_100Thin, Sora_200ExtraLight, Sora_300Light, Sora_400Regular,
    Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold,
  });

  useEffect(() => {
    // Mevcut oturumu kontrol et
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      SplashScreen.hideAsync();
    });

    // Auth değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Supabase henüz yapılandırılmamışsa (placeholder URL) direkt uygulamaya geç
  const isSupabaseConfigured = !!(
    typeof process !== 'undefined'
      ? true
      : false
  );

  const handleSignOut = () => {
    setSession(null);
    setAuthMode('login');
  };

  return (
    <LanguageProvider>
      <UnitsProvider>
        <MuscleFilterProvider>
          <SafeAreaProvider>
            <LanguageSheetProvider>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />

        {(session === undefined || !fontsLoaded) ? (
          <View style={{ flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center' }}>
            <Text style={{ color:C.lime, fontSize:30, fontFamily:F.extrabold, letterSpacing:3 }}>
              FITO<Text style={{ color:C.muted }}>/PIA</Text>
            </Text>
          </View>
        ) : session ? (
          <NavigationContainer theme={navTheme}>
            <MainTabs onSignOut={handleSignOut} />
          </NavigationContainer>
        ) : (
          <SafeAreaView style={{ flex:1, backgroundColor:C.bg }} edges={['top','bottom']}>
            {authMode === 'login' ? (
              <LoginScreen
                onSuccess={() => {}}
                onGoRegister={() => setAuthMode('register')}
              />
            ) : (
              <RegisterScreen
                onSuccess={() => setAuthMode('login')}
                onGoLogin={() => setAuthMode('login')}
              />
            )}
          </SafeAreaView>
        )}
            </LanguageSheetProvider>
          </SafeAreaProvider>
        </MuscleFilterProvider>
      </UnitsProvider>
    </LanguageProvider>
  );
}
