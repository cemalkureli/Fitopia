import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, ActivityIndicator, Image,
  Animated, Dimensions, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedRN, { FadeInDown, FadeInLeft, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../utils/theme';
import { supabase, signOut, updateProfile } from '../lib/supabase';
import { getAllWorkoutLogs } from '../utils/storage';
import { useLang } from '../context/LanguageContext';
import { useUnits, fmtWeight, fmtHeight } from '../context/UnitsContext';
import { t } from '../utils/i18n';
import RulerPicker from '../components/RulerPicker';

const { width } = Dimensions.get('window');
const SUPPORT_EMAIL = 'cemalkureli@gmail.com';

const GOAL_KEYS = ['goalGainWeight', 'goalLoseFat', 'goalGainMuscle'];

// ─── Particle system ──────────────────────────────────────────────────────────
function Particles() {
  const particles = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      x: Math.random() * width,
      y: new Animated.Value(200 + Math.random() * 80),
      opacity: new Animated.Value(0),
      size: Math.random() * 3 + 2,
      delay: i * 400,
    }))
  ).current;

  useEffect(() => {
    particles.forEach((p) => {
      const animate = () => {
        p.y.setValue(180 + Math.random() * 60);
        p.opacity.setValue(0);
        Animated.parallel([
          Animated.timing(p.y, { toValue: -20, duration: 3500 + Math.random() * 2000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 0.7, duration: 600, useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0, duration: 2800, useNativeDriver: true }),
          ]),
        ]).start(animate);
      };
      setTimeout(animate, p.delay);
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: i % 3 === 0 ? '#dc2626' : i % 3 === 1 ? '#f87171' : '#fca5a5',
            transform: [{ translateY: p.y }],
            opacity: p.opacity,
          }}
        />
      ))}
    </View>
  );
}

// ─── Glow pulse ───────────────────────────────────────────────────────────────
function GlowPulse() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.32] });
  const scale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 180, height: 180,
        borderRadius: 90,
        backgroundColor: '#dc2626',
        top: 14, alignSelf: 'center',
        opacity, transform: [{ scale }],
      }}
      pointerEvents="none"
    />
  );
}

// ─── Sub-screen header ────────────────────────────────────────────────────────
function SubHeader({ title, onBack }) {
  return (
    <AnimatedRN.View entering={FadeInDown.duration(280)} style={sh.wrap}>
      <TouchableOpacity onPress={onBack} style={sh.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="arrow-back" size={20} color={C.text} />
      </TouchableOpacity>
      <Text style={sh.title}>{title}</Text>
      <View style={{ width: 44 }} />
    </AnimatedRN.View>
  );
}
const sh = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 58, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.s1, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  title:   { color: C.text, fontSize: 17, fontWeight: '800' },
});

// ─── Sub-screen background ────────────────────────────────────────────────────
function SubBg({ colors }) {
  return (
    <LinearGradient
      colors={colors ?? ['rgba(220,38,38,0.12)', 'rgba(2,6,23,0)']}
      locations={[0, 0.6]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

// ─── Radio option ─────────────────────────────────────────────────────────────
function RadioOption({ label, selected, onPress, delay = 0 }) {
  return (
    <AnimatedRN.View entering={FadeInLeft.delay(delay).duration(260)}>
      <TouchableOpacity style={ro.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[ro.circle, selected && { borderColor: '#dc2626', borderWidth: 2.5 }]}>
          {selected && <View style={ro.dot} />}
        </View>
        <Text style={[ro.label, selected && { color: C.text, fontWeight: '700' }]}>{label}</Text>
        {selected && <Ionicons name="checkmark-circle" size={18} color="#dc2626" style={{ marginLeft: 'auto' }} />}
      </TouchableOpacity>
    </AnimatedRN.View>
  );
}
const ro = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: C.border },
  circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.dim, alignItems: 'center', justifyContent: 'center' },
  dot:    { width: 9, height: 9, borderRadius: 5, backgroundColor: '#dc2626' },
  label:  { color: C.muted, fontSize: 16, fontWeight: '500', flex: 1 },
});

// ─── Sub section label ────────────────────────────────────────────────────────
function SubDesc({ text, delay = 60 }) {
  return (
    <AnimatedRN.Text entering={FadeInDown.delay(delay).duration(240)} style={{ color: C.muted, fontSize: 13, paddingHorizontal: 24, paddingVertical: 16 }}>
      {text}
    </AnimatedRN.Text>
  );
}

// ─── Number edit sub-screen ───────────────────────────────────────────────────
function NumberSub({ title, unit, value, desc, onBack, onSave, bgColors, min, max }) {
  const initNum = parseFloat(value) || (min ?? 0);
  const [num, setNum] = useState(initNum);
  const useRuler = min !== undefined && max !== undefined;
  return (
    <View style={ss.fill}>
      <SubBg colors={bgColors} />
      <SubHeader title={title} onBack={onBack} />
      <SubDesc text={desc} />
      <AnimatedRN.View entering={FadeInDown.delay(120).duration(280)} style={ss.numWrap}>
        {useRuler ? (
          // Cetvel kaydırıcı (boy / kilo gibi değerler için)
          <RulerPicker value={num} onChange={setNum} min={min} max={max} unit={unit} color="#dc2626" />
        ) : (
          <View style={ss.numRow}>
            <TextInput
              style={ss.numInput}
              value={String(num)}
              onChangeText={v => setNum(parseFloat(v) || 0)}
              keyboardType="decimal-pad"
              placeholderTextColor={C.dim}
              placeholder="0"
              autoFocus
            />
            <Text style={ss.numUnit}>{unit}</Text>
          </View>
        )}
        <TouchableOpacity style={ss.saveBtn} onPress={() => onSave(String(num))}>
          <LinearGradient colors={['#dc2626', '#7f1d1d']} style={ss.saveGrad}>
            <Text style={ss.saveTxt}>Kaydet</Text>
          </LinearGradient>
        </TouchableOpacity>
      </AnimatedRN.View>
    </View>
  );
}
const ss = StyleSheet.create({
  fill:    { flex: 1, backgroundColor: C.bg },
  numWrap: { padding: 24 },
  numRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 28 },
  numInput:{ flex: 1, fontSize: 52, fontWeight: '900', color: C.text, borderBottomWidth: 2, borderBottomColor: '#dc2626', paddingBottom: 8 },
  numUnit: { color: C.muted, fontSize: 20, fontWeight: '700', paddingBottom: 12 },
  saveBtn: { borderRadius: 16, overflow: 'hidden' },
  saveGrad:{ height: 52, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: '#fff', fontWeight: '900', fontSize: 16 },
});

// ─── Settings row ─────────────────────────────────────────────────────────────
function Row({ label, value, onPress, danger, last, noChevron }) {
  return (
    <TouchableOpacity
      style={[rw.row, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <Text style={[rw.label, danger && { color: '#ef4444' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {value ? <Text style={rw.value}>{value}</Text> : null}
        {!noChevron && onPress && <Ionicons name="chevron-forward" size={15} color={danger ? '#ef4444' : C.dim} />}
      </View>
    </TouchableOpacity>
  );
}
const rw = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 17, paddingHorizontal: 20 },
  label: { color: C.text, fontSize: 15, fontWeight: '600' },
  value: { color: C.muted, fontSize: 14 },
});

// ─── Info card ────────────────────────────────────────────────────────────────
function InfoCard({ label, value, onPress, delay = 0 }) {
  return (
    <AnimatedRN.View entering={FadeInDown.delay(delay).duration(300)} style={{ flex: 1 }}>
      <TouchableOpacity style={ic.card} onPress={onPress} disabled={!onPress} activeOpacity={0.75}>
        <LinearGradient colors={['rgba(220,38,38,0.08)', 'transparent']} style={StyleSheet.absoluteFill} />
        <Text style={ic.label}>{label}</Text>
        <Text style={ic.value} numberOfLines={2}>{value || '—'}</Text>
        {onPress && <Ionicons name="pencil" size={11} color={C.dim} style={{ position: 'absolute', top: 10, right: 10 }} />}
      </TouchableOpacity>
    </AnimatedRN.View>
  );
}
const ic = StyleSheet.create({
  card:  { borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)', backgroundColor: C.s1, minHeight: 72, overflow: 'hidden' },
  label: { color: C.muted, fontSize: 10, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  value: { color: C.text, fontSize: 16, fontWeight: '800' },
});

// ─── Delete Account modal ─────────────────────────────────────────────────────
function DeleteModal({ visible, onClose, lang, userEmail, onDeleted }) {
  const [step,      setStep]      = useState(0); // 0=info, 1=enter code
  const [code,      setCode]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [codeSent,  setCodeSent]  = useState(false);

  const sendCode = async () => {
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: userEmail, options: { shouldCreateUser: false } });
      if (error) throw error;
      setCodeSent(true);
      setStep(1);
    } catch (e) {
      Alert.alert(t('error', lang), e.message);
    } finally {
      setSending(false);
    }
  };

  const verifyAndDelete = async () => {
    if (!code.trim()) return;
    setDeleting(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({ email: userEmail, token: code.trim(), type: 'email' });
      if (verifyErr) { Alert.alert(t('error', lang), t('wrongCode', lang)); setDeleting(false); return; }
      Alert.alert(
        t('deleteAccount', lang),
        t('deleteConfirm', lang),
        [
          { text: t('cancel', lang), style: 'cancel', onPress: () => setDeleting(false) },
          {
            text: t('deleteAccount', lang), style: 'destructive',
            onPress: async () => {
              try {
                await supabase.rpc('delete_user');
                Alert.alert('✓', t('deleteSuccess', lang));
                onDeleted?.();
              } catch (e) {
                Alert.alert(t('error', lang), e.message);
              } finally {
                setDeleting(false);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert(t('error', lang), e.message);
      setDeleting(false);
    }
  };

  const reset = () => { setStep(0); setCode(''); setCodeSent(false); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <TouchableOpacity style={dm.overlay} activeOpacity={1} onPress={() => { reset(); onClose(); }}>
        <AnimatedRN.View entering={FadeIn.duration(200)} style={dm.sheet}>
          <View style={dm.handle} />
          <View style={dm.iconWrap}>
            <LinearGradient colors={['rgba(220,38,38,0.2)', 'transparent']} style={StyleSheet.absoluteFill} />
            <Ionicons name="warning-outline" size={32} color="#ef4444" />
          </View>
          <Text style={dm.title}>{t('deleteAccount', lang)}</Text>

          {step === 0 ? (
            <>
              <Text style={dm.desc}>{t('deleteStep1', lang)}</Text>
              <Text style={dm.email}>{userEmail}</Text>
              <TouchableOpacity style={dm.btn} onPress={sendCode} disabled={sending}>
                {sending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={dm.btnTxt}>{t('sendCode', lang)}</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={dm.desc}>{t('codeSent', lang)}</Text>
              <Text style={dm.enterLabel}>{t('enterCode', lang)}</Text>
              <TextInput
                style={dm.codeInput}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="______"
                placeholderTextColor={C.dim}
                maxLength={6}
                textAlign="center"
                autoFocus
              />
              <TouchableOpacity style={[dm.btn, dm.btnDanger]} onPress={verifyAndDelete} disabled={deleting || !code.trim()}>
                {deleting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={dm.btnTxt}>{t('verifyAndDelete', lang)}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={reset} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 13 }}>← {t('cancel', lang)}</Text>
              </TouchableOpacity>
            </>
          )}
        </AnimatedRN.View>
      </TouchableOpacity>
    </Modal>
  );
}
const dm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: C.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)', overflow: 'hidden' },
  handle:     { width: 40, height: 4, backgroundColor: C.s3, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  iconWrap:   { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(220,38,38,0.1)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden' },
  title:      { color: C.text, fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  desc:       { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  email:      { color: '#ef4444', fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  enterLabel: { color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  codeInput:  { backgroundColor: C.s2, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(220,38,38,0.4)', height: 56, fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: 8, marginBottom: 20 },
  btn:        { backgroundColor: C.s2, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  btnDanger:  { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  btnTxt:     { color: '#fff', fontWeight: '900', fontSize: 15 },
});

// ─── Main Profile Screen ──────────────────────────────────────────────────────
export default function ProfileScreen({ onSignOut }) {
  const { lang, setLang } = useLang();
  const { weightUnit, lengthUnit, setWeightUnit, setLengthUnit } = useUnits();

  const [user,        setUser]        = useState(null);
  const [profile,     setProfile]     = useState(null);
  const [logs,        setLogs]        = useState({});
  const [editModal,   setEditModal]   = useState(false);
  const [form,        setForm]        = useState({ full_name: '', weight: '', height: '', goal: '', gender: '' });
  const [saving,      setSaving]      = useState(false);
  const [avatarUrl,   setAvatarUrl]   = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [sub,         setSub]         = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      setUser(data.user);
      supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: p }) => {
        if (p) {
          setProfile(p);
          setAvatarUrl(p.avatar_url || null);
          setForm({ full_name: p.full_name || '', weight: String(p.weight || ''), height: String(p.height || ''), goal: p.goal || '', gender: p.gender || '' });
        }
      });
    });
    getAllWorkoutLogs().then(setLogs);
  }, []);

  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('athlete', lang);
  const initials = fullName.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
  const totalSessions = Object.values(logs).reduce((a, b) => a + b.length, 0);

  const goalDisplay = GOAL_KEYS.includes(profile?.goal) ? t(profile.goal, lang) : profile?.goal || null;
  const genderDisplay = profile?.gender === 'male' ? t('male', lang) : profile?.gender === 'female' ? t('female', lang) : profile?.gender || null;

  const saveField = async (field, val) => {
    if (!user) return;
    const num = ['weight', 'height'].includes(field) ? parseFloat(val) || null : val;
    try {
      await updateProfile(user.id, { [field]: num });
      setProfile(p => ({ ...p, [field]: num }));
      setSub(null);
    } catch (e) { Alert.alert(t('error', lang), e.message); }
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('permRequired', lang), t('galleryPerm', lang)); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext   = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const path  = `${user.id}/avatar.${ext}`;
      const resp  = await fetch(asset.uri); const blob = await resp.blob(); const arr = await blob.arrayBuffer();
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, arr, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;
      await updateProfile(user.id, { avatar_url: url });
      setAvatarUrl(url); setProfile(p => ({ ...p, avatar_url: url }));
    } catch (e) { Alert.alert(t('error', lang), e.message); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!user) return; setSaving(true);
    try {
      const updates = { full_name: form.full_name, weight: parseFloat(form.weight) || null, height: parseFloat(form.height) || null, goal: form.goal, gender: form.gender || null, email: user.email };
      await updateProfile(user.id, updates);
      setProfile(prev => ({ ...prev, ...updates }));
      setEditModal(false);
    } catch (e) { Alert.alert(t('error', lang), e.message); }
    finally { setSaving(false); }
  };

  const handleSignOut = () => Alert.alert(t('signOut', lang), t('signOutConfirm', lang), [
    { text: t('cancel', lang), style: 'cancel' },
    { text: t('signOut', lang), style: 'destructive', onPress: async () => { try { await signOut(); } catch {} onSignOut?.(); } },
  ]);

  const handleContact = () => {
    const subject = encodeURIComponent(t('mailSubject', lang));
    const body    = encodeURIComponent(t('mailBody', lang) + (user?.email ?? ''));
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  // ── Sub-screens ──────────────────────────────────────────────────────────────
  if (sub === 'height') return (
    <NumberSub
      title={t('changeHeight', lang)}
      unit={lengthUnit} value={profile?.height ? String(profile.height) : '175'}
      desc={lang === 'tr' ? 'Boyunuzu seçin.' : 'Select your height.'}
      bgColors={['rgba(20,184,166,0.12)', 'rgba(2,6,23,0)']}
      onBack={() => setSub(null)}
      onSave={v => saveField('height', v)}
      min={120} max={230}
    />
  );

  if (sub === 'weight') return (
    <NumberSub
      title={t('changeWeight', lang)}
      unit={weightUnit} value={profile?.weight ? String(profile.weight) : '75'}
      desc={lang === 'tr' ? 'Kilonuzu seçin.' : 'Select your weight.'}
      bgColors={['rgba(56,189,248,0.12)', 'rgba(2,6,23,0)']}
      onBack={() => setSub(null)}
      onSave={v => saveField('weight', v)}
      min={30} max={250}
    />
  );

  if (sub === 'goal') return (
    <View style={ss.fill}>
      <SubBg colors={['rgba(251,146,60,0.12)', 'rgba(2,6,23,0)']} />
      <SubHeader title={t('goalSelectTitle', lang)} onBack={() => setSub(null)} />
      <SubDesc text={lang === 'tr' ? 'Fitness hedefinizi seçin.' : 'Choose your fitness goal.'} />
      {GOAL_KEYS.map((key, i) => (
        <RadioOption key={key} label={t(key, lang)} selected={profile?.goal === key}
          onPress={() => saveField('goal', key)} delay={80 + i * 60} />
      ))}
    </View>
  );

  if (sub === 'gender') return (
    <View style={ss.fill}>
      <SubBg colors={['rgba(220,38,38,0.10)', 'rgba(2,6,23,0)']} />
      <SubHeader title={t('gender', lang)} onBack={() => setSub(null)} />
      <SubDesc text={lang === 'tr' ? 'Cinsiyetinizi seçin.' : 'Select your gender.'} />
      {['male', 'female'].map((g, i) => (
        <RadioOption key={g} label={t(g, lang)} selected={profile?.gender === g}
          onPress={async () => { await saveField('gender', g); setSub(null); }} delay={80 + i * 60} />
      ))}
    </View>
  );

  if (sub === 'language') return (
    <View style={ss.fill}>
      <SubBg colors={['rgba(56,189,248,0.12)', 'rgba(2,6,23,0)']} />
      <SubHeader title={t('language', lang)} onBack={() => setSub(null)} />
      <SubDesc text={lang === 'tr' ? 'Uygulama dilini değiştir.' : 'Change the app language.'} />
      <RadioOption label="English" selected={lang === 'en'} onPress={() => setLang('en')} delay={80} />
      <RadioOption label="Türkçe"  selected={lang === 'tr'} onPress={() => setLang('tr')} delay={140} />
    </View>
  );

  if (sub === 'appearance') return (
    <View style={ss.fill}>
      <SubBg colors={['rgba(167,139,250,0.12)', 'rgba(2,6,23,0)']} />
      <SubHeader title={t('appearance', lang)} onBack={() => setSub(null)} />
      <SubDesc text={lang === 'tr' ? 'Uygulama temasını seç.' : 'Choose app theme.'} />
      <RadioOption label={lang === 'tr' ? 'Karanlık' : 'Dark'} selected onPress={() => {}} delay={80} />
      <RadioOption label={lang === 'tr' ? 'Açık (yakında)' : 'Light (coming soon)'} selected={false} onPress={() => {}} delay={140} />
    </View>
  );

  if (sub === 'units') return (
    <View style={ss.fill}>
      <SubBg colors={['rgba(20,184,166,0.12)', 'rgba(2,6,23,0)']} />
      <SubHeader title={t('units', lang)} onBack={() => setSub(null)} />
      <SubDesc text={t('weightUnitDesc', lang)} />
      <RadioOption label="kg" selected={weightUnit === 'kg'} onPress={() => setWeightUnit('kg')} delay={80} />
      <RadioOption label="lb" selected={weightUnit === 'lb'} onPress={() => setWeightUnit('lb')} delay={130} />
      <SubDesc text={t('lengthUnitDesc', lang)} delay={0} />
      <RadioOption label="cm" selected={lengthUnit === 'cm'} onPress={() => setLengthUnit('cm')} delay={80} />
      <RadioOption label="in" selected={lengthUnit === 'in'} onPress={() => setLengthUnit('in')} delay={130} />
    </View>
  );

  // ── Main view ────────────────────────────────────────────────────────────────
  return (
    <View style={s.fill}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Hero — red/black dramatic gradient */}
        <View style={s.hero}>
          <LinearGradient
            colors={['rgba(220,38,38,0.55)', 'rgba(127,29,29,0.30)', 'rgba(2,6,23,0)']}
            locations={[0, 0.45, 1]}
            style={s.heroGrad}
          />
          <Particles />
          <GlowPulse />

          {/* Avatar */}
          <AnimatedRN.View entering={FadeIn.delay(60).duration(400)} style={s.avatarWrap}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
              ) : (
                <View style={s.avatarBox}>
                  <LinearGradient colors={['rgba(220,38,38,0.20)', 'rgba(2,6,23,0.95)']} style={StyleSheet.absoluteFill} />
                  <Text style={s.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={s.cameraBadge}>
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={13} color="#fff" />
                }
              </View>
            </TouchableOpacity>
          </AnimatedRN.View>

          <AnimatedRN.Text entering={FadeInDown.delay(120).duration(320)} style={s.userName}>{fullName}</AnimatedRN.Text>
          <AnimatedRN.View entering={FadeInDown.delay(180).duration(280)}>
            <TouchableOpacity onPress={() => setEditModal(true)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
              <Text style={s.editLink}>{t('editProfileLink', lang)}</Text>
            </TouchableOpacity>
          </AnimatedRN.View>

          <AnimatedRN.View entering={FadeInDown.delay(240).duration(300)} style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{totalSessions}</Text>
              <Text style={s.heroStatLbl}>{t('sessions', lang)}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{Object.keys(logs).length}</Text>
              <Text style={s.heroStatLbl}>{t('exerciseCount', lang)}</Text>
            </View>
          </AnimatedRN.View>
        </View>

        {/* Info cards — all tappable */}
        <View style={s.infoGrid}>
          <InfoCard label={t('gender', lang)} value={genderDisplay} onPress={() => setSub('gender')} delay={80} />
          <InfoCard label={t('height', lang)} value={profile?.height ? fmtHeight(profile.height, lengthUnit) : null} onPress={() => setSub('height')} delay={130} />
          <InfoCard label={t('weight', lang)} value={profile?.weight ? fmtWeight(profile.weight, weightUnit) : null} onPress={() => setSub('weight')} delay={180} />
          <InfoCard label={t('goal', lang)}   value={goalDisplay} onPress={() => setSub('goal')} delay={230} />
        </View>

        {/* Account */}
        <AnimatedRN.View entering={FadeInDown.delay(270).duration(300)} style={s.section}>
          <Text style={s.sectionTitle}>{t('account', lang)}</Text>
          <View style={s.card}>
            <Row label="Email" value={user?.email?.length > 22 ? user.email.slice(0, 22) + '…' : user?.email} noChevron last />
          </View>
          <View style={s.card}>
            <Row label={t('language', lang)}   value={lang === 'tr' ? 'Türkçe' : 'English'} onPress={() => setSub('language')} />
            <Row label={t('appearance', lang)} value={t('dark', lang)}                       onPress={() => setSub('appearance')} />
            <Row label={t('units', lang)}      value={`${weightUnit} / ${lengthUnit}`}        onPress={() => setSub('units')} last />
          </View>
        </AnimatedRN.View>

        {/* App */}
        <AnimatedRN.View entering={FadeInDown.delay(320).duration(300)} style={s.section}>
          <Text style={s.sectionTitle}>{t('app', lang)}</Text>
          <View style={s.card}>
            <Row label={t('rateApp', lang)}   onPress={() => {}} />
            <Row label={t('becomePro', lang)} onPress={() => {}} />
            <Row label={t('contactUs', lang)} onPress={handleContact} last />
          </View>
        </AnimatedRN.View>

        {/* Danger */}
        <AnimatedRN.View entering={FadeInDown.delay(370).duration(300)} style={s.section}>
          <View style={s.card}>
            <Row label={t('signOut', lang)}       onPress={handleSignOut} danger />
            <Row label={t('deleteAccount', lang)} onPress={() => setDeleteModal(true)} danger last />
          </View>
        </AnimatedRN.View>

      </ScrollView>

      {/* Edit modal (full name only) */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setEditModal(false)}>
          <AnimatedRN.View entering={FadeIn.duration(200)} style={s.editModal}>
            <View style={s.editHandle} />
            <Text style={s.editTitle}>{t('editProfile', lang)}</Text>
            <Text style={s.inputLabel}>{t('fullName', lang)}</Text>
            <TextInput style={s.inputField} value={form.full_name}
              onChangeText={v => setForm(f => ({ ...f, full_name: v }))}
              placeholder={t('fullName', lang)} placeholderTextColor={C.dim} autoCapitalize="words" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditModal(false)}>
                <Text style={{ color: C.muted, fontWeight: '700' }}>{t('cancel', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                <LinearGradient colors={['#dc2626', '#7f1d1d']} style={s.saveGrad}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>{t('save', lang)}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </AnimatedRN.View>
        </TouchableOpacity>
      </Modal>

      {/* Delete account modal */}
      <DeleteModal
        visible={deleteModal}
        onClose={() => setDeleteModal(false)}
        lang={lang}
        userEmail={user?.email ?? ''}
        onDeleted={() => { setDeleteModal(false); try { signOut(); } catch {} onSignOut?.(); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  fill:    { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 48 },

  hero:            { alignItems: 'center', paddingTop: 32, paddingBottom: 28, overflow: 'hidden' },
  heroGrad:        { position: 'absolute', top: 0, left: 0, right: 0, height: 340 },
  avatarWrap:      { marginBottom: 14, zIndex: 1 },
  avatarImg:       { width: 112, height: 112, borderRadius: 28, borderWidth: 2.5, borderColor: '#dc2626' },
  avatarBox:       { width: 112, height: 112, borderRadius: 28, backgroundColor: C.s1, borderWidth: 2.5, borderColor: 'rgba(220,38,38,0.45)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInitials:  { color: '#f87171', fontSize: 40, fontWeight: '900', letterSpacing: 2 },
  cameraBadge:     { position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  userName:        { color: C.text, fontSize: 24, fontWeight: '900', marginBottom: 6, zIndex: 1 },
  editLink:        { color: C.muted, fontSize: 13, marginBottom: 20 },
  heroStats:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)', paddingVertical: 12, paddingHorizontal: 8 },
  heroStat:        { flex: 1, alignItems: 'center' },
  heroStatVal:     { color: C.text, fontSize: 20, fontWeight: '900' },
  heroStatLbl:     { color: C.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(220,38,38,0.25)' },

  infoGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  section:      { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { color: C.dim, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },
  card:         { backgroundColor: C.s1, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 8 },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  editModal:  { backgroundColor: C.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, borderWidth: 1, borderColor: C.border },
  editHandle: { width: 40, height: 4, backgroundColor: C.s3, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  editTitle:  { color: C.text, fontSize: 18, fontWeight: '900', marginBottom: 16, textAlign: 'center' },
  inputLabel: { color: C.muted, fontSize: 11, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  inputField: { backgroundColor: C.s2, borderRadius: 12, borderWidth: 1, borderColor: C.border, height: 46, paddingHorizontal: 14, color: C.text, fontSize: 15, fontWeight: '500' },
  cancelBtn:  { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  saveBtn:    { flex: 2, borderRadius: 12, overflow: 'hidden' },
  saveGrad:   { height: 46, alignItems: 'center', justifyContent: 'center' },
});
