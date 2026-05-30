import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { C } from '../utils/theme';
import { MEDIA_URLS } from '../utils/exerciseUrls';
import { saveWorkoutSession, getAllWorkoutLogs, getActiveProgram } from '../utils/storage';
import { useLang } from '../context/LanguageContext';
import { t, MONTHS_SHORT } from '../utils/i18n';

const MEDIA_MAP = MEDIA_URLS;

// Terminology (for pill display)
const TERM_KEYS = ['RIR','Failure','Süperset','Finisher'];
const TERIMLER = {
  tr: {
    'RIR':      'RIR = Reps In Reserve — Sete biterken hâlâ yapabileceğin tekrar sayısı.\nRIR 0 = Failure, RIR 1 = 1 tekrar kaldı.',
    'Failure':  'Kas Yetmezliği — 1 tekrar daha imkânsız olana kadar sürdür.',
    'Süperset': 'Süperset — İki hareketi dinlenmeksizin arka arkaya yap.',
    'Finisher': 'Finisher — Antrenman sonunda yapılan tamamlayıcı set.',
  },
  en: {
    'RIR':      'RIR = Reps In Reserve — How many reps you could still do at end of set.\nRIR 0 = Failure, RIR 1 = 1 rep left.',
    'Failure':  'Muscular Failure — Continue until one more rep is physically impossible.',
    'Superset': 'Superset — Perform two exercises back-to-back without rest.',
    'Finisher': 'Finisher — A finishing set done at the end of a workout.',
  },
};

function fmtDate(iso, lang) {
  const months = MONTHS_SHORT[lang] ?? MONTHS_SHORT.tr;
  const d = new Date(iso), now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return t('today', lang);
  if (diff === 1) return t('yesterday', lang);
  if (diff < 7)  return `${diff}${t('daysAgo', lang)}`;
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ─── TerimPill ─────────────────────────────────────────────────────────────────
function TerimPill({ terim, lang }) {
  const [open, setOpen] = useState(false);
  const aciklama = TERIMLER[lang]?.[terim] ?? TERIMLER.tr[terim];
  if (!aciklama) return <Text style={s.terimPlain}>{terim}</Text>;
  return (
    <>
      <TouchableOpacity style={s.terimPill} onPress={() => setOpen(true)}>
        <Text style={s.terimPillText}>{terim}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <Animated.View entering={FadeIn.duration(200)} style={s.terimModal}>
            <Text style={s.terimModalTitle}>{terim}</Text>
            <Text style={s.terimModalBody}>{aciklama}</Text>
            <TouchableOpacity style={s.terimModalClose} onPress={() => setOpen(false)}>
              <Text style={{ color: C.bg, fontWeight: '700' }}>{t('confirm', lang)}</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Exercise row ──────────────────────────────────────────────────────────────
function ExerciseRow({ hareket, onLog, lang }) {
  const name = typeof hareket === 'string' ? hareket : hareket.name;
  const gif  = Object.keys(MEDIA_MAP).find(k => name.startsWith(k));
  const gifSrc = gif ? MEDIA_MAP[gif] : null;

  // Parse RIR/sets from name if string
  const displayName = name.replace(/^\*Finisher:\s*/i, '');
  const isFinisher  = name.startsWith('*');

  const parts = [];
  let remaining = displayName;
  TERM_KEYS.forEach(tk => {
    const idx = remaining.indexOf(tk);
    if (idx !== -1) {
      if (idx > 0) parts.push({ type: 'text', val: remaining.slice(0, idx) });
      parts.push({ type: 'terim', val: tk });
      remaining = remaining.slice(idx + tk.length);
    }
  });
  if (remaining) parts.push({ type: 'text', val: remaining });

  return (
    <View style={s.exRow}>
      <View style={s.exBullet} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          {parts.map((p, i) =>
            p.type === 'terim'
              ? <TerimPill key={i} terim={p.val} lang={lang} />
              : <Text key={i} style={[s.exText, isFinisher && { color: C.orange }]}>{p.val}</Text>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 6 }}>
        {gifSrc && (
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="play-circle-outline" size={18} color={C.lime} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.logBtn} onPress={() => onLog(name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={16} color={C.teal} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main ProgramScreen ────────────────────────────────────────────────────────
export default function ProgramScreen() {
  const { lang } = useLang();
  const [activeProgram, setActiveProgramState] = useState(null);
  const [workoutLogs,   setWorkoutLogs]         = useState({});
  const [logModal,      setLogModal]             = useState(null);
  const [logSets,       setLogSets]              = useState([{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }]);
  const [open,          setOpen]                 = useState(true);

  useFocusEffect(useCallback(() => {
    getActiveProgram().then(p => setActiveProgramState(p));
    getAllWorkoutLogs().then(setWorkoutLogs);
  }, []));

  const openLog = (exerciseName) => {
    setLogModal({ name: exerciseName });
    // Always start with empty sets
    setLogSets([{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }]);
  };

  const saveLog = async () => {
    const valid = logSets
      .filter(s => s.reps || s.kg)
      .map(s => ({ reps: parseInt(s.reps) || 0, kg: parseFloat(s.kg) || 0 }));
    if (valid.length > 0) {
      await saveWorkoutSession(logModal.name, valid);
      setWorkoutLogs(await getAllWorkoutLogs());
    }
    setLogModal(null);
    // Reset inputs after save
    setLogSets([{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }]);
  };

  const updateSet = (i, field, val) =>
    setLogSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!activeProgram) {
    return (
      <View style={[s.fill, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Ionicons name="calendar-outline" size={56} color={C.dim} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>
          {lang === 'tr' ? 'Aktif Program Yok' : 'No Active Program'}
        </Text>
        <Text style={{ color: C.muted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          {lang === 'tr'
            ? 'Egzersiz → Antrenman sekmesinde bir antrenman oluşturup "Aktif Program Olarak Ayarla" butonuna bas.'
            : 'Go to Exercises → Workouts, create a workout and tap "Set as Active Program".'}
        </Text>
      </View>
    );
  }

  const exercises = activeProgram.exercises ?? [];

  return (
    <View style={s.fill}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Program card */}
        <Animated.View entering={FadeInDown.duration(320)}>
          <TouchableOpacity
            style={[s.card, open && { borderColor: C.lime + '55' }]}
            onPress={() => setOpen(v => !v)}
            activeOpacity={0.85}
          >
            <View style={[s.cardBar, { backgroundColor: C.lime }]} />
            <View style={s.cardHeader}>
              <View style={[s.tipBadge, { backgroundColor: C.lime + '20' }]}>
                <Text style={[s.tipText, { color: C.lime }]}>
                  {lang === 'tr' ? 'AKTİF PROGRAM' : 'ACTIVE PROGRAM'}
                </Text>
              </View>
              <Text style={s.cardTitle}>{activeProgram.title}</Text>
              {activeProgram.description ? (
                <Text style={s.cardDesc} numberOfLines={2}>{activeProgram.description}</Text>
              ) : null}
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={18} color={C.dim}
                style={{ position: 'absolute', right: 0, top: 0 }}
              />
            </View>

            {open && exercises.length > 0 && (
              <View style={s.exList}>
                {exercises.map((ex, j) => (
                  <ExerciseRow
                    key={j}
                    hareket={ex}
                    onLog={openLog}
                    lang={lang}
                  />
                ))}
              </View>
            )}

            {open && exercises.length === 0 && (
              <Text style={{ color: C.dim, fontSize: 12, padding: 14 }}>
                {lang === 'tr' ? 'Bu programda egzersiz yok.' : 'No exercises in this program.'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>

      {/* Log Modal */}
      {logModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setLogModal(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setLogModal(null)}>
              <TouchableOpacity activeOpacity={1} style={s.logModalBox} onPress={() => {}}>
                <Text style={s.logModalTitle}>{logModal.name}</Text>

                <View style={s.logHeader}>
                  <Text style={[s.logHeaderText, { width: 36 }]}>{t('set', lang)}</Text>
                  <Text style={[s.logHeaderText, { flex: 1 }]}>{t('reps', lang)}</Text>
                  <Text style={[s.logHeaderText, { flex: 1 }]}>{t('weightKg', lang)}</Text>
                </View>

                {logSets.map((set, i) => (
                  <View key={i} style={s.logRow}>
                    <View style={s.setNumBox}>
                      <Text style={s.setNumText}>{i + 1}</Text>
                    </View>
                    <TextInput
                      style={s.logInput} value={set.reps}
                      onChangeText={v => updateSet(i, 'reps', v)}
                      keyboardType="numeric" placeholder="—" placeholderTextColor={C.dim} maxLength={3}
                    />
                    <TextInput
                      style={s.logInput} value={set.kg}
                      onChangeText={v => updateSet(i, 'kg', v)}
                      keyboardType="decimal-pad" placeholder="—" placeholderTextColor={C.dim} maxLength={6}
                    />
                  </View>
                ))}

                <TouchableOpacity style={s.addSetBtn}
                  onPress={() => setLogSets(p => [...p, { reps: '', kg: '' }])}>
                  <Ionicons name="add-circle-outline" size={16} color={C.teal} />
                  <Text style={{ color: C.teal, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>
                    {t('addSet', lang)}
                  </Text>
                </TouchableOpacity>

                <View style={s.logActions}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setLogModal(null)}>
                    <Text style={{ color: C.muted, fontWeight: '700' }}>{t('cancel', lang)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.saveBtn} onPress={saveLog}>
                    <LinearGradient colors={['#e8f44a', '#a3c200']} style={s.saveGrad}>
                      <Text style={{ color: C.bg, fontWeight: '900' }}>{t('save_check', lang)}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fill:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },

  card:       { backgroundColor: C.s1, borderWidth: 1, borderColor: C.border, borderRadius: 16, marginBottom: 10, overflow: 'hidden' },
  cardBar:    { height: 3, width: '100%' },
  cardHeader: { padding: 14, paddingRight: 36 },
  cardTitle:  { color: C.text, fontSize: 16, fontWeight: '900', marginTop: 6, marginBottom: 4 },
  cardDesc:   { color: C.muted, fontSize: 12, lineHeight: 18 },
  tipBadge:   { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tipText:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  exList:   { paddingHorizontal: 14, paddingBottom: 14 },
  exRow:    { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  exBullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.dim, marginTop: 8 },
  exText:   { color: '#b0bec5', fontSize: 13, lineHeight: 20 },
  logBtn:   { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(20,184,166,0.15)', borderWidth: 1, borderColor: C.teal, alignItems: 'center', justifyContent: 'center' },

  terimPill:       { backgroundColor: 'rgba(56,189,248,0.15)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.35)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  terimPillText:   { color: C.blue, fontSize: 12, fontWeight: '700' },
  terimPlain:      { color: '#b0bec5', fontSize: 13 },
  terimModal:      { backgroundColor: C.s1, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border, maxWidth: 340, width: '100%' },
  terimModalTitle: { color: C.blue, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  terimModalBody:  { color: C.text, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  terimModalClose: { backgroundColor: C.blue, borderRadius: 10, padding: 12, alignItems: 'center' },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  logModalBox: { backgroundColor: C.s1, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: C.border, width: '100%', maxWidth: 400 },
  logModalTitle: { color: C.text, fontSize: 16, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  logHeader:     { flexDirection: 'row', gap: 8, marginBottom: 8 },
  logHeaderText: { color: C.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  logRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setNumBox:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  setNumText:    { color: C.lime, fontWeight: '800', fontSize: 12 },
  logInput:      { flex: 1, height: 36, backgroundColor: C.s2, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: C.text, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  addSetBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  logActions:    { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn:     { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  saveBtn:       { flex: 2, borderRadius: 12, overflow: 'hidden' },
  saveGrad:      { height: 46, alignItems: 'center', justifyContent: 'center' },
});
