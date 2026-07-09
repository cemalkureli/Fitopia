import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { C } from '../utils/theme';
import { EXERCISES, gifUrl } from '../data/exercises';
import ExerciseMedia from '../components/ExerciseMedia';
import { saveWorkoutSession, getAllWorkoutLogs, getActiveProgram, clearActiveProgram } from '../utils/storage';
import { TRAINING_PLANS } from '../data/trainingPlans';
import { useToast, ConfirmModal } from '../components/Toast';
import { useLang } from '../context/LanguageContext';
import { t, MONTHS_SHORT } from '../utils/i18n';

// Statik plan egzersiz adı → GIF: yerel dataset'te ada göre (tam veya içeren) eşle.
const NAME_INDEX = EXERCISES.map(e => ({ lc: e.name.toLowerCase(), m: e.m }));
function resolveGif(cleanName) {
  if (!cleanName) return null;
  const q = cleanName.toLowerCase();
  const hit = NAME_INDEX.find(x => x.lc === q) || NAME_INDEX.find(x => x.lc.includes(q) || q.includes(x.lc));
  return hit ? gifUrl(hit.m) : null;
}

// TERM_REGEX: RIR, set×rep, Failure, Süperset, Finisher — hepsi badge olarak gösterilir
const TERM_REGEX = /(RIR\s*\d+|RIR|\d+[×x]\d+(?:-\d+)?|Failure|Süperset|Superset|Finisher)/g;

// Set/rep gibi nötr badge — modal yok
function RepBadge({ val }) {
  return (
    <View style={s.repBadge}>
      <Text style={s.repBadgeTxt}>{val}</Text>
    </View>
  );
}
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
  // "RIR1" veya "RIR 2" → lookup key "RIR", display "RIR 1" / "RIR 2"
  const lookupKey  = terim.startsWith('RIR') ? 'RIR' : terim;
  const displayVal = terim.startsWith('RIR') && terim.replace('RIR','').trim()
    ? 'RIR ' + terim.replace('RIR','').trim()
    : terim;
  const aciklama = TERIMLER[lang]?.[lookupKey] ?? TERIMLER.tr[lookupKey];
  if (!aciklama) return <Text style={s.terimPlain}>{displayVal}</Text>;
  return (
    <>
      <TouchableOpacity style={s.terimPill} onPress={() => setOpen(true)}>
        <Text style={s.terimPillText}>{displayVal}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <Animated.View entering={FadeIn.duration(200)} style={s.terimModal}>
            <Text style={s.terimModalTitle}>{displayVal}</Text>
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

// ─── Day card (expandable) ────────────────────────────────────────────────────
const DAY_NAMES_TR = { 0:'Pazar', 1:'Pazartesi', 2:'Salı', 3:'Çarşamba', 4:'Perşembe', 5:'Cuma', 6:'Cumartesi' };
const DAY_NAMES_EN = { 0:'Sunday', 1:'Monday', 2:'Tuesday', 3:'Wednesday', 4:'Thursday', 5:'Friday', 6:'Saturday' };

function DayCard({ workout, index, workoutLogs, onLog, onPlay, lang, open, onToggle, mediaMap }) {
  const exercises = workout.exercises ?? [];
  const DAY_COLORS = [C.lime, C.blue, C.orange, C.teal, C.purple, C.green, C.red];
  const color = DAY_COLORS[index % DAY_COLORS.length];

  // dayOfWeek varsa gerçek gün adını göster
  const hasDow = workout.dayOfWeek !== undefined && workout.dayOfWeek !== null;
  const dayLabel = hasDow
    ? (lang === 'tr' ? DAY_NAMES_TR[workout.dayOfWeek] : DAY_NAMES_EN[workout.dayOfWeek])
    : `${t('dayN', lang)} ${index + 1}`;
  const workoutName = lang === 'en' && workout.name_en ? workout.name_en : workout.name;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(320)}>
      <TouchableOpacity
        style={[s.card, open && { borderColor: color + '55' }]}
        onPress={() => onToggle(index)}
        activeOpacity={0.85}
      >
        <View style={[s.cardBar, { backgroundColor: color }]} />
        <View style={s.cardHeader}>
          <View style={[s.tipBadge, { backgroundColor: color + '20' }]}>
            <Text style={[s.tipText, { color }]}>{dayLabel}</Text>
          </View>
          <Text style={s.cardTitle}>{workoutName}</Text>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18} color={C.dim}
            style={{ position: 'absolute', right: 0, top: 0 }}
          />
        </View>

        {open && exercises.length > 0 && (
          <View style={s.exList}>
            {exercises.map((ex, j) => (
              <ExerciseRow key={j} hareket={ex} onLog={onLog} onPlay={onPlay} lang={lang} mediaMap={mediaMap} />
            ))}
          </View>
        )}

        {open && exercises.length === 0 && (
          <Text style={{ color: C.dim, fontSize: 12, padding: 14 }}>
            {t('noExercises', lang)}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Exercise row ──────────────────────────────────────────────────────────────
function ExerciseRow({ hareket, onLog, lang, onPlay, mediaMap = {} }) {
  const name = typeof hareket === 'string' ? hareket : hareket.name;
  // Temiz isim: "Lat Pulldown 2×6-8 RIR1-Failure" → "Lat Pulldown"
  const cleanName = name
    .replace(/\s+\d+[×x].+/, '')
    .replace(/\s+(RIR|Failure|Superset|Süperset|Finisher).+/i, '')
    .trim();
  // Önce parent'ın önceden çözdüğü harita, yoksa yerel dataset'ten ada göre GIF
  const gifSrc = mediaMap[cleanName] ?? resolveGif(cleanName);

  const displayName = name.replace(/^\*Finisher:\s*/i, '');
  const isFinisher  = name.startsWith('*');

  // TERM_REGEX: "RIR1", "RIR 2", "Failure", "Süperset", "Finisher" tek parça
  const parts = [];
  let lastIdx = 0;
  TERM_REGEX.lastIndex = 0;
  let match;
  while ((match = TERM_REGEX.exec(displayName)) !== null) {
    if (match.index > lastIdx)
      parts.push({ type: 'text', val: displayName.slice(lastIdx, match.index) });
    parts.push({ type: 'terim', val: match[0] });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < displayName.length)
    parts.push({ type: 'text', val: displayName.slice(lastIdx) });

  return (
    <View style={s.exRow}>
      <View style={s.exBullet} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          {parts.map((p, i) => {
            if (p.type !== 'terim') return (
              <Text key={i} style={[s.exText, isFinisher && { color: C.orange }]}>{p.val}</Text>
            );
            // set×rep pattern → RepBadge, geri kalanlar → TerimPill
            if (/^\d+[×x]\d+/.test(p.val)) return <RepBadge key={i} val={p.val} />;
            return <TerimPill key={i} terim={p.val} lang={lang} />;
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 6 }}>
        {gifSrc && (
          <TouchableOpacity onPress={() => onPlay?.(gifSrc, cleanName)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="play-circle-outline" size={20} color={C.lime} />
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
  const { lang }   = useLang();
  const route      = useRoute();
  const focusDay   = route.params?.focusDay; // dayOfWeek passed from HomeScreen
  const [activeProgram, setActiveProgramState] = useState(null);
  const [workoutLogs,   setWorkoutLogs]         = useState({});
  const [logModal,      setLogModal]             = useState(null);
  const [logSets,       setLogSets]              = useState([{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }]);
  const [open,          setOpen]                 = useState(true);
  const [confirmClear,  setConfirmClear]         = useState(false);
  const [mediaModal,    setMediaModal]           = useState(null);
  const [openCards,     setOpenCards]            = useState({});
  const [mediaMap,      setMediaMap]             = useState({}); // { cleanName: webm_url }
  const { show: showToast, ToastNode }           = useToast();

  useFocusEffect(useCallback(() => {
    getActiveProgram().then(async p => {
      // Kayıtlı programda description_en yoksa TRAINING_PLANS'tan tamamla
      if (p && !p.description_en) {
        const template = TRAINING_PLANS.find(tp => tp.id === p.id);
        if (template?.description_en) p = { ...p, description_en: template.description_en };
      }
      setActiveProgramState(p);
      const workouts = p?.workouts ?? [];
      const next = {};
      workouts.forEach((w, i) => {
        next[i] = focusDay !== undefined ? w.dayOfWeek === focusDay : false;
      });
      setOpenCards(next);

      // Yerel dataset'ten ada göre GIF haritası kur (Supabase yok)
      const allEx = workouts.flatMap(w => w.exercises ?? []);
      const cleanNames = [...new Set(allEx.map(e => {
        const s = typeof e === 'string' ? e : e.name;
        return s.replace(/\s+\d+[×x].+/, '').replace(/\s+(RIR|Failure|Superset|Süperset|Finisher).+/i, '').trim();
      }).filter(Boolean))];

      const map = {};
      cleanNames.forEach(cn => { const g = resolveGif(cn); if (g) map[cn] = g; });
      setMediaMap(map);
    });
    getAllWorkoutLogs().then(setWorkoutLogs);
    return () => setOpenCards({});
  }, [focusDay]));

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
    // Make sure confirmClear doesn't linger
    if (confirmClear) setConfirmClear(false);
    return (
      <View style={[s.fill, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Ionicons name="calendar-outline" size={56} color={C.dim} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginTop: 16, textAlign: 'center' }}>
          {t('noActiveProgram', lang)}
        </Text>
        <Text style={{ color: C.muted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          {t('noActiveProgramDesc', lang)}
        </Text>
      </View>
    );
  }

  // Support both old format (exercises[]) and new format (workouts[])
  const workouts = activeProgram.workouts
    ? activeProgram.workouts
    : activeProgram.exercises?.length
      ? [{ name: activeProgram.title, exercises: activeProgram.exercises }]
      : [];

  return (
    <View style={[s.fill, { position: 'relative' }]}>
      {ToastNode}
      <ConfirmModal
        visible={confirmClear}
        title={t('removeProgram', lang)}
        message={`"${activeProgram?.title}" ${t('removeProgramMsg', lang)}`}
        confirmLabel={t('remove', lang)}
        confirmColor="#dc2626"
        lang={lang}
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await clearActiveProgram();
          setActiveProgramState(null);
          setConfirmClear(false);
          showToast(t('programRemoved', lang), 'error');
        }}
      />

      {/* Clear button top-right */}
      <View style={s.clearBtnWrap}>
        <TouchableOpacity
          style={s.clearBtn}
          onPress={() => setConfirmClear(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle-outline" size={20} color={C.red} />
          <Text style={s.clearBtnTxt}>{t('removeProgram', lang)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Program header */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.programHeader}>
          <View style={[s.tipBadge, { backgroundColor: C.lime + '20', marginBottom: 6 }]}>
            <Text style={[s.tipText, { color: C.lime }]}>
              {t('activeProgram', lang)}
            </Text>
          </View>
          <Text style={s.programTitle}>{activeProgram.title}</Text>
          {activeProgram.description ? (
            <Text style={s.cardDesc} numberOfLines={2}>
              {lang === 'en' && activeProgram.description_en ? activeProgram.description_en : activeProgram.description}
            </Text>
          ) : null}
        </Animated.View>

        {/* Workout day cards */}
        {workouts.map((w, wi) => (
          <DayCard
            key={wi}
            workout={w}
            index={wi}
            workoutLogs={workoutLogs}
            onLog={openLog}
            onPlay={(src, name) => setMediaModal({ src, name })}
            lang={lang}
            open={!!openCards[wi]}
            mediaMap={mediaMap}
            onToggle={i => setOpenCards(prev => ({ ...prev, [i]: !prev[i] }))}
          />
        ))}

        {workouts.length === 0 && (
          <Text style={{ color: C.dim, fontSize: 12, textAlign: 'center', marginTop: 24 }}>
            {t('noExercisesInProgram', lang)}
          </Text>
        )}

      </ScrollView>

      {/* Egzersiz medya modalı */}
      <Modal visible={!!mediaModal} transparent animationType="fade" onRequestClose={() => setMediaModal(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1} onPress={() => setMediaModal(null)}>
          <View style={{ width: '90%', backgroundColor: C.s1, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: '100%', height: 240, backgroundColor: C.s2 }}>
              <ExerciseMedia source={mediaModal?.src} style={{ width: '100%', height: 240 }} />
            </View>
            <View style={{ padding: 16 }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 12 }} numberOfLines={2}>
                {mediaModal?.name}
              </Text>
              <TouchableOpacity onPress={() => setMediaModal(null)}
                style={{ backgroundColor: C.s2, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontWeight: '700' }}>{t('close', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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

  clearBtnWrap: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  clearBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.08)' },
  clearBtnTxt:  { color: C.red, fontSize: 12, fontWeight: '600' },
  programHeader: { marginBottom: 16 },
  programTitle:  { color: C.text, fontSize: 20, fontWeight: '900', marginBottom: 4 },
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

  repBadge:        { backgroundColor: 'rgba(232,244,74,0.12)', borderWidth: 1, borderColor: 'rgba(232,244,74,0.3)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  repBadgeTxt:     { color: C.lime, fontSize: 12, fontWeight: '700' },
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
