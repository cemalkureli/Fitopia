import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Dimensions, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import ExerciseMedia from '../components/ExerciseMedia';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { C } from '../utils/theme';
import { MEDIA_URLS } from '../utils/exerciseUrls';
import { getBarfiksReps, saveWorkoutSession, getAllWorkoutLogs } from '../utils/storage';
import { useLang } from '../context/LanguageContext';
import { t, PROGRAM_DAYS, MONTHS_SHORT } from '../utils/i18n';

const { width } = Dimensions.get('window');

const TERIMLER = {
  tr: {
    'RIR1':     'RIR = Reps In Reserve (Kasada Kalan Tekrar)\nRIR1 → Sete biterken hâlâ 1 tekrar yapabileceksin. Kontrollü yorgunluk. Kas büyümesi için ideal.',
    'RIR2':     'RIR2 → Sete biterken 2 tekrar yapabileceksin. Daha hafif, form öğrenmek için.',
    'Failure':  'Failure (Kas Yetmezliği) → 1 tekrar daha fiziksel olarak imkânsız olana kadar sürdür. Maksimum kas stimülasyonu.',
    'Süperset': 'Süperset → İki hareketi dinlenmeksizin arka arkaya yap. Antrenman süresini kısaltır.',
    'Finisher': 'Finisher → Antrenman sonunda yapılan tamamlayıcı set. Kası tamamen tüketmek için.',
  },
  en: {
    'RIR1':     'RIR = Reps In Reserve\nRIR1 → You could do 1 more rep at the end of the set. Controlled fatigue. Ideal for muscle growth.',
    'RIR2':     'RIR2 → You could do 2 more reps at the end of the set. Lighter load, good for learning form.',
    'Failure':  'Failure (Muscular Failure) → Continue until one more rep is physically impossible. Maximum muscle stimulation.',
    'Süperset': 'Superset → Perform two exercises back-to-back without rest. Shortens workout duration.',
    'Finisher': 'Finisher → A finishing set done at the end of a workout. Used to completely exhaust the muscle.',
  },
};

const TERM_KEYS = Object.keys(TERIMLER.tr);

const MEDIA_MAP = MEDIA_URLS;

// tipKey maps to i18n keys: 'rest' | 'push' | 'pull' | 'legsArms'
const GUNLER = [
  { dayKey: 0, tipKey: 'rest',     renk: C.muted,  emoji: '🛌', hareketler: ['Vakum hareketi 3×15 sn', 'Ev içi yürüyüş (öğünler sonrası 1000 adım × 3)'] },
  { dayKey: 1, tipKey: 'push',     renk: C.lime,   emoji: '💪', hareketler: ['Plate Loaded Chest Press 2×5-6 RIR1', 'Smith Machine Low Incline Press 2×5-6 RIR1', 'Chest Fly Machine 1×6-8 Failure', 'Shoulder Press Machine 2×6-8 RIR1', 'Lateral Raise 3×8-10 Failure', 'Triceps Pushdown 2×6-8 Failure', 'Overhead Rope Extension 2×8-10 Failure', '*Finisher: Cable Crunch 3×10'] },
  { dayKey: 2, tipKey: 'pull',     renk: C.blue,   emoji: '🔵', hareketler: ['Lat Pulldown 2×6-8 RIR1-Failure', 'Plate Loaded Wide Grip Row 3×6-8 RIR1-Failure', 'Cable Row 1×8-10 Failure', 'Incline Dumbbell Curl 2×6-8 Failure', 'Cable Curl 2×6-8 Failure', 'Hammer Curl + Reverse Barbell Curl 2×8-10 (Süperset)'] },
  { dayKey: 3, tipKey: 'legsArms', renk: C.orange, emoji: '🦵', hareketler: ['Leg Press 2×6-8 RIR1-2', 'Smith Machine Squat 2×6-8 RIR1-2', 'Leg Extension 2×8-10 Failure', 'Seated Leg Curl 3×8-10 RIR1', 'Wrist Curl 3×12-15 Failure', 'Reverse Wrist Curl 3×12-15 Failure', 'Cable Crunch 3×12-15'] },
  { dayKey: 4, tipKey: 'rest',     renk: C.muted,  emoji: '🛌', hareketler: ['Vakum hareketi 3×15 sn', 'Ev içi yürüyüş (öğünler sonrası 1000 adım × 3)'] },
  { dayKey: 5, tipKey: 'push',     renk: C.lime,   emoji: '💪', hareketler: ['Shoulder Press Machine 2×6-8 RIR1', 'Lateral Raise 3×8-10 Failure', 'Smith Machine Low Incline Press 2×5-6 RIR1', 'Chest Fly Machine 2×6-8 Failure', 'Cable Rear Delt Fly 2×8-10 Failure', 'Triceps Pushdown 2×6-8 Failure', 'Overhead Rope Extension 2×8-10 Failure'] },
  { dayKey: 6, tipKey: 'pull',     renk: C.blue,   emoji: '🔵', hareketler: ['Plate Loaded Wide Grip Row 3×6-8 RIR1-Failure', 'Lat Pulldown 3×6-8 RIR1-Failure', 'Romanian Deadlift 2×5-6 RIR1-2', 'Cable Curl 2×6-8 Failure', 'Hammer Curl + Reverse Curl 2×8-10 (Süperset)', 'Leg Extension 2×6-8 Failure', 'Seated Leg Curl 1×8-10 Failure'] },
];

function extractExName(hareket) {
  let h = hareket.replace(/^\*Finisher:\s*/i, '');
  const m = h.match(/^(.*?)\s+\d+[×x]/);
  return m ? m[1].trim() : null;
}

function getMedia(h) {
  for (const k of Object.keys(MEDIA_MAP)) {
    if (h.startsWith(k)) return MEDIA_MAP[k];
  }
  return null;
}

function fmtDate(iso, lang) {
  const months = MONTHS_SHORT[lang] ?? MONTHS_SHORT.tr;
  const d = new Date(iso), now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return t('today', lang);
  if (diff === 1) return t('yesterday', lang);
  if (diff < 7)  return `${diff}${t('daysAgo', lang)}`;
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function fmtSets(sets) {
  if (!sets?.length) return '';
  const kgs = [...new Set(sets.map(s => s.kg))];
  const kg  = kgs.length === 1 ? `${kgs[0]}kg` : `${sets[0].kg}-${sets[sets.length - 1].kg}kg`;
  return `${sets.length}×${sets[0].reps} @${kg}`;
}

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

function HareketRow({ hareket, onPressGif, onPressLog, lastSet, lang }) {
  const gif    = getMedia(hareket);
  const exName = extractExName(hareket);
  const parts  = [];
  let remaining = hareket;
  let safe = 0;
  while (remaining.length > 0 && safe++ < 50) {
    let pos = Infinity, found = null;
    for (const tk of TERM_KEYS) {
      const i = remaining.indexOf(tk);
      if (i !== -1 && i < pos) { pos = i; found = tk; }
    }
    if (!found) { parts.push({ type: 'text', val: remaining }); break; }
    if (pos > 0) parts.push({ type: 'text', val: remaining.slice(0, pos) });
    parts.push({ type: 'terim', val: found });
    remaining = remaining.slice(pos + found.length);
  }

  return (
    <View style={s.hareketRow}>
      <View style={s.hareketBulletWrap}><View style={s.hareketBullet} /></View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          {parts.map((p, i) => p.type === 'terim'
            ? <TerimPill key={i} terim={p.val} lang={lang} />
            : <Text key={i} style={s.hareketText}>{p.val}</Text>
          )}
        </View>
        {lastSet && <Text style={s.lastSetText}>↩ {lastSet}</Text>}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
        {gif && (
          <TouchableOpacity onPress={() => onPressGif(hareket, gif)} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="play-circle-outline" size={18} color={C.lime} />
          </TouchableOpacity>
        )}
        {exName && (
          <TouchableOpacity onPress={() => onPressLog(exName)} style={s.logBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="add" size={16} color={C.teal} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function GunKarti({ g, index, workoutLogs, onPressGif, onPressLog, lang }) {
  const [open, setOpen] = useState(false);
  const days = PROGRAM_DAYS[lang] ?? PROGRAM_DAYS.tr;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(380)}>
      <TouchableOpacity
        style={[s.card, open && { borderColor: g.renk + '66' }]}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.85}
      >
        <View style={[s.cardBar, { backgroundColor: g.renk }]} />
        <View style={s.cardHeader}>
          <Text style={s.cardEmoji}>{g.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.cardDay}>{days[g.dayKey]}</Text>
            <View style={[s.tipBadge, { backgroundColor: g.renk + '20' }]}>
              <Text style={[s.tipText, { color: g.renk }]}>{t(g.tipKey, lang)}</Text>
            </View>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.dim} />
        </View>

        {open && (
          <View style={s.hareketList}>
            {g.hareketler.map((h, j) => {
              const exName  = extractExName(h);
              const hist    = exName ? (workoutLogs[exName] || []) : [];
              const lastSet = hist[0] ? `${fmtSets(hist[0].sets)} · ${fmtDate(hist[0].date, lang)}` : null;
              return (
                <HareketRow
                  key={j}
                  hareket={h}
                  onPressGif={onPressGif}
                  onPressLog={onPressLog}
                  lastSet={lastSet}
                  lang={lang}
                />
              );
            })}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ProgramScreen() {
  const { lang } = useLang();
  const reps  = getBarfiksReps();
  const [workoutLogs, setWorkoutLogs] = useState({});
  const [gifModal,    setGifModal]    = useState(null);
  const [logModal,    setLogModal]    = useState(null);
  const [logSets,     setLogSets]     = useState([{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }]);

  useFocusEffect(useCallback(() => {
    getAllWorkoutLogs().then(setWorkoutLogs);
  }, []));

  const openGif = (name, source) => setGifModal({ name, source });

  const openLog = (exerciseName) => {
    const history = workoutLogs[exerciseName] || [];
    const last    = history[0] || null;
    setLogModal({ name: exerciseName, lastSession: last });
    setLogSets(last?.sets
      ? last.sets.map(s => ({ reps: String(s.reps), kg: String(s.kg) }))
      : [{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }]
    );
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
  };

  const updateSet = (i, field, val) =>
    setLogSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  return (
    <View style={s.fill}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Günler */}
        {GUNLER.map((g, i) => (
          <GunKarti
            key={i}
            g={g}
            index={i}
            workoutLogs={workoutLogs}
            onPressGif={openGif}
            onPressLog={openLog}
            lang={lang}
          />
        ))}
      </ScrollView>

      {/* GIF Modal */}
      {gifModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setGifModal(null)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setGifModal(null)}>
            <Animated.View entering={FadeIn.duration(200)} style={s.gifModal}>
              <Text style={s.gifModalTitle} numberOfLines={2}>{gifModal.name}</Text>
              <View style={s.gifContainer}>
                <ExerciseMedia source={gifModal.source} style={{ width: '100%', height: '100%' }} />
              </View>
              <Text style={s.gifClose}>{t('tapToClose', lang)}</Text>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Antrenman Kayıt Modalı */}
      {logModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setLogModal(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setLogModal(null)}>
              <TouchableOpacity activeOpacity={1} style={s.logModalBox} onPress={() => {}}>
                <Text style={s.logModalTitle}>{logModal.name}</Text>

                {logModal.lastSession && (
                  <View style={s.prevSessionBox}>
                    <Text style={s.prevLabel}>{t('prevSession', lang)}</Text>
                    <Text style={s.prevVal}>
                      {fmtDate(logModal.lastSession.date, lang)} — {fmtSets(logModal.lastSession.sets)}
                    </Text>
                  </View>
                )}

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
                      style={s.logInput}
                      value={set.reps}
                      onChangeText={v => updateSet(i, 'reps', v)}
                      keyboardType="numeric"
                      placeholder="—"
                      placeholderTextColor={C.dim}
                      maxLength={3}
                    />
                    <TextInput
                      style={s.logInput}
                      value={set.kg}
                      onChangeText={v => updateSet(i, 'kg', v)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={C.dim}
                      maxLength={6}
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
  fill:       { flex: 1, backgroundColor: C.bg },
  content:    { padding: 16, paddingBottom: 32 },

  infoCard:     { backgroundColor: 'rgba(232,244,74,0.06)', borderWidth: 1, borderColor: 'rgba(232,244,74,0.2)', borderRadius: 16, padding: 14, marginBottom: 12 },
  infoCardBlue: { backgroundColor: 'rgba(56,189,248,0.06)', borderColor: 'rgba(56,189,248,0.2)' },
  infoTitle:    { color: C.lime, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  infoText:     { color: C.muted, fontSize: 12, lineHeight: 18 },

  card:       { backgroundColor: C.s1, borderWidth: 1, borderColor: C.border, borderRadius: 16, marginBottom: 10, overflow: 'hidden' },
  cardBar:    { height: 3, width: '100%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  cardEmoji:  { fontSize: 20 },
  cardDay:    { color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  tipBadge:   { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tipText:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  hareketList:       { paddingHorizontal: 14, paddingBottom: 14 },
  hareketRow:        { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  hareketBulletWrap: { paddingTop: 6 },
  hareketBullet:     { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.dim },
  hareketText:       { color: '#b0bec5', fontSize: 13, lineHeight: 20 },
  lastSetText:       { color: C.dim, fontSize: 10, marginTop: 2 },
  iconBtn:           { padding: 2 },
  logBtn:            { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(20,184,166,0.15)', borderWidth: 1, borderColor: C.teal, alignItems: 'center', justifyContent: 'center' },

  terimPill:       { backgroundColor: 'rgba(56,189,248,0.15)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.35)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  terimPillText:   { color: C.blue, fontSize: 12, fontWeight: '700' },
  terimPlain:      { color: '#b0bec5', fontSize: 13 },
  terimModal:      { backgroundColor: C.s1, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border, maxWidth: 340, width: '100%' },
  terimModalTitle: { color: C.blue, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  terimModalBody:  { color: C.text, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  terimModalClose: { backgroundColor: C.blue, borderRadius: 10, padding: 12, alignItems: 'center' },

  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  gifModal:      { backgroundColor: C.s1, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center', width: '100%', maxWidth: 400 },
  gifModalTitle: { color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  gifContainer:  { width: width - 80, height: width - 80, borderRadius: 12, overflow: 'hidden', backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center' },
  gifClose:      { color: C.dim, fontSize: 12, marginTop: 10 },

  logModalBox:    { backgroundColor: C.s1, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: C.border, width: '100%', maxWidth: 400 },
  logModalTitle:  { color: C.text, fontSize: 16, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  prevSessionBox: { backgroundColor: 'rgba(232,244,74,0.06)', borderRadius: 12, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(232,244,74,0.2)' },
  prevLabel:      { color: C.muted, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  prevVal:        { color: C.lime,  fontSize: 12, fontWeight: '700' },
  logHeader:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  logHeaderText:  { color: C.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  logRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setNumBox:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  setNumText:     { color: C.lime, fontWeight: '800', fontSize: 12 },
  logInput:       { flex: 1, height: 36, backgroundColor: C.s2, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: C.text, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  addSetBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  logActions:     { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn:      { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  saveBtn:        { flex: 2, borderRadius: 12, overflow: 'hidden' },
  saveGrad:       { height: 46, alignItems: 'center', justifyContent: 'center' },
});
