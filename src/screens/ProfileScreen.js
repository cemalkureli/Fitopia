import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../utils/theme';
import { supabase, signOut, updateProfile } from '../lib/supabase';
import { getAllWorkoutLogs } from '../utils/storage';

function SettingRow({ icon, label, value, onPress, color, last }) {
  return (
    <TouchableOpacity
      style={[s.settingRow, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.settingIcon, { backgroundColor: (color ?? C.teal) + '18' }]}>
        <Ionicons name={icon} size={18} color={color ?? C.teal} />
      </View>
      <Text style={s.settingLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {value ? <Text style={s.settingValue}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={14} color={C.dim} />
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ onSignOut }) {
  const [user,        setUser]        = useState(null);
  const [profile,     setProfile]     = useState(null);
  const [logs,        setLogs]        = useState({});
  const [editModal,   setEditModal]   = useState(false);
  const [form,        setForm]        = useState({ full_name: '', weight: '', height: '', goal: '' });
  const [saving,      setSaving]      = useState(false);
  const [avatarUrl,   setAvatarUrl]   = useState(null);
  const [uploading,   setUploading]   = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
        const meta = data.user.user_metadata;
        setForm({
          full_name: meta?.full_name || '',
          weight:    '',
          height:    '',
          goal:      '',
        });
      }
    });

    supabase.auth.getUser().then(({ data: authData }) => {
      if (!authData?.user) return;
      supabase.from('profiles').select('*').eq('id', authData.user.id).single().then(({ data }) => {
        if (data) {
          setProfile(data);
          setAvatarUrl(data.avatar_url || null);
          setForm({
            full_name: data.full_name || '',
            weight:    String(data.weight || ''),
            height:    String(data.height || ''),
            goal:      data.goal || '',
          });
        }
      });
    });

    getAllWorkoutLogs().then(setLogs);
  }, []);

  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Sporcu';
  const initials = fullName.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

  const totalSessions = Object.values(logs).reduce((a, b) => a + b.length, 0);
  const totalSets     = Object.values(logs).reduce((a, b) => a + b.reduce((c, s) => c + (s.sets?.length ?? 0), 0), 0);
  const exerciseCount = Object.keys(logs).length;

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin Gerekli', 'Galeri erişimi için izin ver.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const asset    = result.assets[0];
      const ext      = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mime     = ext === 'png' ? 'image/png' : 'image/jpeg';
      const path     = `${user.id}/avatar.${ext}`;

      const response = await fetch(asset.uri);
      const blob     = await response.blob();
      const arr      = await blob.arrayBuffer();

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, arr, { contentType: mime, upsert: true });

      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;

      await updateProfile(user.id, { avatar_url: url });
      setAvatarUrl(url);
      setProfile(p => ({ ...p, avatar_url: url }));
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, {
        full_name: form.full_name,
        weight:    parseFloat(form.weight) || null,
        height:    parseFloat(form.height) || null,
        goal:      form.goal,
        email:     user.email,
      });
      setProfile(prev => ({ ...prev, ...form }));
      setEditModal(false);
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabından çıkmak istediğine emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap', style: 'destructive',
          onPress: async () => {
            try { await signOut(); } catch {}
            onSignOut?.();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={s.fill} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Avatar + isim */}
      <Animated.View entering={FadeInDown.duration(400)} style={s.avatarSection}>
        <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={s.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
          ) : (
            <LinearGradient colors={['#e8f44a', '#a3c200']} style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </LinearGradient>
          )}
          <View style={s.avatarEditBadge}>
            {uploading
              ? <ActivityIndicator size="small" color={C.bg} />
              : <Ionicons name="camera" size={14} color={C.bg} />
            }
          </View>
        </TouchableOpacity>
        <Text style={s.userName}>{fullName}</Text>
        <Text style={s.userEmail}>{user?.email}</Text>
        <TouchableOpacity style={s.editBtn} onPress={() => setEditModal(true)}>
          <Ionicons name="pencil-outline" size={14} color={C.lime} />
          <Text style={s.editBtnText}>Profili Düzenle</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Stats */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statVal}>{totalSessions}</Text>
          <Text style={s.statLbl}>Seans</Text>
        </View>
        <View style={[s.statItem, s.statBorder]}>
          <Text style={s.statVal}>{totalSets}</Text>
          <Text style={s.statLbl}>Toplam Set</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statVal}>{exerciseCount}</Text>
          <Text style={s.statLbl}>Egzersiz</Text>
        </View>
      </Animated.View>

      {/* Vücut bilgileri */}
      {(profile?.weight || profile?.height) && (
        <Animated.View entering={FadeInDown.delay(120).duration(380)} style={s.bodyCard}>
          <Text style={s.cardTitle}>Vücut Bilgileri</Text>
          <View style={s.bodyRow}>
            {profile?.weight && (
              <View style={s.bodyItem}>
                <Ionicons name="scale-outline" size={18} color={C.teal} />
                <Text style={s.bodyVal}>{profile.weight} kg</Text>
                <Text style={s.bodyLbl}>Ağırlık</Text>
              </View>
            )}
            {profile?.height && (
              <View style={s.bodyItem}>
                <Ionicons name="resize-outline" size={18} color={C.blue} />
                <Text style={s.bodyVal}>{profile.height} cm</Text>
                <Text style={s.bodyLbl}>Boy</Text>
              </View>
            )}
            {profile?.goal && (
              <View style={s.bodyItem}>
                <Ionicons name="flag-outline" size={18} color={C.lime} />
                <Text style={s.bodyVal} numberOfLines={1}>{profile.goal}</Text>
                <Text style={s.bodyLbl}>Hedef</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* Ayarlar */}
      <Animated.View entering={FadeInDown.delay(160).duration(380)} style={s.settingsCard}>
        <Text style={s.cardTitle}>Hesap</Text>
        <SettingRow icon="person-outline"    label="Profili Düzenle"    color={C.teal}   onPress={() => setEditModal(true)} />
        <SettingRow icon="notifications-outline" label="Bildirimler"   color={C.blue}   onPress={() => {}} value="Açık" />
        <SettingRow icon="shield-outline"    label="Gizlilik"           color={C.purple} onPress={() => {}} last />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(380)} style={s.settingsCard}>
        <Text style={s.cardTitle}>Uygulama</Text>
        <SettingRow icon="barbell-outline"   label="Ağırlık Birimi"     color={C.orange} onPress={() => {}} value="kg" />
        <SettingRow icon="moon-outline"      label="Tema"               color={C.dim}    onPress={() => {}} value="Karanlık" last />
      </Animated.View>

      {/* Çıkış */}
      <Animated.View entering={FadeInDown.delay(240).duration(380)}>
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={C.red} />
          <Text style={s.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Profil düzenleme modalı */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setEditModal(false)}>
          <Animated.View entering={FadeIn.duration(200)} style={s.editModal}>
            <Text style={s.editModalTitle}>Profili Düzenle</Text>

            <Text style={s.inputLabel}>Ad Soyad</Text>
            <TextInput
              style={s.inputField}
              value={form.full_name}
              onChangeText={v => setForm(f => ({ ...f, full_name: v }))}
              placeholder="Ad Soyad"
              placeholderTextColor={C.dim}
              autoCapitalize="words"
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Ağırlık (kg)</Text>
                <TextInput
                  style={s.inputField}
                  value={form.weight}
                  onChangeText={v => setForm(f => ({ ...f, weight: v }))}
                  placeholder="75"
                  placeholderTextColor={C.dim}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>Boy (cm)</Text>
                <TextInput
                  style={s.inputField}
                  value={form.height}
                  onChangeText={v => setForm(f => ({ ...f, height: v }))}
                  placeholder="175"
                  placeholderTextColor={C.dim}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={s.inputLabel}>Hedef</Text>
            <TextInput
              style={s.inputField}
              value={form.goal}
              onChangeText={v => setForm(f => ({ ...f, goal: v }))}
              placeholder="Kas yapma, zayıflama..."
              placeholderTextColor={C.dim}
              autoCapitalize="sentences"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditModal(false)}>
                <Text style={{ color: C.muted, fontWeight: '700' }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                <LinearGradient colors={['#e8f44a', '#a3c200']} style={s.saveGrad}>
                  {saving
                    ? <ActivityIndicator color={C.bg} size="small" />
                    : <Text style={{ color: C.bg, fontWeight: '900' }}>Kaydet</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill:       { flex: 1, backgroundColor: C.bg },
  content:    { padding: 16, paddingBottom: 40 },

  avatarSection:    { alignItems: 'center', paddingVertical: 24 },
  avatarWrap:       { marginBottom: 14 },
  avatar:           { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarImg:        { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: C.lime },
  avatarText:       { color: C.bg, fontSize: 32, fontWeight: '900' },
  avatarEditBadge:  { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  userName:   { color: C.text,  fontSize: 22, fontWeight: '900', marginBottom: 4 },
  userEmail:  { color: C.muted, fontSize: 13, marginBottom: 12 },
  editBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.lime + '40', backgroundColor: C.lime + '10' },
  editBtnText: { color: C.lime, fontSize: 13, fontWeight: '600' },

  statsRow:   { flexDirection: 'row', backgroundColor: C.s1, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  statItem:   { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border },
  statVal:    { color: C.text,  fontSize: 22, fontWeight: '900' },
  statLbl:    { color: C.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },

  bodyCard:   { backgroundColor: C.s1, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  cardTitle:  { color: C.text, fontSize: 13, fontWeight: '800', marginBottom: 14 },
  bodyRow:    { flexDirection: 'row', gap: 12 },
  bodyItem:   { flex: 1, alignItems: 'center', gap: 4 },
  bodyVal:    { color: C.text,  fontSize: 15, fontWeight: '800' },
  bodyLbl:    { color: C.muted, fontSize: 10, fontWeight: '600' },

  settingsCard: { backgroundColor: C.s1, borderRadius: 18, borderWidth: 1, borderColor: C.border, marginBottom: 14, overflow: 'hidden', padding: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, color: C.text, fontSize: 14, fontWeight: '600' },
  settingValue: { color: C.muted, fontSize: 13 },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.red + '40', backgroundColor: C.red + '10' },
  signOutText: { color: C.red, fontSize: 15, fontWeight: '700' },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  editModal:  { backgroundColor: C.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: C.border },
  editModalTitle: { color: C.text, fontSize: 18, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  inputLabel: { color: C.muted, fontSize: 11, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  inputField: { backgroundColor: C.s2, borderRadius: 12, borderWidth: 1, borderColor: C.border, height: 46, paddingHorizontal: 14, color: C.text, fontSize: 15, fontWeight: '500', marginBottom: 4 },
  cancelBtn:  { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  saveBtn:    { flex: 2, borderRadius: 12, overflow: 'hidden' },
  saveGrad:   { height: 46, alignItems: 'center', justifyContent: 'center' },
});
