import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { View, Text, StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

import { C } from './src/utils/theme';
import { supabase } from './src/lib/supabase';

import LoginScreen    from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import HomeScreen     from './src/screens/HomeScreen';
import ProgramScreen  from './src/screens/ProgramScreen';
import ExercisesScreen from './src/screens/ExercisesScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ProfileScreen  from './src/screens/ProfileScreen';

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
  Profil:     { focused: 'person',      outline: 'person-outline' },
};

// ─── Üst başlık ───────────────────────────────────────────────────────────────
function Header() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const days   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const h   = String(now.getHours()).padStart(2,'0');
  const m   = String(now.getMinutes()).padStart(2,'0');
  const sec = String(now.getSeconds()).padStart(2,'0');
  return (
    <View style={{
      flexDirection:'row', alignItems:'center', justifyContent:'space-between',
      paddingHorizontal:18, paddingVertical:12,
      backgroundColor:C.bg, borderBottomWidth:1, borderBottomColor:C.border,
    }}>
      <Text style={{ color:C.lime, fontSize:20, fontWeight:'900', letterSpacing:1 }}>
        FITO<Text style={{ color:C.muted }}>/PIA</Text>
      </Text>
      <View style={{ alignItems:'flex-end' }}>
        <Text style={{ color:C.text, fontSize:18, fontWeight:'800' }}>
          {h}:{m}<Text style={{ color:C.muted, fontSize:12 }}>:{sec}</Text>
        </Text>
        <Text style={{ color:C.muted, fontSize:10 }}>
          {days[now.getDay()]}, {now.getDate()} {months[now.getMonth()]}
        </Text>
      </View>
    </View>
  );
}

// ─── Özel Tab Bar ──────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={{
      flexDirection:'row', backgroundColor:C.s1,
      borderTopWidth:1, borderTopColor:C.border,
      paddingBottom:8, paddingTop:6,
    }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label       = options.tabBarLabel ?? route.name;
        const focused     = state.index === index;
        const icons       = TAB_ICONS[route.name];
        const color       = focused ? C.lime : C.dim;

        return (
          <View key={route.key} style={{ flex:1, alignItems:'center' }}>
            {focused && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={{
                  position:'absolute', top:0, width:32, height:2,
                  backgroundColor:C.lime, borderRadius:2,
                }}
              />
            )}
            <View
              style={{ alignItems:'center', paddingTop:8 }}
              onTouchEnd={() => {
                if (!focused) navigation.navigate(route.name);
              }}
            >
              <Ionicons
                name={focused ? icons?.focused : icons?.outline}
                size={22}
                color={color}
              />
              <Text style={{
                fontSize:9, fontWeight:'700', marginTop:3,
                color, letterSpacing:0.3,
              }}>
                {label.toUpperCase()}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Ana Sekmeler ──────────────────────────────────────────────────────────────
function MainTabs({ onSignOut }) {
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }} edges={['top']}>
      <Header />
      <Tab.Navigator
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{ headerShown:false }}
      >
        <Tab.Screen name="Ana"         component={HomeScreen} options={{ tabBarLabel:'ANA' }} />
        <Tab.Screen name="Program"     component={ProgramScreen} />
        <Tab.Screen name="Egzersizler" component={ExercisesScreen} />
        <Tab.Screen name="İlerleme"    component={ProgressScreen} />
        <Tab.Screen name="Profil">
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

  if (session === undefined) {
    // Yükleniyor
    return (
      <View style={{ flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center' }}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Text style={{ color:C.lime, fontSize:28, fontWeight:'900', letterSpacing:2 }}>
          FITO<Text style={{ color:C.muted }}>/PIA</Text>
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {session ? (
        // Giriş yapılmış → Ana uygulama
        <NavigationContainer theme={navTheme}>
          <MainTabs onSignOut={handleSignOut} />
        </NavigationContainer>
      ) : (
        // Giriş yapılmamış → Auth ekranları
        <SafeAreaView style={{ flex:1, backgroundColor:C.bg }} edges={['top','bottom']}>
          {authMode === 'login'
            ? (
              <LoginScreen
                onSuccess={() => {}}
                onGoRegister={() => setAuthMode('register')}
              />
            )
            : (
              <RegisterScreen
                onSuccess={() => setAuthMode('login')}
                onGoLogin={() => setAuthMode('login')}
              />
            )
          }
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}
