import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Dimensions, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeIn, FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { C } from '../utils/theme';
import { saveWorkoutSession, getAllWorkoutLogs } from '../utils/storage';
import { useLang } from '../context/LanguageContext';
import { t, MONTHS_SHORT } from '../utils/i18n';

const { width } = Dimensions.get('window');

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
  const kg  = kgs.length === 1 ? `${kgs[0]}kg` : `${sets[0].kg}-${sets[sets.length-1].kg}kg`;
  return `${sets.length}×${sets[0].reps} @${kg}`;
}

function calcBestSet(sessions) {
  let best = null;
  sessions.forEach(s => {
    s.sets?.forEach(set => {
      const vol = (set.reps || 0) * (set.kg || 0);
      if (!best || vol > best.vol) best = { ...set, vol, date: s.date };
    });
  });
  return best;
}

function MiniChart({ sessions }) {
  if (sessions.length < 2) return null;
  const last7 = sessions.slice(0, 7).reverse();
  const vols  = last7.map(s => s.sets?.reduce((a, x) => a + (x.reps || 0) * (x.kg || 0), 0) || 0);
  const max   = Math.max(...vols, 1);
  return (
    <View style={mc.wrap}>
      {vols.map((v, i) => (
        <View key={i} style={mc.barWrap}>
          <View style={[mc.bar, { height: Math.max(4, (v / max) * 36) }]} />
        </View>
      ))}
    </View>
  );
}

const mc = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40, marginTop: 8 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:     { width: '100%', backgroundColor: C.teal, borderRadius: 3, minHeight: 4 },
});

function ExerciseCard({ name, sessions, onLog, index, lang }) {
  const [expanded, setExpanded] = useState(false);
  const last  = sessions[0];
  const best  = calcBestSet(sessions);
  const trend = sessions.length >= 2 && sessions[0].sets && sessions[1].sets
    ? (sessions[0].sets[0]?.kg || 0) >= (sessions[1].sets[0]?.kg || 0) ? 'up' : 'down'
    : null;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(380)}>
      <View style={[s.exCard, expanded && { borderColor: C.lime + '44' }]}>
        <TouchableOpacity
          style={s.exCardHeader}
          onPress={() => setExpanded(v => !v)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <View style={s.exNameRow}>
              <Text style={s.exName} numberOfLines={1}>{name}</Text>
              {trend === 'up'   && <Ionicons name="trending-up"   size={14} color={C.green}  style={{ marginLeft: 6 }} />}
              {trend === 'down' && <Ionicons name="trending-down" size={14} color={C.red}    style={{ marginLeft: 6 }} />}
            </View>
            {last
              ? <Text style={s.exLast}>{fmtDate(last.date, lang)} — {fmtSets(last.sets)}</Text>
              : <Text style={s.exNoData}>{t('noRecord', lang)}</Text>
            }
          </View>
          <View style={s.exActions}>
            <TouchableOpacity style={s.addBtn} onPress={() => onLog(name)}>
              <Ionicons name="add" size={18} color={C.lime} />
            </TouchableOpacity>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.dim} />
          </View>
        </TouchableOpacity>

        {sessions.length >= 2 && <MiniChart sessions={sessions} />}

        {expanded && (
          <View style={s.historyWrap}>
            {best && (
              <View style={s.prRow}>
                <Ionicons name="trophy-outline" size={13} color={C.orange} />
                <Text style={s.prText}>
                  PR: {best.reps}t × {best.kg}kg — {fmtDate(best.date, lang)}
                </Text>
              </View>
            )}
            {sessions.slice(0, 10).map((session, j) => (
              <Animated.View key={j} entering={FadeInRight.delay(j * 40).duration(280)} style={s.sessionRow}>
                <Text style={s.sessionDate}>{fmtDate(session.date, lang)}</Text>
                <View style={s.chipRow}>
                  {session.sets?.map((set, k) => (
                    <View key={k} style={s.setChip}>
                      <Text style={s.setChipText}>{set.reps}t · {set.kg}kg</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const EXERCISE_LIST = [
  'Plate Loaded Chest Press','Smith Machine Low Incline Press','Chest Fly Machine',
  'Shoulder Press Machine','Lateral Raise','Triceps Pushdown','Overhead Rope Extension',
  'Cable Crunch','Lat Pulldown','Plate Loaded Wide Grip Row','Cable Row',
  'Incline Dumbbell Curl','Cable Curl','Hammer Curl','Leg Press',
  'Smith Machine Squat','Leg Extension','Seated Leg Curl','Wrist Curl',
  'Reverse Wrist Curl','Romanian Deadlift','Cable Rear Delt Fly',
];

export default function ProgressScreen() {
  const { lang } = useLang();
  const [workoutLogs, setWorkoutLogs] = useState({});
  const [logModal,    setLogModal]    = useState(null);
  const [logSets,     setLogSets]     = useState([{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }]);
  const [filter,      setFilter]      = useState('all');

  useFocusEffect(useCallback(() => {
    getAllWorkoutLogs().then(setWorkoutLogs);
  }, []));

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

  const filtered = EXERCISE_LIST.filter(ex => {
    if (filter === 'logged') return (workoutLogs[ex] || []).length > 0;
    return true;
  });

  const totalSessions = Object.values(workoutLogs).reduce((a, b) => a + b.length, 0);
  const totalSets     = Object.values(workoutLogs).reduce((a, b) => a + b.reduce((c, s) => c + (s.sets?.length ?? 0), 0), 0);

  const FILTERS = [
    { key: 'all',    label: t('all', lang) },
    { key: 'logged', label: t('logged', lang) },
  ];

  return (
    <View style={s.fill}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Özet kart */}
        <Animated.View entering={FadeInDown.duration(350)} style={s.summaryCard}>
          <Ionicons name="trending-up-outline" size={16} color={C.lime} style={{ marginBottom: 6 }} />
          <Text style={s.summaryTitle}>{t('progressOverload', lang)}</Text>
          <Text style={s.summaryText}>{t('progressDesc', lang)}</Text>
          <View style={s.summaryStats}>
            <View style={s.summaryStat}>
              <Text style={s.summaryStatVal}>{totalSessions}</Text>
              <Text style={s.summaryStatLabel}>{t('totalSessionsP', lang)}</Text>
            </View>
            <View style={[s.summaryStat, s.summaryStatMid]}>
              <Text style={s.summaryStatVal}>{totalSets}</Text>
              <Text style={s.summaryStatLabel}>{t('totalSetsP', lang)}</Text>
            </View>
            <View style={s.summaryStat}>
              <Text style={s.summaryStatVal}>{EXERCISE_LIST.filter(ex => (workoutLogs[ex] || []).length > 0).length}</Text>
              <Text style={s.summaryStatLabel}>{t('exerciseCount', lang)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Filtre */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)} style={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, filter === f.key && s.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Egzersiz kartları */}
        {filtered.map((ex, i) => (
          <ExerciseCard
            key={ex}
            name={ex}
            sessions={workoutLogs[ex] || []}
            onLog={openLog}
            index={i}
            lang={lang}
          />
        ))}
      </ScrollView>

      {/* Kayıt Modalı */}
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
  fill:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32 },

  summaryCard:      { backgroundColor: C.s1, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(232,244,74,0.2)', marginBottom: 14 },
  summaryTitle:     { color: C.lime,  fontSize: 14, fontWeight: '800', marginBottom: 4 },
  summaryText:      { color: C.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  summaryStats:     { flexDirection: 'row' },
  summaryStat:      { flex: 1, alignItems: 'center' },
  summaryStatMid:   { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border },
  summaryStatVal:   { color: C.text,  fontSize: 22, fontWeight: '900' },
  summaryStatLabel: { color: C.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },

  filterRow:       { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1 },
  filterBtnActive: { backgroundColor: C.lime + '18', borderColor: C.lime },
  filterText:      { color: C.muted, fontSize: 13, fontWeight: '600' },
  filterTextActive:{ color: C.lime, fontWeight: '700' },

  exCard:       { backgroundColor: C.s1, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 8 },
  exCardHeader: { flexDirection: 'row', alignItems: 'center' },
  exNameRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  exName:       { color: C.text,  fontSize: 13, fontWeight: '700', flex: 1 },
  exLast:       { color: C.teal,  fontSize: 11 },
  exNoData:     { color: C.dim,   fontSize: 11, fontStyle: 'italic' },
  exActions:    { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addBtn:       { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(232,244,74,0.12)', borderWidth: 1, borderColor: C.lime, alignItems: 'center', justifyContent: 'center' },

  prRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  prText: { color: C.orange, fontSize: 11, fontWeight: '700' },

  historyWrap: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 8, paddingTop: 8 },
  sessionRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  sessionDate: { color: C.dim,  fontSize: 10, width: 66, paddingTop: 3 },
  chipRow:     { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  setChip:     { backgroundColor: C.s2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
  setChipText: { color: C.text, fontSize: 11 },

  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  logModalBox:   { backgroundColor: C.s1, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: C.border, width: '100%', maxWidth: 400 },
  logModalTitle: { color: C.text, fontSize: 16, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  prevSessionBox:{ backgroundColor: 'rgba(232,244,74,0.06)', borderRadius: 12, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(232,244,74,0.2)' },
  prevLabel:     { color: C.muted, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  prevVal:       { color: C.lime,  fontSize: 12, fontWeight: '700' },
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
