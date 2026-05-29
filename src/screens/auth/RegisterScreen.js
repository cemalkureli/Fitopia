import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { signUp } from '../../lib/supabase';
import { C } from '../../utils/theme';

export default function RegisterScreen({ onSuccess, onGoLogin }) {
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);

  const emailRef   = useRef(null);
  const passRef    = useRef(null);
  const confirmRef = useRef(null);

  const initials = fullName
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  const handleRegister = async () => {
    if (!fullName.trim()) { setError('İsim soyisim gerekli.'); return; }
    if (!email.trim())    { setError('E-posta gerekli.'); return; }
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return; }

    setError('');
    setLoading(true);
    try {
      await signUp({ email: email.trim().toLowerCase(), password, fullName: fullName.trim() });
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <LinearGradient colors={['#020617', '#0a0f1e', '#020617']} style={s.fill}>
        <Animated.View entering={FadeIn.duration(500)} style={s.successWrap}>
          <Text style={s.successIcon}>✓</Text>
          <Text style={s.successTitle}>Hesap Oluşturuldu!</Text>
          <Text style={s.successSub}>E-posta adresine doğrulama linki gönderdik.</Text>
          <TouchableOpacity onPress={onGoLogin} style={s.successBtn}>
            <Text style={s.successBtnText}>Giriş Yap</Text>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    );
  }

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
          </Animated.View>

          {/* Avatar preview */}
          <Animated.View entering={FadeIn.delay(100).duration(500)} style={s.avatarWrap}>
            <LinearGradient colors={['#e8f44a', '#a3c200']} style={s.avatar}>
              <Text style={s.avatarText}>{initials || '?'}</Text>
            </LinearGradient>
          </Animated.View>

          {/* Card */}
          <Animated.View entering={FadeInDown.delay(150).duration(500).springify()} style={s.card}>
            <Text style={s.cardTitle}>Hesap Oluştur</Text>

            {/* İsim */}
            <Animated.View entering={FadeInDown.delay(200).duration(380)} style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color={C.dim} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Ad Soyad"
                placeholderTextColor={C.dim}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </Animated.View>

            {/* E-posta */}
            <Animated.View entering={FadeInDown.delay(260).duration(380)} style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={C.dim} style={s.inputIcon} />
              <TextInput
                ref={emailRef}
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
            <Animated.View entering={FadeInDown.delay(320).duration(380)} style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.dim} style={s.inputIcon} />
              <TextInput
                ref={passRef}
                style={[s.input, { paddingRight: 44 }]}
                placeholder="Şifre (min. 6 karakter)"
                placeholderTextColor={C.dim}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={C.muted}
                />
              </TouchableOpacity>
            </Animated.View>

            {/* Şifre tekrar */}
            <Animated.View entering={FadeInDown.delay(380).duration(380)} style={s.inputWrap}>
              <Ionicons name="shield-checkmark-outline" size={18} color={C.dim} style={s.inputIcon} />
              <TextInput
                ref={confirmRef}
                style={s.input}
                placeholder="Şifre tekrar"
                placeholderTextColor={C.dim}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              {confirm.length > 0 && (
                <Ionicons
                  name={confirm === password ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={confirm === password ? C.green : C.red}
                  style={{ marginLeft: 4 }}
                />
              )}
            </Animated.View>

            {/* Şifre gücü */}
            {password.length > 0 && (
              <Animated.View entering={FadeIn.duration(200)} style={s.strengthWrap}>
                {[1, 2, 3, 4].map(level => {
                  const strength = Math.min(Math.floor(password.length / 3), 4);
                  const colors   = ['#f87171', '#fb923c', '#e8f44a', '#34d399'];
                  return (
                    <View
                      key={level}
                      style={[
                        s.strengthBar,
                        { backgroundColor: strength >= level ? colors[strength - 1] : C.s3 },
                      ]}
                    />
                  );
                })}
              </Animated.View>
            )}

            {/* Hata */}
            {error ? (
              <Animated.Text entering={FadeIn.duration(250)} style={s.errorText}>
                {error}
              </Animated.Text>
            ) : null}

            {/* Kayıt butonu */}
            <Animated.View entering={FadeInDown.delay(440).duration(380)}>
              <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
                <LinearGradient colors={['#e8f44a', '#a3c200']} style={s.primaryBtn}>
                  {loading
                    ? <ActivityIndicator color={C.bg} size="small" />
                    : <Text style={s.primaryBtnText}>Kayıt Ol</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(500).duration(380)} style={s.switchRow}>
              <Text style={s.switchText}>Zaten hesabın var mı? </Text>
              <TouchableOpacity onPress={onGoLogin}>
                <Text style={s.switchLink}>Giriş Yap</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  fill:         { flex: 1 },
  scroll:       { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logoBlock:    { alignItems: 'center', marginBottom: 16 },
  logoText:     { color: C.lime, fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  logoDim:      { color: C.muted },

  avatarWrap:   { alignItems: 'center', marginBottom: 20 },
  avatar:       { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: C.bg, fontSize: 26, fontWeight: '900' },

  card:         { backgroundColor: C.s1, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.border },
  cardTitle:    { color: C.text, fontSize: 22, fontWeight: '800', marginBottom: 20, letterSpacing: 0.3 },

  inputWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.s2, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12, paddingHorizontal: 14 },
  inputIcon:    { marginRight: 10 },
  input:        { flex: 1, height: 52, color: C.text, fontSize: 15, fontWeight: '500' },
  eyeBtn:       { position: 'absolute', right: 14, padding: 4 },

  strengthWrap: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  strengthBar:  { flex: 1, height: 3, borderRadius: 2 },

  errorText:    { color: C.red, fontSize: 13, marginBottom: 12, textAlign: 'center' },

  primaryBtn:      { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryBtnText:  { color: C.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  switchRow:    { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  switchText:   { color: C.muted, fontSize: 14 },
  switchLink:   { color: C.lime, fontSize: 14, fontWeight: '700' },

  successWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon:  { fontSize: 64, color: C.green, marginBottom: 16 },
  successTitle: { color: C.text, fontSize: 24, fontWeight: '900', marginBottom: 10 },
  successSub:   { color: C.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  successBtn:   { backgroundColor: C.lime, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14 },
  successBtnText: { color: C.bg, fontWeight: '900', fontSize: 16 },
});
