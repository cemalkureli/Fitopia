import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated, Alert,
} from 'react-native';
import AnimatedRN, { FadeInDown, FadeInLeft, FadeIn, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { C } from '../utils/theme';
import { saveWorkoutSession, getAllWorkoutLogs, getFavorites, deleteWorkoutSession, deleteAllExerciseSessions, getActiveProgram } from '../utils/storage';
import { useLang } from '../context/LanguageContext';
import { useUnits, fmtWeight } from '../context/UnitsContext';
import FitnessMascot from '../components/FitnessMascot';
import TurntableMascot from '../components/TurntableMascot';
import { useToast, ConfirmModal } from '../components/Toast';
import { t, MONTHS_SHORT, DAYS_SHORT } from '../utils/i18n';
import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet, TTL } from '../utils/cache';

// ─── Measurement types ────────────────────────────────────────────────────────
const MEASURE_TYPES = [
  { key: 'bodyFat',    labelKey: 'mBodyFat',    unit: '%',    infoKey: 'mInfoBodyFat' },
  { key: 'ffmi',       labelKey: 'mFFMI',       unit: 'kg/m²', infoKey: 'mInfoFFMI' },
  { key: 'bodyWeight', labelKey: 'mBodyWeight', unitType: 'weight' },
  { key: 'height',     labelKey: 'mHeight',     unitType: 'length' },
  { key: 'neck',       labelKey: 'mNeck',       unitType: 'length' },
  { key: 'shoulder',   labelKey: 'mShoulder',   unitType: 'length' },
  { key: 'chest',      labelKey: 'mChest',      unitType: 'length' },
  { key: 'arm',        labelKey: 'mArm',        unitType: 'length' },
  { key: 'waist',      labelKey: 'mWaist',      unitType: 'length' },
  { key: 'hip',        labelKey: 'mHip',        unitType: 'length' },
  { key: 'leg',        labelKey: 'mLeg',        unitType: 'length' },
  { key: 'calf',       labelKey: 'mCalf',       unitType: 'length' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function calcBestSet(sessions) {
  let best = null;
  sessions.forEach(s => s.sets?.forEach(set => {
    const vol = (set.reps || 0) * (set.kg || 0);
    if (!best || vol > best.vol) best = { ...set, vol, date: s.date };
  }));
  return best;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function MiniChart({ sessions }) {
  if (sessions.length < 2) return null;
  const vols = sessions.slice(0, 7).reverse().map(s =>
    s.sets?.reduce((a, x) => a + (x.reps || 0) * (x.kg || 0), 0) || 0
  );
  const max = Math.max(...vols, 1);
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

// ─── Exercise card (Progressive tab) ─────────────────────────────────────────
function ExerciseCard({ name, sessions, onLog, index, lang, onReload, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const last = sessions[0];
  const best = calcBestSet(sessions);
  const trend = sessions.length >= 2 && sessions[0].sets && sessions[1].sets
    ? (sessions[0].sets[0]?.kg || 0) >= (sessions[1].sets[0]?.kg || 0) ? 'up' : 'down'
    : null;

  return (
    <AnimatedRN.View entering={FadeInDown.delay(index * 40).duration(350)}>
      <View style={[s.exCard, expanded && { borderColor: C.lime + '44' }]}>
        <TouchableOpacity style={s.exCardHeader} onPress={() => { if (sessions.length > 0) setExpanded(v => !v); }} activeOpacity={sessions.length > 0 ? 0.8 : 1}>
          <View style={{ flex: 1 }}>
            <View style={s.exNameRow}>
              <Text style={s.exName} numberOfLines={1}>{name}</Text>
              {trend === 'up'   && <Ionicons name="trending-up"   size={14} color={C.green}  style={{ marginLeft: 6 }} />}
              {trend === 'down' && <Ionicons name="trending-down" size={14} color={C.red}    style={{ marginLeft: 6 }} />}
            </View>
            {last && (
              <Text style={s.exLast}>{fmtDate(last.date, lang)} — {fmtSets(last.sets)}</Text>
            )}
          </View>
          <View style={s.exActions}>
            {/* + button only in Logged tab (onDelete present = logged) */}
            {onDelete && (
              <TouchableOpacity style={s.addBtn} onPress={() => onLog(name)}>
                <Ionicons name="add" size={18} color={C.lime} />
              </TouchableOpacity>
            )}
            {/* Delete — only in Logged tab */}
            {onDelete && (
              <TouchableOpacity onPress={() => onDelete(name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color={C.red} />
              </TouchableOpacity>
            )}
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.dim} />
          </View>
        </TouchableOpacity>
        {sessions.length >= 2 && <MiniChart sessions={sessions} />}
        {expanded && (
          <View style={s.historyWrap}>
            {best && (
              <View style={s.prRow}>
                <Ionicons name="trophy-outline" size={13} color={C.orange} />
                <Text style={s.prText}>PR: {best.reps}t × {best.kg}kg — {fmtDate(best.date, lang)}</Text>
              </View>
            )}
            {sessions.slice(0, 10).map((session, j) => (
              <View key={j} style={s.sessionRow}>
                <Text style={s.sessionDate}>{fmtDate(session.date, lang)}</Text>
                <View style={s.chipRow}>
                  {session.sets?.map((set, k) => (
                    <View key={k} style={s.setChip}>
                      <Text style={s.setChipText}>{set.reps}t · {set.kg}kg</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </AnimatedRN.View>
  );
}

// ─── Measurement accordion row ────────────────────────────────────────────────
function MeasureRow({ item, latest, lang, weightUnit, lengthUnit, onSave, index }) {
  const [open,     setOpen]     = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [val,      setVal]      = useState('');
  const [saving,   setSaving]   = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const inputRef = useRef(null);

  const unit = item.unit ?? (item.unitType === 'weight' ? weightUnit : lengthUnit);

  const openInput = () => { setEditing(true); setVal(''); setTimeout(() => inputRef.current?.focus(), 100); };
  const cancel    = () => { setEditing(false); setVal(''); };

  const save = async () => {
    const num = parseFloat(val);
    if (!num || isNaN(num)) return;
    setSaving(true);
    try {
      await onSave(item.key, num, unit);
      setEditing(false); setVal('');
    } finally {
      setSaving(false);
    }
  };

  const latestVal = latest?.[item.key];

  return (
    <AnimatedRN.View entering={FadeInDown.delay(index * 40).duration(300)}>
      {/* Header row */}
      <TouchableOpacity
        style={[mr.row, open && { borderBottomWidth: 0 }]}
        onPress={() => { setOpen(v => !v); if (open) { setEditing(false); setVal(''); } }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Text style={[mr.label, open && { color: '#dc2626' }]}>{t(item.labelKey, lang)}</Text>
          {item.infoKey && (
            <TouchableOpacity onPress={() => setInfoOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Ionicons name="information-circle-outline" size={18} color={C.dim} />
            </TouchableOpacity>
          )}
          {latestVal != null && !open && (
            <Text style={mr.latestBadge}>{latestVal} {unit}</Text>
          )}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={open ? '#dc2626' : C.muted} />
      </TouchableOpacity>

      {/* Expanded content */}
      {open && (
        <AnimatedRN.View entering={FadeIn.duration(200)} style={mr.expandWrap}>
          {!editing ? (
            <TouchableOpacity style={mr.addBtn} onPress={openInput}>
              <Ionicons name="add" size={20} color={C.text} />
              <Text style={mr.addTxt}>{t('mAddMeasurement', lang)}</Text>
            </TouchableOpacity>
          ) : (
            <View style={mr.inputRow}>
              <TouchableOpacity onPress={cancel} style={mr.inputIcon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={C.muted} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={mr.input}
                value={val}
                onChangeText={setVal}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={C.dim}
                returnKeyType="done"
                onSubmitEditing={save}
              />
              <Text style={mr.inputUnit}>{unit}</Text>
              <TouchableOpacity onPress={save} style={mr.inputIcon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#dc2626" />
                  : <Ionicons name="checkmark" size={20} color="#dc2626" />
                }
              </TouchableOpacity>
            </View>
          )}
        </AnimatedRN.View>
      )}

      {/* Info modal */}
      {item.infoKey && (
        <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
          <TouchableOpacity style={mr.infoOverlay} activeOpacity={1} onPress={() => setInfoOpen(false)}>
            <AnimatedRN.View entering={ZoomIn.duration(200)} style={mr.infoBox}>
              <Text style={mr.infoTitle}>{t(item.labelKey, lang)}</Text>
              <Text style={mr.infoBody}>{t(item.infoKey, lang)}</Text>
              <TouchableOpacity style={mr.infoClose} onPress={() => setInfoOpen(false)}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('confirm', lang)}</Text>
              </TouchableOpacity>
            </AnimatedRN.View>
          </TouchableOpacity>
        </Modal>
      )}
    </AnimatedRN.View>
  );
}

const mr = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  label:      { color: C.text, fontSize: 16, fontWeight: '700' },
  latestBadge:{ color: C.teal, fontSize: 12, fontWeight: '600' },
  expandWrap: { backgroundColor: C.s1, borderBottomWidth: 1, borderBottomColor: C.border },
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 24 },
  addTxt:     { color: C.text, fontSize: 15, fontWeight: '600' },
  inputRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  inputIcon:  { padding: 4 },
  input:      { flex: 1, fontSize: 20, fontWeight: '700', color: C.text, borderBottomWidth: 2, borderBottomColor: '#dc2626', paddingBottom: 4, textAlign: 'center' },
  inputUnit:  { color: C.muted, fontSize: 14, fontWeight: '600' },
  infoOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  infoBox:    { backgroundColor: C.s1, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)', maxWidth: 340, width: '100%' },
  infoTitle:  { color: '#dc2626', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  infoBody:   { color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  infoClose:  { backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});

// ─── Laser measurement row ────────────────────────────────────────────────────
function MeasureLaserRow({ label, value, unit, delay, index }) {
  const scanX   = useRef(new Animated.Value(-1)).current;
  const glow    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startDelay = delay + 400;
    // Scan beam sweeps left to right repeatedly
    const scan = Animated.loop(
      Animated.sequence([
        Animated.delay(startDelay + index * 200),
        Animated.timing(scanX, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(scanX, { toValue: -1, duration: 0, useNativeDriver: true }),
        Animated.delay(2000 + index * 300),
      ])
    );
    // Glow pulse on the value
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(startDelay),
        Animated.timing(glow, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    scan.start(); pulse.start();
    return () => { scan.stop(); pulse.stop(); };
  }, []);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <AnimatedRN.View entering={FadeInLeft.delay(delay).duration(280)} style={lz.row}>
      {/* Label */}
      <Text style={lz.label}>{label}</Text>

      {/* Animated laser line */}
      <View style={lz.lineWrap}>
        {/* Static dim line */}
        <View style={lz.lineBase} />
        {/* Particle dots */}
        {[0.2, 0.45, 0.7].map((pos, pi) => (
          <View key={pi} style={[lz.dot, { left: `${pos * 100}%` }]} />
        ))}
        {/* Scan beam */}
        <Animated.View
          style={[lz.scanBeam, {
            transform: [{ scaleX: scanX.interpolate({ inputRange: [-1, 1], outputRange: [-1, 1] }) }],
          }]}
        />
      </View>

      {/* Value */}
      <Animated.Text style={[lz.value, { opacity: glowOpacity }]}>
        {value}
      </Animated.Text>
      <Text style={lz.unit}>{unit}</Text>
    </AnimatedRN.View>
  );
}

const lz = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 20 },
  label:    { color: C.muted, fontSize: 12, fontWeight: '700', width: 90 },
  lineWrap: { flex: 1, height: 16, justifyContent: 'center', position: 'relative', marginHorizontal: 8 },
  lineBase: { height: 1, backgroundColor: 'rgba(220,38,38,0.15)', borderRadius: 1 },
  dot:      { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(220,38,38,0.4)', top: '50%', marginTop: -1.5 },
  scanBeam: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(220,38,38,0.7)', borderRadius: 1, shadowColor: '#dc2626', shadowOpacity: 0.9, shadowRadius: 6, elevation: 4 },
  value:    { color: '#dc2626', fontSize: 15, fontWeight: '900', width: 44, textAlign: 'right' },
  unit:     { color: C.dim, fontSize: 10, fontWeight: '600', width: 26, marginLeft: 4 },
});

// ─── General Status tab ───────────────────────────────────────────────────────
function GeneralTab({ workoutLogs, lang, weightUnit, lengthUnit }) {
  const [gender,       setGender]       = useState('male');
  const [latestMeasure, setLatestMeasure] = useState({});

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) return;
      const uid = data.user.id;

      // Gender (cached 10 min)
      const gKey = `profile_gender_${uid}`;
      const gc = await cacheGet(gKey);
      if (gc && !gc.stale) {
        if (gc.data) setGender(gc.data);
      } else {
        supabase.from('profiles').select('gender').eq('id', uid).single()
          .then(async ({ data: p }) => {
            if (p?.gender) { setGender(p.gender); await cacheSet(gKey, p.gender, TTL.PROFILE); }
          });
      }

      // Measurements (cached 2 min)
      const mKey = `measurements_${uid}`;
      const mc2 = await cacheGet(mKey);
      if (mc2) {
        setLatestMeasure(mc2.data);
        if (!mc2.stale) return;
      }
      supabase.from('body_measurements').select('type, value, unit')
        .eq('user_id', uid).order('measured_at', { ascending: false })
        .then(async ({ data: ms }) => {
          const latest = {};
          (ms || []).forEach(m => { if (!latest[m.type]) latest[m.type] = { value: m.value, unit: m.unit }; });
          setLatestMeasure(latest);
          await cacheSet(mKey, latest, TTL.WORKOUTS);
        });
    });
  }, []));

  const totalSessions = Object.values(workoutLogs).reduce((a, b) => a + b.length, 0);
  const totalSets     = Object.values(workoutLogs).reduce((a, b) => a + b.reduce((c, s) => c + (s.sets?.length ?? 0), 0), 0);
  const exCount       = Object.keys(workoutLogs).length;
  const days          = DAYS_SHORT[lang] ?? DAYS_SHORT.tr;

  const today = new Date();
  const week  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - 6 + i); return d;
  });
  const logDates = new Set();
  Object.values(workoutLogs).forEach(sessions =>
    sessions.forEach(s => logDates.add(new Date(s.date).toDateString()))
  );
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekSessions = Object.values(workoutLogs).reduce((a, sessions) =>
    a + sessions.filter(s => new Date(s.date) >= weekStart).length, 0
  );

  const bests = Object.entries(workoutLogs)
    .map(([name, sessions]) => ({ name, best: calcBestSet(sessions) }))
    .filter(x => x.best).sort((a, b) => b.best.vol - a.best.vol).slice(0, 3);

  // Measurement rows to display (only ones with data)
  const measureRows = MEASURE_TYPES.filter(mt => latestMeasure[mt.key]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

      {/* ── Stats summary ── */}
      <AnimatedRN.View entering={FadeInDown.duration(300)} style={g.summaryCard}>
        <LinearGradient colors={['rgba(232,244,74,0.08)', 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={g.statsRow}>
          {[
            { val: totalSessions, lbl: t('totalSessionsP', lang) },
            { val: totalSets,     lbl: t('totalSetsP', lang) },
            { val: exCount,       lbl: t('exerciseCount', lang) },
          ].map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={g.statDiv} />}
              <View style={g.stat}>
                <Text style={g.statVal}>{item.val}</Text>
                <Text style={g.statLbl}>{item.lbl}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </AnimatedRN.View>

      {/* ── 3D Mascot + measurements ── */}
      <AnimatedRN.View entering={FadeInDown.delay(80).duration(350)} style={g.mascotSection}>
        {/* Dark backdrop with subtle red glow */}
        <LinearGradient
          colors={['rgba(220,38,38,0.08)', 'rgba(2,6,23,0)']}
          style={StyleSheet.absoluteFill}
        />

        {/* 3D Turntable mascot (transparent PNG, drag to spin) */}
        <View style={g.mascotWrap}>
          <TurntableMascot gender={gender} width={220} height={400} autoSpin />
        </View>

        {/* Measurement values — animated laser lines */}
        {measureRows.length > 0 ? (
          <View style={g.measureList}>
            {measureRows.map((mt, i) => {
              const m = latestMeasure[mt.key];
              return (
                <MeasureLaserRow
                  key={mt.key}
                  label={t(mt.labelKey, lang)}
                  value={m.value}
                  unit={m.unit}
                  delay={i * 60}
                  index={i}
                />
              );
            })}
          </View>
        ) : (
          <Text style={g.noMeasure}>
            {lang === 'tr'
              ? 'Ölçüm eklemek için → Ölçüm sekmesi'
              : 'Add measurements → Measure tab'}
          </Text>
        )}
      </AnimatedRN.View>

      {/* ── Weekly activity ── */}
      <AnimatedRN.View entering={FadeInDown.delay(200).duration(300)} style={g.card}>
        <Text style={g.cardTitle}>{t('weekActivity', lang)}</Text>
        <View style={g.weekRow}>
          {week.map((d, i) => {
            const active  = logDates.has(d.toDateString());
            const isToday = d.toDateString() === today.toDateString();
            return (
              <View key={i} style={g.dayCol}>
                <View style={[g.dayDot, active && { backgroundColor: C.lime }, isToday && !active && { borderColor: C.lime, borderWidth: 1.5 }]} />
                <Text style={[g.dayLbl, isToday && { color: C.lime }]}>{days[d.getDay()]}</Text>
              </View>
            );
          })}
        </View>
        <Text style={g.weekSub}>
          {weekSessions > 0
            ? `${lang === 'tr' ? 'Bu hafta' : 'This week'}: ${weekSessions} ${t('sessions', lang).toLowerCase()}`
            : t('noLogsYet', lang)}
        </Text>
      </AnimatedRN.View>

      {/* ── Best sets ── */}
      {bests.length > 0 && (
        <AnimatedRN.View entering={FadeInDown.delay(260).duration(300)} style={g.card}>
          <Text style={g.cardTitle}>{t('bestSet', lang)}</Text>
          {bests.map(({ name, best }, i) => (
            <View key={i} style={[g.bestRow, i === bests.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={g.bestDot} />
              <Text style={g.bestName} numberOfLines={1}>{name}</Text>
              <Text style={g.bestVal}>{best.reps}t × {fmtWeight(best.kg, weightUnit)}</Text>
            </View>
          ))}
        </AnimatedRN.View>
      )}
    </ScrollView>
  );
}

const g = StyleSheet.create({
  summaryCard:  { backgroundColor: C.s1, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(232,244,74,0.2)', marginBottom: 12, overflow: 'hidden' },
  statsRow:     { flexDirection: 'row' },
  stat:         { flex: 1, alignItems: 'center' },
  statVal:      { color: C.text, fontSize: 24, fontWeight: '900' },
  statLbl:      { color: C.muted, fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  statDiv:      { width: 1, backgroundColor: C.border },

  // Mascot section
  mascotSection:{ backgroundColor: C.s1, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)', marginBottom: 12, overflow: 'hidden', paddingBottom: 16 },
  mascotWrap:   { alignItems: 'center', paddingTop: 20, paddingBottom: 4 },
  measureList:  { paddingVertical: 4 },
  noMeasure:    { color: C.dim, fontSize: 12, textAlign: 'center', paddingVertical: 12, paddingHorizontal: 20 },

  card:         { backgroundColor: C.s1, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  cardTitle:    { color: C.text, fontSize: 13, fontWeight: '800', marginBottom: 14 },
  weekRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol:       { alignItems: 'center', gap: 6 },
  dayDot:       { width: 28, height: 28, borderRadius: 8, backgroundColor: C.s3 },
  dayLbl:       { color: C.dim, fontSize: 10, fontWeight: '600' },
  weekSub:      { color: C.dim, fontSize: 11, marginTop: 10, textAlign: 'center' },
  bestRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  bestDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.orange },
  bestName:     { flex: 1, color: C.text, fontSize: 13, fontWeight: '600' },
  bestVal:      { color: C.orange, fontSize: 12, fontWeight: '700' },
});

// ─── Measurement tab ──────────────────────────────────────────────────────────
function MeasurementTab({ lang, weightUnit, lengthUnit }) {
  const [measurements, setMeasurements] = useState([]); // all records
  const [loading, setLoading] = useState(true);
  const [userId,  setUserId]  = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      setUserId(data.user.id);
      fetchMeasurements(data.user.id);
    });
  }, []);

  const fetchMeasurements = async (uid) => {
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', uid)
      .order('measured_at', { ascending: false });
    setMeasurements(data || []);
    setLoading(false);
  };

  const handleSave = async (type, value, unit) => {
    if (!userId) return;
    await supabase.from('body_measurements').insert({ user_id: userId, type, value, unit });
    await fetchMeasurements(userId);
  };

  // Latest per type
  const latest = {};
  measurements.forEach(m => { if (!latest[m.type]) latest[m.type] = m.value; });

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.lime} />
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={mt.list}>
          {MEASURE_TYPES.map((item, i) => (
            <MeasureRow
              key={item.key}
              item={item}
              latest={latest}
              lang={lang}
              weightUnit={weightUnit}
              lengthUnit={lengthUnit}
              onSave={handleSave}
              index={i}
            />
          ))}
        </View>

        {/* History */}
        {measurements.length > 0 && (
          <AnimatedRN.View entering={FadeInDown.delay(440).duration(320)} style={mt.histWrap}>
            <Text style={mt.histTitle}>{t('mHistory', lang)}</Text>
            {measurements.slice(0, 20).map((m, i) => {
              const typeItem = MEASURE_TYPES.find(x => x.key === m.type);
              return (
                <View key={m.id} style={[mt.histRow, i === measurements.slice(0, 20).length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={mt.histDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={mt.histType}>{typeItem ? t(typeItem.labelKey, lang) : m.type}</Text>
                    <Text style={mt.histDate}>{fmtDate(m.measured_at, lang)}</Text>
                  </View>
                  <Text style={mt.histVal}>{m.value} <Text style={mt.histUnit}>{m.unit}</Text></Text>
                </View>
              );
            })}
          </AnimatedRN.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const mt = StyleSheet.create({
  list:     { backgroundColor: C.bg },
  histWrap: { margin: 16, backgroundColor: C.s1, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  histTitle:{ color: C.text, fontSize: 13, fontWeight: '800', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  histRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  histDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' },
  histType: { color: C.text, fontSize: 13, fontWeight: '600' },
  histDate: { color: C.dim, fontSize: 10, marginTop: 2 },
  histVal:  { color: '#dc2626', fontSize: 15, fontWeight: '800' },
  histUnit: { color: C.muted, fontSize: 11, fontWeight: '400' },
});

// ─── Main ProgressScreen ──────────────────────────────────────────────────────
export default function ProgressScreen() {
  const { lang }                       = useLang();
  const { weightUnit, lengthUnit }     = useUnits();
  const [workoutLogs, setWorkoutLogs]  = useState({});
  const [favorites,   setFavorites]    = useState([]);
  const [logModal,    setLogModal]     = useState(null);
  const [logSets,     setLogSets]      = useState([{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }]);
  const [filterProg,  setFilterProg]   = useState('all');
  const [activeTab,   setActiveTab]    = useState(0);
  const [confirmDel,  setConfirmDel]   = useState(null); // exercise name to delete
  const { show: showToast, ToastNode } = useToast();

  useFocusEffect(useCallback(() => {
    getAllWorkoutLogs().then(setWorkoutLogs);
    getFavorites().then(setFavorites);
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
    const valid = logSets.filter(s => s.reps || s.kg).map(s => ({ reps: parseInt(s.reps) || 0, kg: parseFloat(s.kg) || 0 }));
    if (valid.length > 0) {
      await saveWorkoutSession(logModal.name, valid);
      setWorkoutLogs(await getAllWorkoutLogs());
    }
    setLogModal(null);
  };

  const updateSet = (i, field, val) => setLogSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  const loggedExercises = Object.keys(workoutLogs).filter(ex => (workoutLogs[ex] || []).length > 0);
  const filteredProg    = filterProg === 'logged' ? loggedExercises : favorites;

  const TABS = [
    { label: t('tabGeneral', lang),     icon: 'stats-chart-outline' },
    { label: t('tabProgressive', lang), icon: 'trending-up-outline' },
    { label: t('tabMeasurement', lang), icon: 'body-outline' },
  ];

  return (
    <View style={[s.fill, { position: 'relative' }]}>
      {/* Confirm delete exercise */}
      <ConfirmModal
        visible={!!confirmDel}
        title={lang === 'tr' ? 'Egzersizi Sil' : 'Delete Exercise'}
        message={confirmDel ? (lang === 'tr' ? `"${confirmDel}" ve tüm geçmiş kayıtları silinecek.` : `"${confirmDel}" and all its records will be deleted.`) : ''}
        confirmLabel={lang === 'tr' ? 'Sil' : 'Delete'}
        confirmColor="#dc2626"
        lang={lang}
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          await deleteAllExerciseSessions(confirmDel);
          setWorkoutLogs(await getAllWorkoutLogs());
          setConfirmDel(null);
          showToast(lang === 'tr' ? 'Egzersiz silindi.' : 'Exercise deleted.', 'error');
        }}
      />
      {ToastNode}
      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={[s.tabBtn, activeTab === i && s.tabBtnActive]}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.75}
          >
            <Ionicons name={tab.icon} size={14} color={activeTab === i ? '#0a0c0f' : C.muted} />
            <Text style={[s.tabTxt, activeTab === i && s.tabTxtActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab 0 — Genel Durum */}
      {activeTab === 0 && (
        <GeneralTab workoutLogs={workoutLogs} lang={lang} weightUnit={weightUnit} lengthUnit={lengthUnit} />
      )}

      {/* Tab 1 — Progressive Overload */}
      {activeTab === 1 && (
        <View style={s.fill}>
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {/* Filter */}
            <AnimatedRN.View entering={FadeInDown.delay(60).duration(280)} style={s.filterRow}>
              {[
                { key: 'all',    label: t('favorites', lang) },
                { key: 'logged', label: t('logged', lang) },
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.filterBtn, filterProg === f.key && s.filterBtnActive]}
                  onPress={() => setFilterProg(f.key)}
                >
                  <Text style={[s.filterText, filterProg === f.key && s.filterTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </AnimatedRN.View>

            {filteredProg.length === 0 ? (
              <AnimatedRN.View entering={FadeInDown.duration(320)} style={s.emptyWrap}>
                <Ionicons name={filterProg === 'all' ? 'heart-outline' : 'bar-chart-outline'} size={40} color={C.dim} />
                <Text style={s.emptyTxt}>{t(filterProg === 'all' ? 'noFavorites' : 'noData', lang)}</Text>
              </AnimatedRN.View>
            ) : (
              filteredProg.map((ex, i) => (
                <ExerciseCard key={ex} name={ex} sessions={workoutLogs[ex] || []} onLog={openLog} index={i} lang={lang}
                  onReload={() => getAllWorkoutLogs().then(setWorkoutLogs)}
                  onDelete={filterProg === 'logged' ? (n) => setConfirmDel(n) : undefined} />
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* Tab 2 — Measurement */}
      {activeTab === 2 && (
        <MeasurementTab lang={lang} weightUnit={weightUnit} lengthUnit={lengthUnit} />
      )}

      {/* Log Modal */}
      {logModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setLogModal(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setLogModal(null)}>
              <TouchableOpacity activeOpacity={1} style={s.logModalBox} onPress={() => {}}>
                <Text style={s.logModalTitle}>{logModal.name}</Text>
                {logModal.lastSession && (
                  <View style={s.prevSessionBox}>
                    <Text style={s.prevLabel}>{t('prevSession', lang)}</Text>
                    <Text style={s.prevVal}>{fmtDate(logModal.lastSession.date, lang)} — {fmtSets(logModal.lastSession.sets)}</Text>
                  </View>
                )}
                <View style={s.logHeader}>
                  <Text style={[s.logHeaderText, { width: 36 }]}>{t('set', lang)}</Text>
                  <Text style={[s.logHeaderText, { flex: 1 }]}>{t('reps', lang)}</Text>
                  <Text style={[s.logHeaderText, { flex: 1 }]}>{t('weightKg', lang)}</Text>
                </View>
                {logSets.map((set, i) => (
                  <View key={i} style={s.logRow}>
                    <View style={s.setNumBox}><Text style={s.setNumText}>{i + 1}</Text></View>
                    <TextInput style={s.logInput} value={set.reps} onChangeText={v => updateSet(i, 'reps', v)} keyboardType="numeric" placeholder="—" placeholderTextColor={C.dim} maxLength={3} />
                    <TextInput style={s.logInput} value={set.kg} onChangeText={v => updateSet(i, 'kg', v)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={C.dim} maxLength={6} />
                  </View>
                ))}
                <TouchableOpacity style={s.addSetBtn} onPress={() => setLogSets(p => [...p, { reps: '', kg: '' }])}>
                  <Ionicons name="add-circle-outline" size={16} color={C.teal} />
                  <Text style={{ color: C.teal, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>{t('addSet', lang)}</Text>
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

  // Tab bar
  tabBar:       { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  tabBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.s1 },
  tabBtnActive: { backgroundColor: C.lime, borderColor: C.lime },
  tabTxt:       { color: C.muted, fontSize: 11, fontWeight: '700' },
  tabTxtActive: { color: '#0a0c0f', fontWeight: '800' },

  // Progressive tab
  filterRow:       { flexDirection: 'row', gap: 8, marginBottom: 14 },
  filterBtn:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1 },
  filterBtnActive: { backgroundColor: C.lime + '18', borderColor: C.lime },
  filterText:      { color: C.muted, fontSize: 13, fontWeight: '600' },
  filterTextActive:{ color: C.lime, fontWeight: '700' },
  emptyWrap:       { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTxt:        { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Exercise card
  exCard:       { backgroundColor: C.s1, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginBottom: 8 },
  exCardHeader: { flexDirection: 'row', alignItems: 'center' },
  exNameRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  exName:       { color: C.text, fontSize: 13, fontWeight: '700', flex: 1 },
  exLast:       { color: C.teal, fontSize: 11 },
  exNoData:     { color: C.dim, fontSize: 11, fontStyle: 'italic' },
  exActions:    { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addBtn:       { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(232,244,74,0.12)', borderWidth: 1, borderColor: C.lime, alignItems: 'center', justifyContent: 'center' },
  prRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  prText:       { color: C.orange, fontSize: 11, fontWeight: '700' },
  historyWrap:  { borderTopWidth: 1, borderTopColor: C.border, marginTop: 8, paddingTop: 8 },
  sessionRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  sessionDate:  { color: C.dim, fontSize: 10, width: 66, paddingTop: 3 },
  chipRow:      { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  setChip:      { backgroundColor: C.s2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
  setChipText:  { color: C.text, fontSize: 11 },

  // Log modal
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  logModalBox:   { backgroundColor: C.s1, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: C.border, width: '100%', maxWidth: 400 },
  logModalTitle: { color: C.text, fontSize: 16, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  prevSessionBox:{ backgroundColor: 'rgba(232,244,74,0.06)', borderRadius: 12, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(232,244,74,0.2)' },
  prevLabel:     { color: C.muted, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  prevVal:       { color: C.lime, fontSize: 12, fontWeight: '700' },
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
