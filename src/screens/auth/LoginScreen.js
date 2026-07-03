import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinear, Stop, Circle, Line, Rect } from 'react-native-svg';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay,
  interpolate, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { signIn } from '../../lib/supabase';
import { C, F } from '../../utils/theme';
import { useLang } from '../../context/LanguageContext';
import { t } from '../../utils/i18n';
import LangToggle from '../../components/LangToggle';

/* ─────────────────────────────────────────────────────────────────────────────
   Animated 3D-feel background
   - Soft drifting aurora orbs (parallax depth via different speeds/scales)
   - A converging perspective grid "floor" that signals 3D space
   - Pure transform/opacity animation → runs on the Reanimated UI thread
   ──────────────────────────────────────────────────────────────────────────── */

// One floating, breathing aurora orb. `depth` 0..1 → farther = slower & dimmer.
function Orb({ size, color, x, y, depth, delay = 0 }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 6000 + depth * 6000, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const travel = 26 + (1 - depth) * 34; // closer orbs drift more
    return {
      transform: [
        { translateX: interpolate(p.value, [0, 1], [-travel, travel]) },
        { translateY: interpolate(p.value, [0, 1], [travel, -travel]) },
        { scale: interpolate(p.value, [0, 1], [1, 1.18]) },
      ],
      opacity: interpolate(p.value, [0, 0.5, 1], [0.45, 0.7, 0.45]) * (0.5 + depth * 0.5),
    };
  });

  const gid = `orb-${x}-${y}-${size}`;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x, top: y }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <Stop offset="45%" stopColor={color} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

// Converging perspective grid that fades upward — a 3D "floor" under the content.
function PerspectiveGrid({ width, height }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: interpolate(glow.value, [0, 1], [0.18, 0.4]) }));

  const gh = height * 0.42;          // floor height
  const top = height - gh;
  const vanishX = width / 2;
  const cols = 11;
  const verticals = Array.from({ length: cols }, (_, i) => {
    const bx = (i / (cols - 1)) * width * 1.8 - width * 0.4; // wide base
    return <Line key={`v${i}`} x1={bx} y1={height} x2={vanishX} y2={top} stroke={C.lime} strokeWidth={1} />;
  });
  const rows = 7;
  const horizontals = Array.from({ length: rows }, (_, i) => {
    // exponential spacing → rows bunch up toward the horizon (perspective)
    const f = Math.pow(i / rows, 2.2);
    const y = top + f * gh;
    return <Line key={`h${i}`} x1={0} y1={y} x2={width} y2={y} stroke={C.lime} strokeWidth={1} />;
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinear id="floorFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={C.bg} stopOpacity="1" />
            <Stop offset="55%" stopColor={C.bg} stopOpacity="0" />
          </SvgLinear>
        </Defs>
        {verticals}
        {horizontals}
        {/* fade the far edge of the grid into the background */}
        <Rect x={0} y={top} width={width} height={gh * 0.6} fill="url(#floorFade)" />
      </Svg>
    </Animated.View>
  );
}

export default function LoginScreen({ onSuccess, onGoRegister }) {
  const { lang } = useLang();
  const { width, height } = useWindowDimensions();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const passRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('lastEmail').then(v => { if (v) setEmail(v); });
  }, []);

  // ── Logo: subtle perspective tilt + float (the "3D" hero) ──
  const tilt = useSharedValue(0);
  const float = useSharedValue(0);
  useEffect(() => {
    tilt.value  = withRepeat(withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.sin) }), -1, true);
    float.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateX: `${interpolate(tilt.value, [0, 1], [8, -8])}deg` },
      { rotateY: `${interpolate(tilt.value, [0, 1], [-10, 10])}deg` },
      { translateY: interpolate(float.value, [0, 1], [-6, 6]) },
    ],
  }));

  // ── CTA shimmer sweep ──
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1, false,
    );
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmer.value, [0, 1], [-160, 260]) },
      { skewX: '-20deg' },
    ],
    opacity: interpolate(shimmer.value, [0, 0.15, 0.5, 0.85, 1], [0, 0.5, 0.5, 0.5, 0]),
  }));

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError(t('emailRequired', lang)); return; }
    setError(''); setLoading(true);
    try {
      const trimmed = email.trim().toLowerCase();
      await signIn({ email: trimmed, password });
      AsyncStorage.setItem('lastEmail', trimmed);
      onSuccess?.();
    } catch (e) {
      setError(e.message === 'Invalid login credentials' ? t('wrongCreds', lang) : e.message);
    } finally { setLoading(false); }
  };

  return (
    <LinearGradient colors={['#020617', '#0a1226', '#020617']} style={s.fill}>
      {/* ── 3D-feel animated backdrop ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <PerspectiveGrid width={width} height={height} />
        <Orb size={360} color={C.lime}   x={width * 0.42} y={-90}            depth={0.2} delay={0} />
        <Orb size={300} color={C.teal}   x={-110}         y={height * 0.30}  depth={0.55} delay={400} />
        <Orb size={260} color={C.blue}   x={width - 150}  y={height * 0.46}  depth={0.8}  delay={800} />
        <Orb size={220} color={C.purple} x={width * 0.18} y={height * 0.62}  depth={0.65} delay={1200} />
      </View>

      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Dil seçimi */}
          <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'flex-end', marginBottom: 8 }}>
            <LangToggle />
          </Animated.View>

          {/* Logo — 3D tilt + float */}
          <Animated.View entering={FadeIn.duration(700)} style={s.logoBlock}>
            <Animated.View style={logoStyle}>
              <Text style={s.logoText}>FITO<Text style={s.logoDim}>/PIA</Text></Text>
            </Animated.View>
            <Text style={s.brandKicker}>FITNESS · COACH · PROGRESS</Text>
            <View style={s.logoUnderline} />
            <Text style={s.tagline}>{t('welcome', lang)}</Text>
          </Animated.View>

          {/* Glassmorphism kart */}
          <Animated.View entering={FadeInDown.delay(150).duration(500).springify()} style={s.cardShadow}>
          <View style={s.card}>
            {/* glass sheen */}
            <LinearGradient
              colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <Text style={s.eyebrow}>{t('welcomeBack', lang)}</Text>
            <Text style={s.cardTitle}>{t('login', lang)}</Text>
            <Text style={s.cardSub}>{t('loginSub', lang)}</Text>

            <Animated.View entering={FadeInDown.delay(220).duration(400)} style={s.field}>
              <Text style={s.label}>{t('email', lang)}</Text>
              <View style={s.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={C.muted} style={s.icon} />
                <TextInput
                  style={s.input} value={email} onChangeText={setEmail}
                  placeholder="name@mail.com" placeholderTextColor={C.dim}
                  autoCapitalize="none" keyboardType="email-address"
                  returnKeyType="next" onSubmitEditing={() => passRef.current?.focus()}
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(290).duration(400)} style={s.field}>
              <Text style={s.label}>{t('passwordSimple', lang)}</Text>
              <View style={s.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={C.muted} style={s.icon} />
                <TextInput
                  ref={passRef} style={[s.input, { paddingRight: 44 }]}
                  value={password} onChangeText={setPassword}
                  placeholder="••••••••" placeholderTextColor={C.dim}
                  secureTextEntry={!showPass} returnKeyType="done" onSubmitEditing={handleLogin}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {error ? <Animated.Text entering={FadeIn.duration(250)} style={s.error}>{error}</Animated.Text> : null}

            <Animated.View entering={FadeInDown.delay(360).duration(400)}>
              <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={['#e8f44a', '#a3c200']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>
                  {/* shimmer sweep */}
                  <Animated.View style={[s.shimmer, shimmerStyle]} pointerEvents="none" />
                  {loading ? <ActivityIndicator color={C.bg} size="small" />
                           : (
                             <View style={s.btnRow}>
                               <Text style={s.btnText}>{t('login', lang)}</Text>
                               <Ionicons name="arrow-forward" size={18} color={C.bg} style={{ marginLeft: 8 }} />
                             </View>
                           )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(420).duration(400)} style={s.switchRow}>
              <Text style={s.switchTxt}>{t('noAccount', lang)}</Text>
              <TouchableOpacity onPress={onGoRegister}>
                <Text style={s.switchLink}>{t('register', lang)}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  fill:      { flex: 1 },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 24 },

  // ── Brand / logo ──
  logoBlock: { alignItems: 'center', marginBottom: 40 },
  logoText:  {
    color: C.lime, fontSize: 46, fontFamily: F.extrabold, letterSpacing: 1,
    textShadowColor: 'rgba(232,244,74,0.45)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 28,
  },
  logoDim:   { color: C.muted, fontFamily: F.light, textShadowColor: 'transparent' },
  brandKicker: {
    color: C.dim, fontSize: 10.5, fontFamily: F.semibold, letterSpacing: 3, marginTop: 12,
  },
  logoUnderline: { width: 48, height: 3, borderRadius: 2, backgroundColor: C.lime, marginTop: 14, opacity: 0.9 },
  tagline:   { color: C.muted, fontSize: 12.5, fontFamily: F.regular, marginTop: 12, letterSpacing: 0.4 },

  // ── Card ──
  // No `elevation` here: combined with a translucent backgroundColor, Android
  // renders the elevation shadow as a visibly offset rectangle behind the
  // card — the "box inside a box" look. shadowColor/shadowRadius (iOS-only)
  // still give the glow on iOS; Android relies on the border for depth.
  cardShadow: {
    backgroundColor: 'rgba(15,23,42,0.72)', borderRadius: 26,
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)',
    shadowColor: C.lime, shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
  },
  card: {
    borderRadius: 26, padding: 24, paddingTop: 22, overflow: 'hidden',
  },
  eyebrow:   { color: C.lime, fontSize: 11, fontFamily: F.bold, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 6, opacity: 0.9 },
  cardTitle: { color: C.text, fontSize: 26, fontFamily: F.extrabold, letterSpacing: 0.2, marginBottom: 4 },
  cardSub:   { color: C.muted, fontSize: 13, fontFamily: F.regular, letterSpacing: 0.2, marginBottom: 22 },

  // ── Fields ──
  field:     { marginBottom: 16 },
  label:     { color: C.muted, fontSize: 11, fontFamily: F.semibold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.65)', borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14 },
  icon:      { marginRight: 10 },
  input:     { flex: 1, height: 52, color: C.text, fontSize: 15, fontFamily: F.medium, letterSpacing: 0.2 },
  eyeBtn:    { position: 'absolute', right: 14, padding: 4 },
  error:     { color: C.red, fontSize: 12.5, fontFamily: F.medium, marginBottom: 12, textAlign: 'center', letterSpacing: 0.2 },

  // ── CTA ──
  btn:       { borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 6, overflow: 'hidden' },
  btnRow:    { flexDirection: 'row', alignItems: 'center' },
  btnText:   { color: C.bg, fontSize: 15, fontFamily: F.extrabold, letterSpacing: 1.5, textTransform: 'uppercase' },
  shimmer:   { position: 'absolute', top: -10, bottom: -10, width: 60, backgroundColor: 'rgba(255,255,255,0.55)' },

  // ── Footer ──
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 22 },
  switchTxt: { color: C.muted, fontSize: 13.5, fontFamily: F.regular },
  switchLink:{ color: C.lime, fontSize: 13.5, fontFamily: F.bold, letterSpacing: 0.3, marginLeft: 6 },
});
