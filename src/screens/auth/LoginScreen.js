import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { signIn } from '../../lib/supabase';
import { C } from '../../utils/theme';

export default function LoginScreen({ onSuccess, onGoRegister }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const passRef = useRef(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('E-posta ve şifre gerekli.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn({ email: email.trim().toLowerCase(), password });
      onSuccess?.();
    } catch (e) {
      setError(e.message === 'Invalid login credentials'
        ? 'E-posta veya şifre hatalı.'
        : e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#020617', '#0a0f1e', '#020617']} style={s.fill}>
      <KeyboardAvoidingView
        style={s.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Animated.View entering={FadeIn.duration(700)} style={s.logoBlock}>
            <Text style={s.logoText}>
              FITO<Text style={s.logoDim}>/PIA</Text>
            </Text>
            <Text style={s.tagline}>Antrenmanını takip et. Güçlen.</Text>
          </Animated.View>

          {/* Card */}
          <Animated.View entering={FadeInDown.delay(150).duration(500).springify()} style={s.card}>
            <Text style={s.cardTitle}>Giriş Yap</Text>

            {/* E-posta */}
            <Animated.View entering={FadeInDown.delay(220).duration(400)} style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={C.dim} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="E-posta"
                placeholderTextColor={C.dim}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passRef.current?.focus()}
              />
            </Animated.View>

            {/* Şifre */}
            <Animated.View entering={FadeInDown.delay(290).duration(400)} style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.dim} style={s.inputIcon} />
              <TextInput
                ref={passRef}
                style={[s.input, { paddingRight: 44 }]}
                placeholder="Şifre"
                placeholderTextColor={C.dim}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={C.muted}
                />
              </TouchableOpacity>
            </Animated.View>

            {/* Hata */}
            {error ? (
              <Animated.Text entering={FadeIn.duration(250)} style={s.errorText}>
                {error}
              </Animated.Text>
            ) : null}

            {/* Giriş butonu */}
            <Animated.View entering={FadeInDown.delay(360).duration(400)}>
              <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={['#e8f44a', '#a3c200']} style={s.primaryBtn}>
                  {loading
                    ? <ActivityIndicator color={C.bg} size="small" />
                    : <Text style={s.primaryBtnText}>Giriş Yap</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Kayıt ol */}
            <Animated.View entering={FadeInUp.delay(420).duration(400)} style={s.switchRow}>
              <Text style={s.switchText}>Hesabın yok mu? </Text>
              <TouchableOpacity onPress={onGoRegister}>
                <Text style={s.switchLink}>Kayıt Ol</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  fill:        { flex: 1 },
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logoBlock:   { alignItems: 'center', marginBottom: 40 },
  logoText:    { color: C.lime, fontSize: 36, fontWeight: '900', letterSpacing: 2 },
  logoDim:     { color: C.muted },
  tagline:     { color: C.dim, fontSize: 13, marginTop: 6, letterSpacing: 0.5 },

  card:        { backgroundColor: C.s1, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.border },
  cardTitle:   { color: C.text, fontSize: 22, fontWeight: '800', marginBottom: 24, letterSpacing: 0.3 },

  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.s2, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 14, paddingHorizontal: 14 },
  inputIcon:   { marginRight: 10 },
  input:       { flex: 1, height: 52, color: C.text, fontSize: 15, fontWeight: '500' },
  eyeBtn:      { position: 'absolute', right: 14, padding: 4 },

  errorText:   { color: C.red, fontSize: 13, marginBottom: 12, textAlign: 'center' },

  primaryBtn:     { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryBtnText: { color: C.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  switchRow:   { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  switchText:  { color: C.muted, fontSize: 14 },
  switchLink:  { color: C.lime, fontSize: 14, fontWeight: '700' },
});
