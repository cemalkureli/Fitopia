import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, ActivityIndicator, Image, Dimensions, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInLeft, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../utils/theme';
import { supabase, signOut, updateProfile } from '../lib/supabase';
import { getAllWorkoutLogs } from '../utils/storage';
import { useLang } from '../context/LanguageContext';
import { useUnits, fmtWeight, fmtHeight } from '../context/UnitsContext';
import { t } from '../utils/i18n';

const { width } = Dimensions.get('window');
const SUPPORT_EMAIL = 'cemalkureli@gmail.com';

// ─── Sub-screen header ────────────────────────────────────────────────────────
function SubHeader({ title, onBack }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={sh.wrap}>
      <TouchableOpacity onPress={onBack} style={sh.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="arrow-back" size={20} color={C.text} />
      </TouchableOpacity>
      <Text style={sh.title}>{title}</Text>
      <View style={{ width: 44 }} />
    </Animated.View>
  );
}
const sh = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 58, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 44, height: 44, borderRadius: 13, backgroundColor: C.s1, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  title:   { color: C.text, fontSize: 17, fontWeight: '800' },
});

// ─── Sub-screen background gradient ───────────────────────────────────────────
function SubBg({ colors }) {
  return (
    <LinearGradient
      colors={colors ?? ['rgba(232,244,74,0.10)', 'rgba(7,8,11,0)']}
      locations={[0, 0.6]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

// ─── Radio option ─────────────────────────────────────────────────────────────
function RadioOption({ label, selected, onPress, delay = 0 }) {
  return (
    <Animated.View entering={FadeInLeft.delay(delay).duration(280)}>
      <TouchableOpacity style={ro.row} onPress={onPress} activeOpacity={0.7}>
        <View style={[ro.circle, selected && { borderColor: C.lime, borderWidth: 2.5 }]}>
          {selected && <View style={ro.dot} />}
        </View>
        <Text style={[ro.label, selected && { color: C.text, fontWeight: '700' }]}>{label}</Text>
        {selected && <Ionicons name="checkmark-circle" size={18} color={C.lime} style={{ marginLeft: 'auto' }} />}
      </TouchableOpacity>
    </Animated.View>
  );
}
const ro = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: C.border },
  circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.dim, alignItems: 'center', justifyContent: 'center' },
  dot:    { width: 9, height: 9, borderRadius: 5, backgroundColor: C.lime },
  label:  { color: C.muted, fontSize: 16, fontWeight: '500', flex: 1 },
});

// ─── Section label ─────────────────────────────────────────────────────────────
function SubSectionLabel({ text, delay = 0 }) {
  return (
    <Animated.Text entering={FadeInDown.delay(delay).duration(250)} style={ssl.text}>
      {text}
    </Animated.Text>
  );
}
const ssl = StyleSheet.create({
  text: { color: C.muted, fontSize: 12, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
});

// ─── Settings row ─────────────────────────────────────────────────────────────
function Row({ label, value, onPress, danger, last, noChevron, delay = 0 }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(280)}>
      <TouchableOpacity
        style={[rw.row, last && { borderBottomWidth: 0 }]}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.65 : 1}
      >
        <Text style={[rw.label, danger && { color: C.red }]}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {value ? <Text style={rw.value}>{value}</Text> : null}
          {!noChevron && onPress && (
            <Ionicons name="chevron-forward" size={15} color={danger ? C.red + '70' : C.dim} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const rw = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 17, paddingHorizontal: 20 },
  label: { color: C.text, fontSize: 15, fontWeight: '600' },
  value: { color: C.muted, fontSize: 14 },
});

// ─── Info card ────────────────────────────────────────────────────────────────
function InfoCard({ label, value, onPress, accent, delay = 0 }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(320)} style={{ flex: 1 }}>
      <TouchableOpacity
        style={[ic.card, accent && { borderColor: accent + '50' }]}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.75 : 1}
      >
        {accent && (
          <LinearGradient
            colors={[accent + '18', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text style={ic.label}>{label}</Text>
        <Text style={[ic.value, accent && { color: accent }]} numberOfLines={2}>{value || '—'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
const ic = StyleSheet.create({
  card:  { borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1, minHeight: 72, overflow: 'hidden' },
  label: { color: C.muted, fontSize: 10, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  value: { color: C.text, fontSize: 16, fontWeight: '800' },
});

// ─── Main Profile Screen ──────────────────────────────────────────────────────
export default function ProfileScreen({ onSignOut }) {
  const { lang, setLang } = useLang();
  const { weightUnit, lengthUnit, setWeightUnit, setLengthUnit } = useUnits();

  const [user,      setUser]      = useState(null);
  const [profile,   setProfile]   = useState(null);
  const [logs,      setLogs]      = useState({});
  const [editModal, setEditModal] = useState(false);
  const [form,      setForm]      = useState({ full_name: '', weight: '', height: '', goal: '', gender: '' });
  const [saving,    setSaving]    = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sub,       setSub]       = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      setUser(data.user);
      supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: p }) => {
        if (p) {
          setProfile(p);
          setAvatarUrl(p.avatar_url || null);
          setForm({
            full_name: p.full_name || '',
            weight:    String(p.weight || ''),
            height:    String(p.height || ''),
            goal:      p.goal || '',
            gender:    p.gender || '',
          });
        }
      });
    });
    getAllWorkoutLogs().then(setLogs);
  }, []);

  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('athlete', lang);
  const initials = fullName.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
  const totalSessions = Object.values(logs).reduce((a, b) => a + b.length, 0);
  const genderDisplay = profile?.gender === 'male' ? t('male', lang) : profile?.gender === 'female' ? t('female', lang) : profile?.gender || null;

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
      const resp  = await fetch(asset.uri);
      const blob  = await resp.blob();
      const arr   = await blob.arrayBuffer();
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, arr, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;
      await updateProfile(user.id, { avatar_url: url });
      setAvatarUrl(url);
      setProfile(p => ({ ...p, avatar_url: url }));
    } catch (e) { Alert.alert(t('error', lang), e.message); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
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

  const handleDelete = () => Alert.alert(t('deleteAccount', lang), t('deleteConfirm', lang), [
    { text: t('cancel', lang), style: 'cancel' },
    { text: t('deleteAccount', lang), style: 'destructive', onPress: () => {} },
  ]);

  const handleContact = () => {
    const subject = encodeURIComponent(t('mailSubject', lang));
    const body    = encodeURIComponent(t('mailBody', lang) + (user?.email ?? ''));
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const updateGender = async (g) => {
    if (!user) return;
    try {
      await updateProfile(user.id, { gender: g });
      setProfile(p => ({ ...p, gender: g }));
    } catch (e) { Alert.alert(t('error', lang), e.message); }
  };

  // ── Sub-screens ──────────────────────────────────────────────────────────────
  if (sub === 'language') return (
    <View style={s.fill}>
      <SubBg colors={['rgba(56,189,248,0.14)', 'rgba(7,8,11,0)']} />
      <SubHeader title={t('language', lang)} onBack={() => setSub(null)} />
      <SubSectionLabel text={lang === 'tr' ? 'Uygulama dilini değiştir.' : 'Change the app language.'} delay={80} />
      <RadioOption label="English" selected={lang === 'en'} onPress={() => setLang('en')} delay={140} />
      <RadioOption label="Türkçe"  selected={lang === 'tr'} onPress={() => setLang('tr')} delay={200} />
    </View>
  );

  if (sub === 'appearance') return (
    <View style={s.fill}>
      <SubBg colors={['rgba(139,92,246,0.14)', 'rgba(7,8,11,0)']} />
      <SubHeader title={t('appearance', lang)} onBack={() => setSub(null)} />
      <SubSectionLabel text={lang === 'tr' ? 'Uygulama temasını seç.' : 'Choose app theme.'} delay={80} />
      <RadioOption label={lang === 'tr' ? 'Karanlık' : 'Dark'} selected onPress={() => {}} delay={140} />
      <RadioOption label={lang === 'tr' ? 'Açık (yakında)' : 'Light (coming soon)'} selected={false} onPress={() => {}} delay={200} />
    </View>
  );

  if (sub === 'units') return (
    <View style={s.fill}>
      <SubBg colors={['rgba(20,184,166,0.14)', 'rgba(7,8,11,0)']} />
      <SubHeader title={t('units', lang)} onBack={() => setSub(null)} />
      <SubSectionLabel text={t('weightUnitDesc', lang)} delay={80} />
      <RadioOption label="kg" selected={weightUnit === 'kg'} onPress={() => setWeightUnit('kg')} delay={130} />
      <RadioOption label="lb" selected={weightUnit === 'lb'} onPress={() => setWeightUnit('lb')} delay={180} />
      <SubSectionLabel text={t('lengthUnitDesc', lang)} delay={240} />
      <RadioOption label="cm" selected={lengthUnit === 'cm'} onPress={() => setLengthUnit('cm')} delay={290} />
      <RadioOption label="in" selected={lengthUnit === 'in'} onPress={() => setLengthUnit('in')} delay={340} />
    </View>
  );

  if (sub === 'gender') return (
    <View style={s.fill}>
      <SubBg colors={['rgba(232,244,74,0.12)', 'rgba(7,8,11,0)']} />
      <SubHeader title={t('gender', lang)} onBack={() => setSub(null)} />
      <SubSectionLabel text={lang === 'tr' ? 'Cinsiyetini seç.' : 'Select your gender.'} delay={80} />
      {['male', 'female', 'other'].map((g, i) => (
        <RadioOption key={g} label={t(g, lang)} selected={profile?.gender === g}
          onPress={() => updateGender(g)} delay={130 + i * 60} />
      ))}
    </View>
  );

  // ── Main view ────────────────────────────────────────────────────────────────
  return (
    <View style={s.fill}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Hero — fluid lime-to-teal gradient */}
        <View style={s.hero}>
          <LinearGradient
            colors={['rgba(232,244,74,0.30)', 'rgba(20,184,166,0.16)', 'rgba(7,8,11,0)']}
            locations={[0, 0.5, 1]}
            style={s.heroGrad}
          />
          <Animated.View entering={FadeIn.delay(50).duration(400)} style={s.avatarWrap}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
              ) : (
                <View style={s.avatarBox}>
                  <LinearGradient
                    colors={['rgba(232,244,74,0.18)', 'rgba(7,8,11,0.95)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={s.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={s.cameraBadge}>
                {uploading
                  ? <ActivityIndicator size="small" color={C.bg} />
                  : <Ionicons name="camera" size={13} color={C.bg} />
                }
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(120).duration(350)} style={s.userName}>
            {fullName}
          </Animated.Text>
          <Animated.View entering={FadeInDown.delay(180).duration(300)}>
            <TouchableOpacity onPress={() => setEditModal(true)} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
              <Text style={s.editLink}>{t('editProfileLink', lang)}</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Mini stats */}
          <Animated.View entering={FadeInDown.delay(240).duration(320)} style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{totalSessions}</Text>
              <Text style={s.heroStatLbl}>{t('sessions', lang)}</Text>
            </View>
            <View style={s.heroStatDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{Object.keys(logs).length}</Text>
              <Text style={s.heroStatLbl}>{t('exerciseCount', lang)}</Text>
            </View>
          </Animated.View>
        </View>

        {/* Info grid — 2×2 */}
        <View style={s.infoGrid}>
          <InfoCard label={t('gender', lang)} value={genderDisplay} onPress={() => setSub('gender')} accent={C.lime} delay={80} />
          <InfoCard label={t('height', lang)} value={profile?.height ? fmtHeight(profile.height, lengthUnit) : null} accent={C.teal} delay={130} />
          <InfoCard label={t('weight', lang)} value={profile?.weight ? fmtWeight(profile.weight, weightUnit) : null} accent={C.blue} delay={180} />
          <InfoCard label={t('goal', lang)} value={profile?.goal} accent={C.orange} delay={230} />
        </View>

        {/* Account section */}
        <Animated.View entering={FadeInDown.delay(280).duration(320)} style={s.section}>
          <Text style={s.sectionTitle}>{t('account', lang)}</Text>
          <View style={s.card}>
            <Row label="Email" value={user?.email?.length > 22 ? user.email.slice(0, 22) + '…' : user?.email} noChevron last />
          </View>
          <View style={s.card}>
            <Row label={t('language', lang)}   value={lang === 'tr' ? 'Türkçe' : 'English'} onPress={() => setSub('language')} delay={0} />
            <Row label={t('appearance', lang)} value={t('dark', lang)}                       onPress={() => setSub('appearance')} delay={0} />
            <Row label={t('units', lang)}      value={`${weightUnit} / ${lengthUnit}`}        onPress={() => setSub('units')} last delay={0} />
          </View>
        </Animated.View>

        {/* App section */}
        <Animated.View entering={FadeInDown.delay(340).duration(320)} style={s.section}>
          <Text style={s.sectionTitle}>{t('app', lang)}</Text>
          <View style={s.card}>
            <Row label={t('rateApp', lang)}   onPress={() => {}} />
            <Row label={t('becomePro', lang)} onPress={() => {}} />
            <Row label={t('contactUs', lang)} onPress={handleContact} last />
          </View>
        </Animated.View>

        {/* Danger zone */}
        <Animated.View entering={FadeInDown.delay(400).duration(320)} style={s.section}>
          <View style={s.card}>
            <Row label={t('signOut', lang)}       onPress={handleSignOut} danger />
            <Row label={t('deleteAccount', lang)} onPress={handleDelete}  danger last />
          </View>
        </Animated.View>

      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setEditModal(false)}>
          <Animated.View entering={FadeIn.duration(200)} style={s.editModal}>
            <View style={s.editHandle} />
            <Text style={s.editTitle}>{t('editProfile', lang)}</Text>

            <Text style={s.inputLabel}>{t('fullName', lang)}</Text>
            <TextInput style={s.inputField} value={form.full_name}
              onChangeText={v => setForm(f => ({ ...f, full_name: v }))}
              placeholder={t('fullName', lang)} placeholderTextColor={C.dim} autoCapitalize="words" />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>{t('weightKg', lang)}</Text>
                <TextInput style={s.inputField} value={form.weight}
                  onChangeText={v => setForm(f => ({ ...f, weight: v }))}
                  placeholder="75" placeholderTextColor={C.dim} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>{t('heightCm', lang)}</Text>
                <TextInput style={s.inputField} value={form.height}
                  onChangeText={v => setForm(f => ({ ...f, height: v }))}
                  placeholder="175" placeholderTextColor={C.dim} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={s.inputLabel}>{t('goal', lang)}</Text>
            <TextInput style={s.inputField} value={form.goal}
              onChangeText={v => setForm(f => ({ ...f, goal: v }))}
              placeholder={t('goalPlaceholder', lang)} placeholderTextColor={C.dim} autoCapitalize="sentences" />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditModal(false)}>
                <Text style={{ color: C.muted, fontWeight: '700' }}>{t('cancel', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                <LinearGradient colors={['#e8f44a', '#a3c200']} style={s.saveGrad}>
                  {saving
                    ? <ActivityIndicator color={C.bg} size="small" />
                    : <Text style={{ color: C.bg, fontWeight: '900' }}>{t('save', lang)}</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  fill:    { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 48 },

  hero:            { alignItems: 'center', paddingTop: 28, paddingBottom: 28 },
  heroGrad:        { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  avatarWrap:      { marginBottom: 14 },
  avatarImg:       { width: 110, height: 110, borderRadius: 26, borderWidth: 2.5, borderColor: C.lime },
  avatarBox:       { width: 110, height: 110, borderRadius: 26, backgroundColor: C.s1, borderWidth: 2.5, borderColor: 'rgba(232,244,74,0.35)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInitials:  { color: C.lime, fontSize: 38, fontWeight: '900', letterSpacing: 2 },
  cameraBadge:     { position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  userName:        { color: C.text, fontSize: 24, fontWeight: '900', marginBottom: 6 },
  editLink:        { color: C.muted, fontSize: 13, marginBottom: 20 },
  heroStats:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 8 },
  heroStat:        { flex: 1, alignItems: 'center' },
  heroStatVal:     { color: C.text, fontSize: 20, fontWeight: '900' },
  heroStatLbl:     { color: C.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: C.border },

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
