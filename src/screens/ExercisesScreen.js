import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Dimensions, Image, ActivityIndicator,
  ScrollView, Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeInDown, FadeIn, FadeInLeft } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../utils/theme';
import { supabase } from '../lib/supabase';
import ExerciseMedia from '../components/ExerciseMedia';
import { useLang } from '../context/LanguageContext';
import { t, CATEGORY_LABELS, MUSCLE_LABELS } from '../utils/i18n';
import { TRAINING_PLANS, PLAN_FILTERS } from '../data/trainingPlans';
import { setActiveProgram, getMyPlans, saveMyPlan, deleteMyPlan, getActiveProgram, clearActiveProgram } from '../utils/storage';
import { useMuscleFilter } from '../context/MuscleFilterContext';
import { useToast, ConfirmModal } from '../components/Toast';
import { cacheGet, cacheSet, TTL } from '../utils/cache';
import { Image as ExpoImage } from 'expo-image';
import {
  EXERCISES, filterExercises, decorate, getByName,
  CATEGORIES, CAT_LABEL, CAT_ICON, CAT_COLOR as EX_CAT_COLOR,
  MUSCLE_LABEL, MUSCLE_COLOR, EQUIPMENTS, EQUIP_LABEL, EQUIP_ICON, equipGroup,
  gifUrl, thumbUrl,
} from '../data/exercises';

// Workout terminology definitions (shared with ProgramScreen)
const TERIMLER = {
  tr: {
    'RIR':      'RIR = Reps In Reserve — Sete biterken hâlâ yapabileceğin tekrar sayısı.\nRIR 0 = Failure (kas yetmezliği), RIR 1 = 1 tekrar kaldı, RIR 2 = 2 tekrar kaldı.',
    'Failure':  'Kas Yetmezliği — 1 tekrar daha fiziksel olarak imkânsız olana kadar sürdür. Maksimum kas stimülasyonu.',
    'Süperset': 'Süperset — İki egzersizi dinlenmeksizin arka arkaya yap. Antrenman süresini kısaltır.',
    'Finisher': 'Finisher — Antrenman sonunda yapılan tamamlayıcı set. Kası tamamen tüketmek için.',
  },
  en: {
    'RIR':      'RIR = Reps In Reserve — How many reps you could still do at the end of a set.\nRIR 0 = Failure, RIR 1 = 1 rep left, RIR 2 = 2 reps left.',
    'Failure':  'Muscular Failure — Continue until one more rep is physically impossible. Maximum muscle stimulation.',
    'Superset': 'Superset — Perform two exercises back-to-back without rest. Shortens workout duration.',
    'Finisher': 'Finisher — A finishing set done at the end of a workout to completely exhaust the muscle.',
  },
};

const { width, height } = Dimensions.get('window');

// ─── Yıldız ──────────────────────────────────────────────────────────────────
function Stars({ value, max = 5, size = 14, onPress }) {
  const STAR_COLORS = ['#f87171','#fb923c','#e8f44a','#34d399','#14b8a6'];
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: max }, (_, i) => (
        <TouchableOpacity key={i} onPress={onPress ? () => onPress(i + 1) : undefined}
          disabled={!onPress} hitSlop={{ top:8, bottom:8, left:4, right:4 }}>
          <Ionicons
            name={i < Math.round(value) ? 'star' : 'star-outline'}
            size={size}
            color={i < Math.round(value) ? STAR_COLORS[Math.round(value) - 1] : C.dim}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Etki çubuğu ─────────────────────────────────────────────────────────────
function EffBar({ value, label, color }) {
  return (
    <View style={eb.row}>
      <Text style={eb.label}>{label}</Text>
      <View style={eb.track}>
        <View style={[eb.fill, { width: `${(value / 5) * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[eb.val, { color }]}>{value}/5</Text>
    </View>
  );
}
const eb = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label:{ color: C.muted, fontSize: 11, width: 90 },
  track:{ flex: 1, height: 6, backgroundColor: C.s3, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  val:  { fontSize: 11, fontWeight: '700', width: 30, textAlign: 'right' },
});

// ─── Egzersiz satırı ─────────────────────────────────────────────────────────
// item: yerel dataset kaydı (id,name,cat,muscle,target,equip,m,...)
const ExerciseRow = memo(({ item, onPress, lang, rating }) => {
  const color    = EX_CAT_COLOR[item.cat] ?? C.lime;
  const catLabel = CAT_LABEL[item.cat]?.[lang] ?? item.cat;
  const muscle   = MUSCLE_LABEL[item.muscle]?.[lang] ?? item.target ?? '';
  const avg      = rating?.avg ?? 0;
  const votes    = rating?.count ?? 0;

  return (
    <TouchableOpacity style={s.exRow} onPress={() => onPress(item)} activeOpacity={0.8}>
      <ExpoImage
        source={{ uri: thumbUrl(item.m) }}
        style={[s.thumb, { backgroundColor: '#fff' }]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
      />
      <View style={{ flex: 1 }}>
        <Text style={s.exName} numberOfLines={2}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <View style={[s.badge, { backgroundColor: color + '22' }]}>
            <Text style={[s.badgeTxt, { color }]}>{catLabel}</Text>
          </View>
          {muscle ? <Text style={s.muscleTxt}>{muscle}</Text> : null}
        </View>
        {votes > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <Stars value={avg} size={11} />
            <Text style={{ color: C.dim, fontSize: 10 }}>({votes})</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.dim} />
    </TouchableOpacity>
  );
});

// ─── Açılır filtre başlığı (accordion) ────────────────────────────────────────
// Aktif filtrede renkli kenarlık + parlama (glow); açıkken chevron döner.
function FilterAccordion({ icon, title, value, placeholder, activeColor, hasValue, isOpen, onToggle }) {
  const color = hasValue ? activeColor : C.dim;
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      style={[
        fa.header,
        // Keskin renkli kenarlık + transparan zemin — Android'de elevation/gölge
        // bulanık "sis" halesi çizdiği için glow YOK, cam görünüm korunur.
        isOpen && { borderColor: activeColor + '77' },
        hasValue && { borderColor: activeColor, backgroundColor: activeColor + '0D' },
      ]}
    >
      <View style={[fa.iconWrap, { backgroundColor: color + '1F' }]}>
        <Ionicons name={icon} size={15} color={hasValue ? activeColor : C.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={fa.title}>{title}</Text>
        <Text style={[fa.value, hasValue && { color: activeColor, fontWeight: '800' }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </View>
      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={hasValue ? activeColor : C.dim} />
    </TouchableOpacity>
  );
}

const fa = StyleSheet.create({
  row:     { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  header:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.s1, borderWidth: 1.5, borderColor: C.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  iconWrap:{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title:   { color: C.dim, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  value:   { color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 1 },
  panel:   { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(148,170,214,0.28)', backgroundColor: C.s1, padding: 12, overflow: 'hidden' },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.s2 },
  chipTxt: { color: C.muted, fontSize: 12, fontWeight: '700' },
});

// ─── Detay bottom sheet ───────────────────────────────────────────────────────
// item: yerel dataset kaydı. GIF + adım adım talimat + kaslar + topluluk puanı.
function ExerciseDetail({ item, visible, onClose, onRated, lang }) {
  const [userRating, setUserRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [avg,   setAvg]   = useState(0);
  const [votes, setVotes] = useState(0);

  // Topluluk puanları — ex_ratings (yerel egzersiz anahtarı = item.id ile)
  useEffect(() => {
    if (!visible || !item) return;
    setUserRating(0); setSubmitted(false); setAvg(0); setVotes(0);
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('ex_ratings').select('rating, user_id').eq('exercise_key', item.id);
      if (cancelled) return;
      const rows = data || [];
      setVotes(rows.length);
      setAvg(rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0);
      const { data: ud } = await supabase.auth.getUser();
      const mine = ud?.user && rows.find(r => r.user_id === ud.user.id);
      if (mine && !cancelled) { setUserRating(mine.rating); setSubmitted(true); }
    })();
    return () => { cancelled = true; };
  }, [visible, item?.id]);

  if (!item) return null;
  const d        = decorate(item, lang);
  const color    = d.catColor;
  const steps    = d.steps.length ? d.steps : (d.instr ? [d.instr] : []);
  const equip    = EQUIP_LABEL[equipGroup(item.equip)]?.[lang] ?? item.equip;
  const muscles  = [d.muscleLabel, ...(item.secondary || [])].filter(Boolean);

  const handleRate = async (rating) => {
    if (rating === userRating) return;
    const wasFirst = !submitted;
    setUserRating(rating); setSubmitting(true);
    try {
      const { data: ud } = await supabase.auth.getUser();
      if (!ud?.user) return;
      await supabase.from('ex_ratings').upsert(
        { exercise_key: item.id, user_id: ud.user.id, rating },
        { onConflict: 'exercise_key,user_id' }
      );
      if (wasFirst) await supabase.rpc('increment_xp', { uid: ud.user.id, amount: 5, rating_inc: 1 }).catch(() => {});
      // özet yenile
      const { data } = await supabase.from('ex_ratings').select('rating').eq('exercise_key', item.id);
      const rows = data || [];
      setVotes(rows.length);
      setAvg(rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0);
      setSubmitted(true);
      onRated?.(item.id);
    } catch {}
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={det.container}>
        <TouchableOpacity style={det.overlay} activeOpacity={1} onPress={onClose} />
        <View style={det.sheet}>
          <View style={det.dragBar} />

          {/* GIF — ScrollView dışında sabit */}
          <View style={[det.videoWrap, { borderColor: color + '44' }]}>
            <ExpoImage
              source={{ uri: d.gif }}
              style={{ flex: 1, backgroundColor: '#fff' }}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={150}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={{ padding: 20 }}>
              <Text style={det.name}>{item.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <View style={[s.badge, { backgroundColor: color + '22' }]}>
                  <Text style={[s.badgeTxt, { color }]}>{d.catLabel}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: C.s2 }]}>
                  <Text style={[s.badgeTxt, { color: C.muted }]}>{equip}</Text>
                </View>
              </View>

              {/* Kaslar */}
              <Text style={det.sectionTitle}>{t('muscleGroups', lang)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {muscles.map((m, i) => (
                  <View key={i} style={[det.muscleTag, i === 0 && { backgroundColor: color + '22', borderColor: color }]}>
                    <Text style={[det.muscleTxt, i === 0 && { color }]}>{m}</Text>
                  </View>
                ))}
              </View>

              {/* Adım adım talimat */}
              {steps.length > 0 && (
                <>
                  <Text style={det.sectionTitle}>{t('instructions', lang)}</Text>
                  {steps.map((st, i) => (
                    <View key={i} style={det.stepRow}>
                      <View style={[det.stepNum, { backgroundColor: color + '22' }]}>
                        <Text style={[det.stepNumTxt, { color }]}>{i + 1}</Text>
                      </View>
                      <Text style={det.stepTxt}>{st}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Topluluk puanı */}
              <Text style={det.sectionTitle}>{t('communityRating', lang)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Stars value={avg} size={20} />
                {votes > 0 && (
                  <Text style={{ color: C.dim, fontSize: 12 }}>
                    {t('avg', lang)} {avg.toFixed(1)} · {votes} {t('votes', lang)}
                  </Text>
                )}
              </View>

              {/* Senin puanın */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <Text style={[det.sectionTitle, { marginTop: 0 }]}>{t('yourRating', lang)}</Text>
                {submitted && <Text style={{ color: C.teal, fontSize: 11 }}>{t('xpEarned', lang)}</Text>}
              </View>
              {submitting
                ? <ActivityIndicator color={C.lime} style={{ alignSelf: 'flex-start' }} />
                : <Stars value={userRating} size={30} onPress={handleRate} />}
              {submitted && (
                <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{t('ratingChangeable', lang)}</Text>
              )}

              <TouchableOpacity onPress={onClose} style={[det.closeBtn, { borderColor: color + '50', marginTop: 20 }]}>
                <Text style={{ color, fontWeight: '700', fontSize: 14 }}>{t('close', lang)}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const det = StyleSheet.create({
  container:  { flex: 1, justifyContent: 'flex-end' },
  overlay:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet:      { backgroundColor: C.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: height * 0.92, borderWidth: 1, borderColor: C.border },
  dragBar:    { width: 36, height: 4, backgroundColor: C.s3, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  videoWrap:  { height: 260, borderWidth: 1, overflow: 'hidden', backgroundColor: '#fff' },
  name:       { color: C.text, fontSize: 20, fontWeight: '900' },
  sectionTitle:{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  muscleTag:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border, backgroundColor: C.s2 },
  muscleTxt:  { color: C.muted, fontSize: 12, fontWeight: '600' },
  stepRow:    { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  stepNum:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumTxt: { fontSize: 12, fontWeight: '900' },
  stepTxt:    { flex: 1, color: C.muted, fontSize: 13.5, lineHeight: 20 },
  closeBtn:   { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────
const PAGE = 20;

// ─── Sub-header (back button + title) ────────────────────────────────────────
function SubHdr({ title, onBack, right }) {
  return (
    <View style={wt.subHdr}>
      <TouchableOpacity onPress={onBack} style={wt.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="arrow-back" size={20} color={C.text} />
      </TouchableOpacity>
      <Text style={wt.subHdrTitle} numberOfLines={1}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View>
    </View>
  );
}

// ─── Workouts Tab ─────────────────────────────────────────────────────────────
function WorkoutsTab({ lang }) {
  const { show: showToast, ToastNode } = useToast();
  const [workouts,    setWorkouts]    = useState([]);
  const [userId,      setUserId]      = useState(null);
  const [view,        setView]        = useState('main'); // 'main'|'detail'|'picker'
  const [active,      setActive]      = useState(null);  // selected workout
  const [creating,    setCreating]    = useState(false);
  const [form,        setForm]        = useState({ title: '', description: '' });
  const [saving,      setSaving]      = useState(false);
  const [wkExercises, setWkExercises] = useState([]); // exercises in current workout
  const [allEx,       setAllEx]       = useState([]);  // exercise library for picker
  const [pickerSel,   setPickerSel]   = useState(new Set());
  const [pickerSearch,setPickerSearch]= useState('');
  const [loadingPicker, setLoadingPicker] = useState(false);
  const [allOpen, setAllOpen] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      setUserId(data.user.id);
      loadWorkouts(data.user.id);
    });
  }, []);

  const loadWorkouts = async (uid) => {
    const { data } = await supabase.from('custom_workouts').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    setWorkouts(data || []);
  };

  const loadWorkoutExercises = async (workoutId) => {
    const { data } = await supabase.from('workout_exercises').select('*').eq('workout_id', workoutId).order('order_index');
    setWkExercises(data || []);
  };

  const openDetail = async (workout) => {
    setActive(workout); setView('detail');
    await loadWorkoutExercises(workout.id);
  };

  const createWorkout = async () => {
    if (!form.title.trim() || !userId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('custom_workouts').insert({ user_id: userId, title: form.title.trim(), description: form.description.trim() }).select().single();
      if (error) throw error;
      setCreating(false); setForm({ title: '', description: '' });
      await loadWorkouts(userId);
      openDetail(data);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const [confirmDeleteWorkout, setConfirmDeleteWorkout] = useState(false);

  // ⚡ Hızlı Antrenman üretici — süre + odak seç, otomatik workout oluştur
  const [quickOpen,  setQuickOpen]  = useState(false);
  const [quickDur,   setQuickDur]   = useState(30);          // dk
  const [quickFocus, setQuickFocus] = useState('full_body');
  const [quickGen,   setQuickGen]   = useState(false);

  const QUICK_FOCUS_CATS = {
    full_body: ['chest','back','shoulders','arms','legs','core'],
    upper:     ['chest','back','shoulders','arms'],
    lower:     ['legs'],
    core:      ['core'],
  };

  const generateQuick = async () => {
    if (!userId || quickGen) return;
    setQuickGen(true);
    try {
      const cats = QUICK_FOCUS_CATS[quickFocus];
      const pool = EXERCISES.filter(e => cats.includes(e.cat)).map(e => ({ name: e.name, category: e.cat }));
      // Süreye göre egzersiz sayısı: ~6 dk/egzersiz (3 set + dinlenme)
      const n = Math.max(3, Math.min(8, Math.round(quickDur / 6)));
      // Kategori dengesi: her kategoriden sırayla rastgele seç
      const byCat = {};
      pool.forEach(e => { (byCat[e.category] = byCat[e.category] || []).push(e); });
      Object.values(byCat).forEach(arr => arr.sort(() => Math.random() - 0.5));
      const catKeys = Object.keys(byCat).sort(() => Math.random() - 0.5);
      const picked = [];
      let guard = 0;
      while (picked.length < n && catKeys.length && guard++ < 50) {
        const cat = catKeys[picked.length % catKeys.length];
        const ex = byCat[cat]?.pop();
        if (ex) picked.push(ex);
        else catKeys.splice(catKeys.indexOf(cat), 1);
      }
      if (picked.length === 0) { showToast(t('noData', lang), 'error'); return; }
      const title = `⚡ ${t('quickWorkout', lang)} · ${quickDur} ${lang === 'tr' ? 'dk' : 'min'}`;
      const { data: w, error } = await supabase.from('custom_workouts')
        .insert({ user_id: userId, title, description: t('autoGenerated', lang) }).select().single();
      if (error) throw error;
      await supabase.from('workout_exercises').insert(
        picked.map((ex, i) => ({ workout_id: w.id, exercise_name: ex.name, sets: 3, reps: 10, rir: 1.0, order_index: i }))
      );
      await loadWorkouts(userId);
      setQuickOpen(false);
      openDetail(w);
      showToast(t('quickReady', lang), 'success');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setQuickGen(false); }
  };

  const deleteWorkout = () => setConfirmDeleteWorkout(true);
  const doDeleteWorkout = async () => {
    await supabase.from('custom_workouts').delete().eq('id', active.id);
    setConfirmDeleteWorkout(false);
    setView('main'); setActive(null);
    await loadWorkouts(userId);
    showToast(t('workoutDeleted', lang), 'error');
  };

  const saveWorkoutEdit = async () => {
    if (!editWorkoutForm.title.trim() || !active) return;
    await supabase.from('custom_workouts').update({
      title:       editWorkoutForm.title.trim(),
      description: editWorkoutForm.description.trim(),
    }).eq('id', active.id);
    setActive(a => ({ ...a, title: editWorkoutForm.title.trim(), description: editWorkoutForm.description.trim() }));
    setEditingWorkout(false);
    await loadWorkouts(userId);
    showToast(t('updated', lang), 'success');
  };

  const openCreateTemplate = () => {
    setDaySchedule({});
    setSelectedEx(null);
    setTmplForm({ title: active?.title ?? '', description: active?.description ?? '', level: 'intermediate', goals: [], days: 0 });
    setView('createTemplate');
  };

  const addExToDay = (dayIdx) => {
    if (!selectedEx) return;
    setDaySchedule(prev => ({ ...prev, [dayIdx]: [...(prev[dayIdx] ?? []), selectedEx] }));
    setSelectedEx(null);
  };

  const removeExFromDay = (dayIdx, exIdx) => {
    setDaySchedule(prev => ({ ...prev, [dayIdx]: (prev[dayIdx] ?? []).filter((_, i) => i !== exIdx) }));
  };

  const saveTemplate = async () => {
    if (!tmplForm.title.trim()) return;
    // Sadece egzersiz içeren günler
    const ORDER = [1,2,3,4,5,6,0]; // Mon→Sun
    const DAY_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
    const DAY_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const activeDays = ORDER.filter(d => (daySchedule[d] ?? []).length > 0);
    const autodays   = activeDays.length;

    if (autodays === 0) {
      showToast(t('addExToAtLeast1Day', lang), 'error');
      return;
    }

    const plan = {
      id:           `my-${Date.now()}`,
      title:        tmplForm.title.trim(),
      description:  tmplForm.description.trim(),
      level:        tmplForm.level,
      days:         autodays,
      goals:        tmplForm.goals,
      targetMuscles: [],
      environment:   [],
      athleteCount:  1,
      isPaid:        false,
      isMine:        true,
      workouts: activeDays.map(d => ({
        name:       DAY_TR[d],
        name_en:    DAY_EN[d],
        dayOfWeek:  d,
        exercises:  daySchedule[d],
      })),
      createdAt: new Date().toISOString(),
    };
    await saveMyPlan(plan);
    setView('detail');
    setDaySchedule({});
    setSelectedEx(null);
    showToast(t('templateSaved', lang), 'success');
  };

  const loadPicker = async () => {
    setLoadingPicker(true);
    // Yerel dataset — isme göre sıralı
    setAllEx([...EXERCISES].sort((a, b) => a.name.localeCompare(b.name)));
    setLoadingPicker(false);
  };

  const openPicker = async () => { setView('picker'); setPickerSel(new Set(wkExercises.map(e => e.exercise_name))); await loadPicker(); };

  const addPickerExercises = async () => {
    const existing = new Set(wkExercises.map(e => e.exercise_name));
    const toAdd = [...pickerSel].filter(n => !existing.has(n));
    if (toAdd.length === 0) { setView('detail'); return; }
    const rows = toAdd.map((name, i) => ({ workout_id: active.id, exercise_name: name, sets: 3, reps: 10, rir: 1.0, order_index: wkExercises.length + i }));
    await supabase.from('workout_exercises').insert(rows);
    await loadWorkoutExercises(active.id);
    setView('detail'); setPickerSel(new Set());
  };

  const removeExercise = async (exId) => {
    await supabase.from('workout_exercises').delete().eq('id', exId);
    await loadWorkoutExercises(active.id);
  };

  // ── Exercise detail sub-view ───────────────────────────────────────────────
  const [tmplForm, setTmplForm] = useState({ title: '', description: '', level: 'intermediate', goals: [], days: 3 });
  const [editingWorkout,   setEditingWorkout]   = useState(false);
  const [editWorkoutForm,  setEditWorkoutForm]  = useState({ title: '', description: '' });
  const [selectedEx,       setSelectedEx]       = useState(null);  // template builder
  const [daySchedule,      setDaySchedule]      = useState({});    // { 0:[], 1:[], ..., 6:[] }
  const [editEx,       setEditEx]       = useState(null);
  const [setsData,     setSetsData]     = useState([]);
  // Unified selection: null | 'rir0'|'rir1'|'rir2'|'rir3'|'rir4' | 'failure'|'superset'|'finisher'
  const [editMode,     setEditMode]     = useState(null);
  const [editSaving,   setEditSaving]   = useState(false);

  const openEdit = (ex) => {
    setEditEx(ex);
    const sd = ex.sets_data?.length
      ? ex.sets_data
      : Array.from({ length: ex.sets || 3 }, () => ({ weight: String(ex.weight || ''), reps: String(ex.reps || 10) }));
    // Add stable _key to each set to avoid animation key conflicts
    setSetsData(sd.map((s, idx) => ({
      weight: String(s.weight ?? ''),
      reps:   String(s.reps ?? ''),
      _key:   `${ex.id}-${idx}-${Date.now()}`,
    })));
    const savedMode = ex.intensity
      ? ex.intensity
      : (ex.rir != null && ex.rir !== '' ? `rir${ex.rir}` : null);
    setEditMode(savedMode);
    setView('exerciseDetail');
  };

  const updateSetField = (i, field, val) =>
    setSetsData(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  const addSet = () =>
    setSetsData(prev => [...prev, {
      weight: '',
      reps:   '',
      _key:   `new-${Date.now()}-${Math.random()}`,
    }]);

  const removeSet = (i) => setSetsData(prev => prev.filter((_, idx) => idx !== i));

  const saveEdit = async () => {
    if (!editEx || !active) return;
    setEditSaving(true);
    try {
      const cleanSets = setsData.map(s => ({
        weight: parseFloat(s.weight) || 0,
        reps:   parseInt(s.reps)    || 0,
      }));
      const isRir  = editMode?.startsWith('rir');
      const rirVal = isRir ? parseInt(editMode.replace('rir', '')) : null;

      const { error } = await supabase
        .from('workout_exercises')
        .update({
          sets:      cleanSets.length,
          reps:      cleanSets[0]?.reps || 10,
          weight:    cleanSets[0]?.weight || 0,
          rir:       rirVal,
          sets_data: cleanSets,
          intensity: isRir ? null : (editMode ?? null),
        })
        .eq('id', editEx.id);

      if (error) { Alert.alert('Error', error.message); return; }

      await loadWorkoutExercises(active.id);
      setEditEx(null);
      setView('detail'); // explicitly navigate back
    } finally {
      setEditSaving(false);
    }
  };

  // ── Create Template screen ─────────────────────────────────────────────────
  if (view === 'createTemplate') {
    const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun
    const DAY_TR    = { 0:'Pazar', 1:'Pazartesi', 2:'Salı', 3:'Çarşamba', 4:'Perşembe', 5:'Cuma', 6:'Cumartesi' };
    const DAY_EN    = { 0:'Sunday', 1:'Monday', 2:'Tuesday', 3:'Wednesday', 4:'Thursday', 5:'Friday', 6:'Saturday' };
    const DAY_LABEL = (d) => lang === 'tr' ? DAY_TR[d] : DAY_EN[d];
    const activeDayCount = DAY_ORDER.filter(d => (daySchedule[d] ?? []).length > 0).length;

    return (
      <View style={wt.fill}>
        {ToastNode}
        <SubHdr
          title={t('createTemplate', lang)}
          onBack={() => { setView('detail'); setSelectedEx(null); setDaySchedule({}); }}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

            {/* Plan bilgileri */}
            <TextInput
              style={wt.createInput}
              value={tmplForm.title}
              onChangeText={v => setTmplForm(f => ({ ...f, title: v }))}
              placeholder={t('planNameRequired', lang)}
              placeholderTextColor={C.dim}
            />
            <TextInput
              style={[wt.createInput, { height: 64, textAlignVertical: 'top', paddingTop: 10 }]}
              value={tmplForm.description}
              onChangeText={v => setTmplForm(f => ({ ...f, description: v }))}
              placeholder={t('description', lang)}
              placeholderTextColor={C.dim}
              multiline
            />

            {/* Exercise pool */}
            <Text style={[wt.tmplSectionLabel, { marginTop: 4 }]}>
              {t('exercisesSelectHint', lang)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {wkExercises.length > 0 ? wkExercises.map((ex, i) => {
                const isSel = selectedEx === ex.exercise_name;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[wt.exChip, isSel && wt.exChipSelected]}
                    onPress={() => setSelectedEx(isSel ? null : ex.exercise_name)}
                    activeOpacity={0.75}
                  >
                    {isSel && <Ionicons name="checkmark-circle" size={13} color="#fff" style={{ marginRight: 4 }} />}
                    <Text style={[wt.exChipTxt, isSel && { color: '#fff', fontWeight: '800' }]} numberOfLines={1}>
                      {ex.exercise_name}
                    </Text>
                  </TouchableOpacity>
                );
              }) : (
                <Text style={{ color: C.dim, fontSize: 13 }}>
                  {t('addExercisesFirst', lang)}
                </Text>
              )}
            </ScrollView>
            {selectedEx && (
              <Text style={{ color: '#dc2626', fontSize: 12, marginBottom: 4 }}>
                ✦ {lang === 'tr' ? `"${selectedEx}" seçildi — bir güne dokun` : `"${selectedEx}" selected — tap a day below`}
              </Text>
            )}

            {/* 7 gün kutuları */}
            <Text style={[wt.tmplSectionLabel, { marginTop: 8 }]}>
              {t('weeklySchedule', lang)}
            </Text>
            {DAY_ORDER.map(dayIdx => {
              const exsInDay = daySchedule[dayIdx] ?? [];
              const hasEx    = exsInDay.length > 0;
              return (
                <View key={dayIdx} style={wt.dayBox}>
                  <View style={wt.dayHeader}>
                    <Text style={wt.dayLabel}>{DAY_LABEL(dayIdx)}</Text>
                    {hasEx && (
                      <Text style={wt.dayCount}>{exsInDay.length} ex</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[wt.dayDropArea, selectedEx && wt.dayDropAreaActive]}
                    onPress={() => addExToDay(dayIdx)}
                    activeOpacity={selectedEx ? 0.7 : 1}
                  >
                    {exsInDay.map((exName, i) => (
                      <View key={i} style={wt.dayExRow}>
                        <Ionicons name="barbell-outline" size={13} color="#dc2626" />
                        <Text style={wt.dayExName} numberOfLines={1}>{exName}</Text>
                        <TouchableOpacity onPress={() => removeExFromDay(dayIdx, i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle-outline" size={16} color={C.dim} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {selectedEx ? (
                      <Text style={wt.dayAddHint}>+ {selectedEx}</Text>
                    ) : (
                      !hasEx && <Text style={wt.dayEmpty}>{t('restDay', lang)}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Haftalık gün özet */}
            <View style={wt.daysSummary}>
              <Ionicons name="calendar-outline" size={16} color={activeDayCount > 0 ? C.lime : C.dim} />
              <Text style={[wt.daysSummaryTxt, { color: activeDayCount > 0 ? C.lime : C.dim }]}>
                {lang === 'tr'
                  ? `Haftalık ${activeDayCount} antrenman günü`
                  : `${activeDayCount} training day${activeDayCount !== 1 ? 's' : ''} per week`}
              </Text>
            </View>
          </ScrollView>

          {/* Kaydet butonu */}
          <View style={{ padding: 16, paddingBottom: 24 }}>
            <TouchableOpacity onPress={saveTemplate} disabled={!tmplForm.title.trim() || activeDayCount === 0}>
              <LinearGradient
                colors={tmplForm.title.trim() && activeDayCount > 0 ? ['#dc2626','#7f1d1d'] : [C.s2, C.s2]}
                style={wt.createBtnGrad}
              >
                <Text style={wt.createBtnTxt}>{t('saveTemplate', lang)}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Picker screen ──────────────────────────────────────────────────────────
  if (view === 'picker') {
    const filtered = pickerSearch.trim()
      ? allEx.filter(e => e.name.toLowerCase().includes(pickerSearch.toLowerCase()))
      : allEx;

    // Group by first letter
    const groups = {};
    filtered.forEach(e => {
      const key = e.name[0].toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });

    return (
      <View style={[wt.fill, { backgroundColor: C.bg }]}>
        <SubHdr
          title={t('addExercises', lang)}
          onBack={() => { setView('detail'); setPickerSel(new Set()); }}
        />
        {/* Search */}
        <View style={ed.pickerSearch}>
          <Ionicons name="search-outline" size={18} color={C.dim} />
          <TextInput style={ed.pickerInput} value={pickerSearch} onChangeText={setPickerSearch} placeholder={t('searchPlaceholder', lang)} placeholderTextColor={C.dim} />
        </View>

        {loadingPicker
          ? <ActivityIndicator color={C.lime} style={{ marginTop: 40 }} />
          : (
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              {Object.keys(groups).sort().map(letter => (
                <View key={letter}>
                  <View style={ed.pickerLetterRow}>
                    <Text style={ed.pickerLetter}>{letter}</Text>
                    <View style={ed.pickerLetterLine} />
                  </View>
                  {groups[letter].map(ex => {
                    const sel = pickerSel.has(ex.name);
                    return (
                      <TouchableOpacity key={ex.id} style={ed.pickerRow} onPress={() => {
                        setPickerSel(prev => { const n = new Set(prev); sel ? n.delete(ex.name) : n.add(ex.name); return n; });
                      }}>
                        <Text style={ed.pickerExName}>{ex.name}</Text>
                        <View style={[ed.checkbox, sel && ed.checkboxActive]}>
                          {sel && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )
        }

        {/* Bottom CTA */}
        <View style={ed.pickerBottom}>
          <TouchableOpacity style={[ed.pickerAddBtn, pickerSel.size === 0 && { opacity: 0.5 }]} onPress={addPickerExercises} disabled={pickerSel.size === 0}>
            <LinearGradient colors={['#dc2626', '#7f1d1d']} style={ed.pickerAddGrad}>
              <Text style={ed.pickerAddTxt}>
                {pickerSel.size > 0
                  ? `${t('addExercises', lang)} (${pickerSel.size})`
                  : t('selectExercises', lang)
                }
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Exercise detail (set-by-set logging) ──────────────────────────────────
  if (view === 'exerciseDetail' && editEx) {
    const totalVol = setsData.reduce((a, s) => a + (parseFloat(s.weight)||0)*(parseInt(s.reps)||0), 0);

    return (
      <View style={[wt.fill, { backgroundColor: C.bg }]}>
        <SubHdr
          title={editEx.exercise_name}
          onBack={() => { setEditEx(null); setView('detail'); }}
          right={[
            <TouchableOpacity key="save" onPress={saveEdit} disabled={editSaving} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#dc2626', borderRadius: 10 }}>
              {editSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{t('save', lang)}</Text>}
            </TouchableOpacity>,
          ]}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            {/* Volume summary */}
            <View style={ed.summaryRow}>
              <View style={ed.summaryItem}>
                <Text style={ed.summaryVal}>{setsData.length}</Text>
                <Text style={ed.summaryLbl}>{t('sets', lang)}</Text>
              </View>
              <View style={ed.summaryDiv} />
              <View style={ed.summaryItem}>
                <Text style={ed.summaryVal}>{setsData[0]?.weight || '—'}</Text>
                <Text style={ed.summaryLbl}>kg</Text>
              </View>
              <View style={ed.summaryDiv} />
              <View style={ed.summaryItem}>
                <Text style={ed.summaryVal}>{totalVol > 0 ? `${totalVol}` : '—'}</Text>
                <Text style={ed.summaryLbl}>{t('volume', lang)}</Text>
              </View>
              <View style={ed.summaryDiv} />
              <View style={ed.summaryItem}>
                <Text numberOfLines={1} style={[ed.summaryVal, { fontSize: editMode ? 13 : 22 }]}>
                  {editMode
                    ? editMode.startsWith('rir') ? `RIR ${editMode.replace('rir','')}` : editMode
                    : '—'
                  }
                </Text>
                <Text style={ed.summaryLbl}>{t('mode', lang)}</Text>
              </View>
            </View>


            {/* Column headers */}
            <View style={ed.tableHeader}>
              <Text style={[ed.thTxt, { width: 36 }]}>Set</Text>
              <Text style={[ed.thTxt, { flex: 1 }]}>{t('weightKg', lang)}</Text>
              <Text style={[ed.thTxt, { flex: 1 }]}>{t('reps', lang)}</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Set rows — stable keys to prevent animation glitches */}
            {setsData.map((s, i) => (
              <View key={s._key || i} style={ed.setRow}>
                <View style={ed.setNum}><Text style={ed.setNumTxt}>{i + 1}</Text></View>
                <TextInput
                  style={ed.setInput}
                  value={s.weight}
                  onChangeText={v => updateSetField(i, 'weight', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={C.dim}
                  textAlign="center"
                />
                <TextInput
                  style={ed.setInput}
                  value={s.reps}
                  onChangeText={v => updateSetField(i, 'reps', v)}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={C.dim}
                  textAlign="center"
                />
                <TouchableOpacity onPress={() => removeSet(i)} style={{ width: 32, alignItems: 'center' }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="remove-circle-outline" size={20} color={C.dim} />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add set */}
            <TouchableOpacity style={ed.addSetRow} onPress={addSet}>
              <Ionicons name="add-circle" size={20} color="#dc2626" />
              <Text style={ed.addSetTxt}>{t('addSet', lang)}</Text>
            </TouchableOpacity>

            {/* Unified mode selector — mutually exclusive */}
            <View style={{ marginTop: 16 }}>
              <Text style={ed.modeSectionLabel}>{t('intensityRIR', lang)}</Text>

              {/* RIR row */}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 8, alignItems: 'center' }}>
                <Text style={ed.rirPrefixLabel}>RIR</Text>
                {['0','1','2','3','4'].map(v => {
                  const key = `rir${v}`;
                  const active = editMode === key;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[ed.rirBtn, active && ed.rirBtnActive]}
                      onPress={() => setEditMode(active ? null : key)}
                    >
                      <Text style={[ed.rirBtnTxt, active && { color: '#fff', fontWeight: '800' }]}>{v}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Intensity buttons */}
              <View style={ed.intensityRow}>
                {[
                  { key: 'failure',  label: 'Failure',  icon: 'flash' },
                  { key: 'superset', label: 'Superset', icon: 'repeat' },
                  { key: 'finisher', label: 'Finisher', icon: 'flag' },
                ].map(({ key, label, icon }) => {
                  const active = editMode === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[ed.intensityBtn, active && ed.intensityBtnActive]}
                      onPress={() => setEditMode(active ? null : key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={`${icon}${active ? '' : '-outline'}`} size={16} color={active ? '#fff' : C.muted} />
                      <Text style={[ed.intensityTxt, active && { color: '#fff', fontWeight: '800' }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Terim açıklamaları */}
            <View style={ed.termSection}>
              <Text style={ed.termSectionTitle}>{t('terminology', lang)}</Text>
              {Object.entries(TERIMLER[lang] ?? TERIMLER.tr).map(([term, desc]) => (
                <View key={term} style={ed.termItem}>
                  <View style={ed.termHeader}>
                    <View style={ed.termBadge}><Text style={ed.termBadgeTxt}>{term}</Text></View>
                  </View>
                  <Text style={ed.termDesc}>{desc}</Text>
                </View>
              ))}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Workout detail screen ──────────────────────────────────────────────────
  if (view === 'detail' && active) {
    return (
      <View style={[wt.fill, { backgroundColor: C.bg, position: 'relative' }]}>
        <ConfirmModal
          visible={confirmDeleteWorkout}
          title={t('deleteWorkout', lang)}
          message={lang === 'tr' ? `"${active.title}" ve tüm egzersizleri silinecek.` : `"${active.title}" and all its exercises will be deleted.`}
          confirmLabel={t('delete', lang)}
          confirmColor="#dc2626"
          lang={lang}
          onCancel={() => setConfirmDeleteWorkout(false)}
          onConfirm={doDeleteWorkout}
        />
        <SubHdr
          title={active.title}
          onBack={() => { setView('main'); setActive(null); }}
          right={[
            <TouchableOpacity key="edit" onPress={() => { setEditWorkoutForm({ title: active.title, description: active.description || '' }); setEditingWorkout(true); }} style={{ padding: 6 }}>
              <Ionicons name="pencil-outline" size={20} color={C.muted} />
            </TouchableOpacity>,
            <TouchableOpacity key="del" onPress={deleteWorkout} style={{ padding: 6 }}>
              <Ionicons name="trash-outline" size={20} color={C.red} />
            </TouchableOpacity>,
          ]}
        />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {active.description ? <Text style={wt.detailDesc}>{active.description}</Text> : null}

          {wkExercises.length > 0 && (
            <>
              <Text style={wt.detailSectionTitle}>{t('exercisesLabel', lang)}</Text>
              {wkExercises.map((ex, i) => (
                <Animated.View key={ex.id} entering={FadeInLeft.delay(i * 40).duration(260)}>
                  <TouchableOpacity style={wt.exCard} onPress={() => openEdit(ex)} activeOpacity={0.75}>
                    <View style={wt.exCardIcon}>
                      <Ionicons name="barbell-outline" size={18} color="#dc2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={wt.exCardName}>{ex.exercise_name}</Text>
                      <View style={wt.exCardMeta}>
                        <View style={wt.exMetaItem}><Ionicons name="copy-outline" size={11} color={C.dim} /><Text style={wt.exMetaTxt}>{ex.sets} {t('sets', lang)}</Text></View>
                        <View style={wt.exMetaItem}><Ionicons name="repeat-outline" size={11} color={C.dim} /><Text style={wt.exMetaTxt}>{ex.reps} {t('repsShort', lang)}</Text></View>
                        <View style={wt.exMetaItem}><Ionicons name="speedometer-outline" size={11} color={C.dim} /><Text style={wt.exMetaTxt}>{ex.rir} RIR</Text></View>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <View style={wt.editBadge}><Ionicons name="pencil" size={12} color="#dc2626" /></View>
                      <TouchableOpacity onPress={() => removeExercise(ex.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle-outline" size={18} color={C.dim} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </>
          )}

          <TouchableOpacity style={wt.addExBtn} onPress={openPicker}>
            <LinearGradient colors={['#dc2626', '#7f1d1d']} style={wt.addExGrad}>
              <Text style={wt.addExTxt}>{t('addExercises', lang)}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Create Template from this workout */}
          <TouchableOpacity
            style={wt.activeProgramBtn}
            onPress={openCreateTemplate}
          >
            <Ionicons name="bookmark-outline" size={16} color={C.lime} />
            <Text style={wt.activeProgramTxt}>
              {t('createTemplate', lang)}
            </Text>
          </TouchableOpacity>
        </ScrollView>

      {/* Edit Workout Modal */}
      <Modal visible={editingWorkout} transparent animationType="slide" onRequestClose={() => setEditingWorkout(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={wt.modalOverlay} activeOpacity={1} onPress={() => setEditingWorkout(false)}>
            <TouchableOpacity activeOpacity={1} style={wt.createModal} onPress={() => {}}>
              <View style={wt.createHandle} />
              <Text style={wt.createTitle}>{t('editWorkout', lang)}</Text>
              <TextInput
                style={wt.createInput}
                value={editWorkoutForm.title}
                onChangeText={v => setEditWorkoutForm(f => ({ ...f, title: v }))}
                placeholder={t('workoutTitle', lang)}
                placeholderTextColor={C.dim}
              />
              <TextInput
                style={[wt.createInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                value={editWorkoutForm.description}
                onChangeText={v => setEditWorkoutForm(f => ({ ...f, description: v }))}
                placeholder={t('descriptionOptional', lang)}
                placeholderTextColor={C.dim}
                multiline
              />
              <TouchableOpacity style={[wt.createBtn, { marginTop: 8 }]} onPress={saveWorkoutEdit} disabled={!editWorkoutForm.title.trim()}>
                <LinearGradient colors={['#dc2626','#7f1d1d']} style={wt.createBtnGrad}>
                  <Text style={wt.createBtnTxt}>{t('save', lang)}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      </View>
    );
  }

  // ── Main workouts list ──────────────────────────────────────────────────────
  return (
    <View style={[wt.fill, { position: 'relative' }]}>
      {ToastNode}
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* ⚡ Hızlı Antrenman — süre & odak seç, anında hazır */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => setQuickOpen(true)} style={wt.quickCard}>
          <LinearGradient colors={['rgba(232,244,74,0.14)', 'rgba(232,244,74,0.03)']} start={{x:0,y:0}} end={{x:1,y:1}} style={wt.quickGrad}>
            <View style={wt.quickIcon}><Ionicons name="flash" size={22} color={C.lime} /></View>
            <View style={{ flex: 1 }}>
              <Text style={wt.quickTitle}>{t('quickWorkout', lang)}</Text>
              <Text style={wt.quickDesc}>{t('quickWorkoutDesc', lang)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.lime} />
          </LinearGradient>
        </TouchableOpacity>

        {/* All Workouts accordion */}
        <TouchableOpacity style={wt.accordion} onPress={() => setAllOpen(v => !v)}>
          <Text style={wt.accordionTitle}>{t('allWorkouts', lang)}</Text>
          <Ionicons name={allOpen ? 'chevron-up' : 'chevron-down'} size={18} color='#dc2626' />
        </TouchableOpacity>

        {allOpen && (
          <>
            <TouchableOpacity style={wt.addWorkout} onPress={() => setCreating(true)}>
              <Ionicons name="add" size={20} color='#dc2626' />
              <Text style={wt.addWorkoutTxt}>{t('addWorkout', lang)}</Text>
            </TouchableOpacity>
            <View style={wt.separator} />

            {workouts.map((w, i) => (
              <Animated.View key={w.id} entering={FadeInDown.delay(i * 40).duration(280)}>
                <TouchableOpacity style={wt.workoutCard} onPress={() => openDetail(w)}>
                  <View style={{ flex: 1 }}>
                    <Text style={wt.workoutTitle}>{w.title}</Text>
                    {w.description ? <Text style={wt.workoutDesc} numberOfLines={1}>{w.description}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.dim} />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={wt.fab} onPress={() => setCreating(true)}>
        <LinearGradient colors={['#dc2626', '#7f1d1d']} style={wt.fabGrad}>
          <Ionicons name="add" size={26} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ⚡ Hızlı Antrenman paneli — in-tree overlay (native Modal bu cihazda buglu) */}
      {quickOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableOpacity style={wt.modalOverlay} activeOpacity={1} onPress={() => setQuickOpen(false)}>
            <TouchableOpacity activeOpacity={1} style={wt.createModal} onPress={() => {}}>
              <View style={wt.createHandle} />
              <Text style={wt.createTitle}>⚡ {t('quickWorkout', lang)}</Text>

              <Text style={wt.quickSection}>{t('duration', lang)}</Text>
              <View style={wt.quickChipRow}>
                {[15, 30, 45, 60].map(d => (
                  <TouchableOpacity key={d} onPress={() => setQuickDur(d)}
                    style={[wt.quickChip, quickDur === d && wt.quickChipOn]}>
                    <Text style={[wt.quickChipTxt, quickDur === d && { color: C.bg, fontWeight: '900' }]}>{d} {lang==='tr'?'dk':'min'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={wt.quickSection}>{t('focusLabel', lang)}</Text>
              <View style={wt.quickChipRow}>
                {[
                  { k:'full_body', lbl: lang==='tr'?'Tüm Vücut':'Full Body' },
                  { k:'upper',     lbl: lang==='tr'?'Üst Vücut':'Upper'     },
                  { k:'lower',     lbl: lang==='tr'?'Alt Vücut':'Lower'     },
                  { k:'core',      lbl: 'Core' },
                ].map(f => (
                  <TouchableOpacity key={f.k} onPress={() => setQuickFocus(f.k)}
                    style={[wt.quickChip, quickFocus === f.k && wt.quickChipOn]}>
                    <Text style={[wt.quickChipTxt, quickFocus === f.k && { color: C.bg, fontWeight: '900' }]}>{f.lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={wt.createBtn} onPress={generateQuick} disabled={quickGen}>
                <LinearGradient colors={['#e8f44a', '#a3c200']} style={wt.createBtnGrad}>
                  {quickGen
                    ? <ActivityIndicator color={C.bg} />
                    : <Text style={[wt.createBtnTxt, { color: C.bg }]}>{t('generate', lang)}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}

      {/* Create modal */}
      <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={wt.modalOverlay} activeOpacity={1} onPress={() => setCreating(false)}>
            <TouchableOpacity activeOpacity={1} style={wt.createModal} onPress={() => {}}>
              <View style={wt.createHandle} />
              <Text style={wt.createTitle}>{t('newWorkout', lang)}</Text>
              <TextInput style={wt.createInput} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder={t('title', lang)} placeholderTextColor={C.dim} />
              <TextInput style={wt.createInput} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder={t('description', lang)} placeholderTextColor={C.dim} />
              <TouchableOpacity style={wt.createBtn} onPress={createWorkout} disabled={saving || !form.title.trim()}>
                <LinearGradient colors={['#dc2626', '#7f1d1d']} style={wt.createBtnGrad}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={wt.createBtnTxt}>{t('create', lang)}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const wt = StyleSheet.create({
  fill:           { flex: 1, backgroundColor: C.bg },
  subHdr:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:        { width: 40, height: 40, borderRadius: 12, backgroundColor: C.s1, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  subHdrTitle:    { flex: 1, color: C.text, fontSize: 16, fontWeight: '800', textAlign: 'center', marginHorizontal: 8 },
  accordion:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 20 },
  accordionTitle: { color: '#dc2626', fontSize: 18, fontWeight: '800' },
  addWorkout:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16 },
  addWorkoutTxt:  { color: '#dc2626', fontSize: 16, fontWeight: '600' },
  separator:      { height: 1, backgroundColor: C.border, marginHorizontal: 20 },
  workoutCard:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  workoutTitle:   { color: C.text, fontSize: 15, fontWeight: '700' },
  workoutDesc:    { color: C.muted, fontSize: 12, marginTop: 2 },
  fab:            { position: 'absolute', bottom: 24, right: 20, width: 58, height: 58, borderRadius: 29, overflow: 'hidden' },
  fabGrad:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  createModal:    { backgroundColor: C.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, borderWidth: 1, borderColor: C.border },
  createHandle:   { width: 40, height: 4, backgroundColor: C.s3, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  createTitle:    { color: C.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 16 },
  createInput:    { backgroundColor: C.s2, borderRadius: 14, borderWidth: 1, borderColor: C.border, height: 52, paddingHorizontal: 16, color: C.text, fontSize: 15, marginBottom: 10 },
  createBtn:      { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  createBtnGrad:  { height: 52, alignItems: 'center', justifyContent: 'center' },
  createBtnTxt:   { color: '#fff', fontWeight: '900', fontSize: 16 },
  // Detail
  detailDesc:     { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  detailSectionTitle: { color: C.text, fontSize: 13, fontWeight: '800', marginBottom: 10 },
  exCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.s1, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  exCardIcon:     { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(232,244,74,0.08)', alignItems: 'center', justifyContent: 'center' },
  exCardName:     { color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  exCardMeta:     { flexDirection: 'row', gap: 10 },
  exMetaItem:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  exMetaTxt:      { color: C.dim, fontSize: 10 },
  activeProgramBtn:{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  // ⚡ Hızlı Antrenman
  quickCard:    { marginHorizontal: 16, marginTop: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.lime + '44' },
  quickGrad:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  quickIcon:    { width: 42, height: 42, borderRadius: 13, backgroundColor: C.lime + '1A', alignItems: 'center', justifyContent: 'center' },
  quickTitle:   { color: C.text, fontSize: 15, fontWeight: '800' },
  quickDesc:    { color: C.muted, fontSize: 12, marginTop: 2 },
  quickSection: { color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  quickChip:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.s2 },
  quickChipOn:  { backgroundColor: C.lime, borderColor: C.lime },
  quickChipTxt: { color: C.muted, fontSize: 13, fontWeight: '700' },
  activeProgramTxt:{ color: C.lime, fontSize: 14, fontWeight: '700' },
  tmplSectionLabel:{ color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  tmplChip:        { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.s2 },
  tmplChipActive:  { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  tmplChipTxt:     { color: C.muted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  addExBtn:       { borderRadius: 14, overflow: 'hidden', marginTop: 16 },
  addExGrad:      { height: 52, alignItems: 'center', justifyContent: 'center' },
  addExTxt:       { color: '#fff', fontWeight: '900', fontSize: 15 },
  editBadge:      { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(220,38,38,0.12)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)', alignItems: 'center', justifyContent: 'center' },
  editModal:      { backgroundColor: C.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, borderWidth: 1, borderColor: 'rgba(220,38,38,0.2)' },
  editFieldLabel: { color: C.muted, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  editFieldInput: { backgroundColor: C.s2, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(220,38,38,0.3)', width: '100%', height: 52, fontSize: 22, fontWeight: '900', color: C.text },
});

// ─── Exercise detail styles ───────────────────────────────────────────────────
const ed = StyleSheet.create({
  summaryRow:   { flexDirection: 'row', backgroundColor: C.s1, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryVal:   { color: C.text, fontSize: 22, fontWeight: '900' },
  summaryLbl:   { color: C.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  summaryDiv:   { width: 1, backgroundColor: C.border },
  chartWrap:    { backgroundColor: C.s1, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  chartBars:    { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 72, marginBottom: 8 },
  chartBarCol:  { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  chartBar:     { width: '100%', backgroundColor: '#dc2626', borderRadius: 4, minHeight: 4 },
  chartBarLbl:  { color: C.dim, fontSize: 10, fontWeight: '600' },
  chartTitle:   { color: C.muted, fontSize: 11, textAlign: 'center' },
  tableHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8, gap: 8 },
  thTxt:        { color: C.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  setRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setNum:       { width: 36, height: 42, borderRadius: 12, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)' },
  setNumTxt:    { color: '#dc2626', fontWeight: '900', fontSize: 14 },
  setInput:     { flex: 1, height: 48, backgroundColor: C.s1, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, color: C.text, fontSize: 16, fontWeight: '700' },
  addSetRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, justifyContent: 'center', borderTopWidth: 1, borderTopColor: C.border, marginTop: 4 },
  addSetTxt:    { color: '#dc2626', fontSize: 15, fontWeight: '700' },
  rirRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, backgroundColor: C.s1, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  rirLabel:         { color: C.muted, fontSize: 13, fontWeight: '800' },
  modeSectionLabel: { color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  rirPrefixLabel:   { color: C.muted, fontSize: 12, fontWeight: '700', width: 30 },
  rirBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.s2 },
  rirBtnActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  rirBtnTxt:    { color: C.muted, fontSize: 14, fontWeight: '600' },
  intensityRow:    { flexDirection: 'row', gap: 8, marginTop: 14 },
  intensityBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.s1 },
  intensityBtnActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  intensityTxt:    { color: C.muted, fontSize: 12, fontWeight: '600' },
  termSection:  { marginTop: 20, backgroundColor: C.s1, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  termSectionTitle: { color: C.text, fontSize: 13, fontWeight: '800', marginBottom: 12 },
  termItem:     { marginBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 14 },
  termHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  termBadge:    { backgroundColor: 'rgba(220,38,38,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)' },
  termBadgeTxt: { color: '#dc2626', fontSize: 12, fontWeight: '800' },
  termDesc:     { color: C.muted, fontSize: 12, lineHeight: 18 },
  // Picker (referenced from WorkoutsTab as ed.pickerSearch etc, or keep in wt)
  pickerSearch:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.s1, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 48, margin: 16, marginBottom: 8 },
  pickerInput:    { flex: 1, color: C.text, fontSize: 14 },
  pickerLetterRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  pickerLetter:   { color: C.text, fontSize: 16, fontWeight: '900', width: 20 },
  pickerLetterLine:{ flex: 1, height: 1, backgroundColor: C.border },
  pickerRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerExName:   { color: C.text, fontSize: 14, flex: 1 },
  checkbox:       { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.dim, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  pickerBottom:   { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: C.bg },
  pickerAddBtn:   { borderRadius: 14, overflow: 'hidden' },
  pickerAddGrad:  { height: 52, alignItems: 'center', justifyContent: 'center' },
  pickerAddTxt:   { color: '#fff', fontWeight: '900', fontSize: 15 },
});

// ─── Templates Tab ────────────────────────────────────────────────────────────
const LEVEL_COLORS = { beginner: C.green, intermediate: C.orange, advanced: C.red };
const LEVEL_LABELS_TR = { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' };
const LEVEL_LABELS_EN = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const GOAL_LABELS_TR = { strength: 'Güç', bodybuilding: 'Kas Kazan', fat_loss: 'Yağ Yakma', general_fitness: 'Formda Kal', athleticism: 'Atletizm', powerlifting: 'Powerlifting', hypertrophy: 'Hipertrofi' };
const GOAL_LABELS_EN = { strength: 'Strength', bodybuilding: 'Build Muscle', fat_loss: 'Fat Loss', general_fitness: 'Keep Fit', athleticism: 'Athleticism', powerlifting: 'Powerlifting', hypertrophy: 'Hypertrophy' };

function TemplatesTab({ lang, planFilter }) {
  const [view,       setView]       = useState('main');
  const [selected,   setSelected]   = useState(null);
  const [filterDays, setFilterDays] = useState([]);
  const [filterLvl,  setFilterLvl]  = useState([]);
  const [filterGoal, setFilterGoal] = useState([]);

  // AI Koç "Planımı Al" → seçilen gün sayısı + hedefe göre şablonları filtrele.
  // ts değiştikçe (her navigate) yeniden uygulanır; kullanıcı sonra elle değiştirebilir.
  useEffect(() => {
    if (!planFilter) return;
    if (typeof planFilter.filterDays === 'number') setFilterDays([planFilter.filterDays]);
    if (planFilter.filterGoal) setFilterGoal([planFilter.filterGoal]);
  }, [planFilter?.ts]);
  const [showPaid,   setShowPaid]   = useState('all');
  const [plansOpen,  setPlansOpen]  = useState(true);
  const [myPlansOpen,setMyPlansOpen]= useState(true);
  const [myPlans,    setMyPlans]    = useState([]);
  const [activeTab,  setActiveTab]  = useState('all');
  const [confirmDel,     setConfirmDel]     = useState(null);
  const [confirmAct,     setConfirmAct]     = useState(null);
  const [confirmReplace, setConfirmReplace] = useState(null); // {plan, existing} — replace warning
  const { show: showToast, ToastNode } = useToast();

  useEffect(() => {
    getMyPlans().then(setMyPlans);
  }, []);

  // Refresh my plans when coming back from detail
  useEffect(() => {
    if (view === 'main') getMyPlans().then(setMyPlans);
  }, [view]);

  const levelLabel = (lv) => lang === 'tr' ? LEVEL_LABELS_TR[lv] : LEVEL_LABELS_EN[lv];
  const goalLabel  = (g)  => lang === 'tr' ? GOAL_LABELS_TR[g] : GOAL_LABELS_EN[g];

  // Workout'un dayOfWeek'ini güncelle; my plan ise AsyncStorage'a kaydet
  const updateWorkoutDay = async (workoutIndex, newDay) => {
    const updated = {
      ...selected,
      workouts: selected.workouts.map((w, i) =>
        i === workoutIndex ? { ...w, dayOfWeek: newDay === w.dayOfWeek ? undefined : newDay } : w
      ),
    };
    setSelected(updated);
    if (updated.isMine) {
      const plans = await getMyPlans();
      await saveMyPlan({ ...plans.find(p => p.id === updated.id), ...updated });
    }
  };

  const filtered = TRAINING_PLANS.filter(p => {
    if (showPaid === 'free' && p.isPaid) return false;
    if (showPaid === 'paid' && !p.isPaid) return false;
    if (filterDays.length && !filterDays.includes(p.days)) return false;
    if (filterLvl.length  && !filterLvl.includes(p.level))  return false;
    if (filterGoal.length && !p.goals.some(g => filterGoal.includes(g))) return false;
    return true;
  }).sort((x, y) => {
    // AI Koç: evde çalışan kullanıcıya ev-dostu şablonları önce göster (filtre değil, sıralama)
    if (planFilter?.sortEnv !== 'home') return 0;
    const homey = (p) => (p.environment ?? []).some(e => e === 'home' || e === 'minimal_equipment') ? 0 : 1;
    return homey(x) - homey(y);
  });

  const toggleArr = (arr, setArr, val) => {
    setArr(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  };

  const hasFilters = filterDays.length + filterLvl.length + filterGoal.length > 0;

  // ── Single return — modals always mounted regardless of view ─────────────────
  const lvColor = selected ? (LEVEL_COLORS[selected.level] ?? C.lime) : C.lime;

  return (
    <View style={[wt.fill, { position: 'relative' }]}>
      {/* ── Always-mounted modals ── */}
      {/* Confirm: Replace existing active program */}
      <ConfirmModal
        visible={!!confirmReplace}
        title={t('activeProgramExists', lang)}
        message={confirmReplace
          ? (lang === 'tr'
              ? `"${confirmReplace.existing.title}" zaten aktif program olarak ayarlı.\n\nYeni programla değiştirmek istiyor musunuz?`
              : `"${confirmReplace.existing.title}" is already your active program.\n\nDo you want to replace it?`)
          : ''}
        confirmLabel={t('replace', lang)}
        confirmColor={C.orange}
        lang={lang}
        onCancel={() => setConfirmReplace(null)}
        onConfirm={() => {
          const { plan } = confirmReplace;
          setConfirmReplace(null);
          setConfirmAct({ plan, isFullPlan: true });
        }}
      />

      {/* Confirm: Delete plan */}
      <ConfirmModal
        visible={!!confirmDel}
        title={t('deletePlan', lang)}
        message={confirmDel ? (lang === 'tr' ? `"${confirmDel.title}" silinecek. Aktif programdaysa kaldırılır.` : `"${confirmDel.title}" will be deleted. Removed from active program if set.`) : ''}
        confirmLabel={t('delete', lang)}
        confirmColor="#dc2626"
        lang={lang}
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          const ap = await getActiveProgram();
          if (ap && (ap.id === confirmDel.id || ap.id?.startsWith(confirmDel.id))) {
            await clearActiveProgram();
          }
          await deleteMyPlan(confirmDel.id);
          getMyPlans().then(setMyPlans);
          setConfirmDel(null);
          showToast(t('planDeleted', lang), 'error');
        }}
      />

      {/* Confirm: Set active program */}
      <ConfirmModal
        visible={!!confirmAct}
        title={t('setActiveProgramTitle', lang)}
        message={confirmAct ? (lang === 'tr' ? `"${confirmAct.plan?.title}" tüm günleriyle birlikte aktif program olacak.` : `"${confirmAct.plan?.title}" with all days will be set as your active program.`) : ''}
        confirmLabel={t('set', lang)}
        confirmColor={C.lime}
        lang={lang}
        onCancel={() => setConfirmAct(null)}
        onConfirm={async () => {
          const { plan, isFullPlan } = confirmAct;
          await setActiveProgram({
            id:              plan.id,
            title:           plan.title,
            description:     plan.description,
            description_en:  plan.description_en,
            // Full plan: multiple workouts; single workout: wrapped in array
            workouts:    plan.workouts.map(w => ({
              name:       w.name,
              name_en:    w.name_en,
              dayOfWeek:  w.dayOfWeek,
              exercises: (w.exercises || []).map(ex => (typeof ex === 'string' ? { name: ex } : ex)),
            })),
          });
          setConfirmAct(null);
          showToast(lang === 'tr' ? `✓ "${plan.title}" aktif program!` : `✓ "${plan.title}" set as active!`, 'success');
        }}
      />

      {/* Toast */}
      {ToastNode}

      {/* ── Filter view ── */}
      {view === 'filter' && (
        <View style={[wt.fill, { backgroundColor: C.bg }]}>
          <View style={ft.header}>
            <Text style={ft.title}>{t('filters', lang)}</Text>
            <TouchableOpacity onPress={() => setView('main')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            <Text style={ft.sectionLabel}>{t('numberOfDays', lang)}</Text>
            <View style={ft.chipRow}>
              {[1,2,3,4,5,6].map(d => (
                <TouchableOpacity key={d} style={[ft.filterChip, filterDays.includes(d) && ft.filterChipActive]} onPress={() => toggleArr(filterDays, setFilterDays, d)}>
                  <Text style={[ft.filterChipTxt, filterDays.includes(d) && ft.filterChipTxtActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={ft.sectionLabel}>{t('level', lang)}</Text>
            <View style={[ft.chipRow, { gap: 10 }]}>
              {['beginner','intermediate','advanced'].map(lv => (
                <TouchableOpacity key={lv} style={[ft.filterChip, { flex: 1 }, filterLvl.includes(lv) && ft.filterChipActive]} onPress={() => toggleArr(filterLvl, setFilterLvl, lv)}>
                  <Ionicons name="bar-chart-outline" size={18} color={filterLvl.includes(lv) ? '#fff' : C.dim} />
                  <Text style={[ft.filterChipTxt, filterLvl.includes(lv) && ft.filterChipTxtActive]}>{levelLabel(lv)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={ft.sectionLabel}>{t('goal', lang)}</Text>
            <View style={ft.iconGrid}>
              {[{g:'fat_loss',icon:'flame-outline'},{g:'bodybuilding',icon:'barbell-outline'},{g:'general_fitness',icon:'heart-outline'},{g:'strength',icon:'flash-outline'},{g:'powerlifting',icon:'trophy-outline'}].map(({g,icon}) => (
                <TouchableOpacity key={g} style={[ft.filterIconChip, filterGoal.includes(g) && ft.filterChipActive]} onPress={() => toggleArr(filterGoal, setFilterGoal, g)}>
                  <Ionicons name={icon} size={24} color={filterGoal.includes(g) ? '#fff' : C.muted} />
                  <Text style={[ft.filterIconTxt, filterGoal.includes(g) && { color: '#fff' }]}>{goalLabel(g)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={{ padding: 16 }}>
            <TouchableOpacity style={ft.filterBtn} onPress={() => setView('main')}>
              <LinearGradient colors={['#dc2626','#7f1d1d']} style={ft.filterBtnGrad}>
                <Text style={ft.filterBtnTxt}>{t('filter', lang)}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Plan detail view ── */}
      {view === 'detail' && selected && (
        <View style={[wt.fill, { backgroundColor: C.bg }]}>
          <SubHdr title={selected.title} onBack={() => { setView('main'); setSelected(null); }} />
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <Text style={ft.detailDesc}>{lang === 'en' && selected.description_en ? selected.description_en : selected.description}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="people-outline" size={14} color={C.dim} />
              <Text style={{ color: C.muted, fontSize: 12 }}>{(selected.athleteCount || 1).toLocaleString()} {t('athletes', lang)}</Text>
            </View>
            <Text style={ft.detailSection}>{t('level', lang)}</Text>
            <View style={ft.tagRow}>
              <View style={[ft.tag, { backgroundColor: lvColor + '22', borderColor: lvColor + '44' }]}>
                <Text style={[ft.tagTxt, { color: lvColor }]}>{levelLabel(selected.level)}</Text>
              </View>
            </View>
            <Text style={ft.detailSection}>{t('goal', lang)}</Text>
            <View style={ft.tagRow}>
              {(selected.goals || []).map(g => (
                <View key={g} style={ft.tag}><Text style={ft.tagTxt}>{goalLabel(g)}</Text></View>
              ))}
            </View>
            <Text style={ft.detailSection}>{t('daysPerWeek', lang)}</Text>
            <View style={ft.tagRow}><View style={ft.tag}><Text style={ft.tagTxt}>{selected.days} {t('days', lang)}</Text></View></View>
            <Text style={ft.detailSection}>{t('workoutsLabel', lang)}</Text>
            {(selected.workouts || []).map((w, i) => {
              const DAY_SHORT_TR = { 1:'Pzt', 2:'Sal', 3:'Çar', 4:'Per', 5:'Cum', 6:'Cmt', 0:'Paz' };
              const DAY_SHORT_EN = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thu', 5:'Fri', 6:'Sat', 0:'Sun' };
              const DAY_ORDER    = [1, 2, 3, 4, 5, 6, 0];
              const dayLabel     = (d) => lang === 'tr' ? DAY_SHORT_TR[d] : DAY_SHORT_EN[d];
              return (
                <Animated.View key={i} entering={FadeInDown.delay(i * 50).duration(280)} style={ft.workoutItem}>
                  {/* Başlık + mevcut gün */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={[ft.workoutItemTitle, { marginBottom: 0, flex: 1 }]}>
                      {lang === 'en' && w.name_en ? w.name_en : w.name}
                    </Text>
                    {w.dayOfWeek !== undefined && w.dayOfWeek !== null && (
                      <View style={ft.dayBadge}>
                        <Text style={ft.dayBadgeTxt}>{dayLabel(w.dayOfWeek)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Gün seçici — 7 gün */}
                  <View style={ft.dayPickerRow}>
                    {DAY_ORDER.map(d => {
                      const isActive = w.dayOfWeek === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[ft.dayPickerChip, isActive && ft.dayPickerChipActive]}
                          onPress={() => updateWorkoutDay(i, d)}
                          activeOpacity={0.75}
                        >
                          <Text style={[ft.dayPickerTxt, isActive && ft.dayPickerTxtActive]}>
                            {dayLabel(d)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Egzersizler */}
                  {(w.exercises || []).map((ex, j) => (
                    <Text key={j} style={ft.workoutExercise}>• {typeof ex === 'string' ? ex : ex.name}</Text>
                  ))}
                </Animated.View>
              );
            })}
            <TouchableOpacity
              style={ft.setActivePlanBtn}
              onPress={async () => {
                const existing = await getActiveProgram();
                if (existing) {
                  setConfirmReplace({ plan: selected, existing });
                } else {
                  setConfirmAct({ plan: selected, isFullPlan: true });
                }
              }}
            >
              <LinearGradient colors={['#dc2626', '#7f1d1d']} style={ft.setActivePlanGrad}>
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={ft.setActivePlanTxt}>
                  {t('setActiveProgram', lang)}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* ── Main list view ── */}
      {view === 'main' && (
      <View style={{ flex: 1 }}>
      {/* All Plans / My Plans tab */}
      <View style={ft.subTabBar}>
        {[
          { key: 'all',  label: t('allPlans', lang) },
          { key: 'mine', label: t('myPlans', lang) },
        ].map(tb => (
          <TouchableOpacity key={tb.key} style={[ft.subTab, activeTab === tb.key && ft.subTabActive]} onPress={() => setActiveTab(tb.key)}>
            <Text style={[ft.subTabTxt, activeTab === tb.key && ft.subTabTxtActive]}>{tb.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* MY PLANS tab */}
        {activeTab === 'mine' && (
          <>
            {myPlans.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Ionicons name="bookmark-outline" size={40} color={C.dim} />
                <Text style={{ color: C.muted, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                  {t('noPlansYet', lang)}
                </Text>
              </View>
            ) : myPlans.map((plan, i) => (
              <Animated.View key={plan.id} entering={FadeInDown.delay(i * 50).duration(280)}>
                <TouchableOpacity style={ft.planCard} onPress={() => { setSelected(plan); setView('detail'); }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={ft.planTitle}>{plan.title}</Text>
                    <View style={ft.workoutsBadge}>
                      <Text style={ft.workoutsBadgeTxt}>{plan.days} {t('days', lang)}</Text>
                    </View>
                  </View>
                  {plan.description ? <Text style={ft.planDesc} numberOfLines={2}>{lang === 'en' && plan.description_en ? plan.description_en : plan.description}</Text> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <Ionicons name="person-outline" size={12} color={C.dim} />
                    <Text style={ft.planAthletes}>{t('personalPlan', lang)}</Text>
                    <TouchableOpacity
                      onPress={() => setConfirmDel(plan)}
                      style={{ marginLeft: 'auto' }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={14} color={C.dim} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </>
        )}

        {/* ALL PLANS tab */}
        {activeTab === 'all' && (
          <View>
            {/* Filter + Paid/Free tabs */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
              <TouchableOpacity style={[ft.filterTagBtn, hasFilters && { borderColor: '#dc2626' }]} onPress={() => setView('filter')}>
                <Ionicons name="options-outline" size={16} color={hasFilters ? '#dc2626' : C.muted} />
                <Text style={[ft.filterTagTxt, hasFilters && { color: '#dc2626' }]}>{t('filter', lang)}</Text>
              </TouchableOpacity>
              {['all','free','paid'].map(p => (
                <TouchableOpacity key={p} style={[ft.paidBtn, showPaid === p && ft.paidBtnActive]} onPress={() => setShowPaid(p)}>
                  <Text style={[ft.paidBtnTxt, showPaid === p && ft.paidBtnTxtActive]}>
                    {p === 'all' ? t('all', lang) : p === 'free' ? t('free', lang) : t('premium', lang)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={wt.accordion} onPress={() => setPlansOpen(v => !v)}>
              <Text style={wt.accordionTitle}>{t('trainingPlans', lang)}</Text>
              <Ionicons name={plansOpen ? 'chevron-up' : 'chevron-down'} size={18} color='#dc2626' />
            </TouchableOpacity>

            {plansOpen && filtered.map((plan, i) => (
              <Animated.View key={plan.id} entering={FadeInDown.delay(i * 50).duration(280)}>
                <TouchableOpacity style={ft.planCard} onPress={() => { setSelected(plan); setView('detail'); }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={ft.planTitle}>{plan.title}</Text>
                    <View style={ft.workoutsBadge}>
                      <Text style={ft.workoutsBadgeTxt}>{plan.workouts.length} {t('workoutsShort', lang)}</Text>
                    </View>
                  </View>
                  <Text style={ft.planDesc} numberOfLines={2}>{lang === 'en' && plan.description_en ? plan.description_en : plan.description}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <Ionicons name="people-outline" size={12} color={C.dim} />
                    <Text style={ft.planAthletes}>{plan.athleteCount.toLocaleString()} {t('athletes', lang)}</Text>
                    {plan.isPaid && (
                      <View style={ft.paidTag}><Ionicons name="lock-closed" size={10} color={C.orange} /><Text style={ft.paidTagTxt}>PRO</Text></View>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
      </View>)}

    </View>
  );
}

const ft = StyleSheet.create({
  subTabBar:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  subTab:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, marginBottom: -1, borderBottomColor: 'transparent' },
  subTabActive: { borderBottomColor: '#dc2626' },
  subTabTxt:    { color: C.muted, fontSize: 13, fontWeight: '600' },
  subTabTxtActive: { color: C.text, fontWeight: '800' },
  setActiveBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(232,244,74,0.3)', backgroundColor: 'rgba(232,244,74,0.08)' },
  setActiveTxt:     { color: C.lime, fontSize: 11, fontWeight: '700' },
  setActivePlanBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 20 },
  setActivePlanGrad:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54 },
  setActivePlanTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  // Filter
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  title:      { color: C.text, fontSize: 20, fontWeight: '900' },
  sectionLabel:{ color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 12, marginTop: 20 },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 60, justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  filterChipTxt:    { color: C.muted, fontSize: 14, fontWeight: '600' },
  filterChipTxtActive: { color: '#fff', fontWeight: '700' },
  iconGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterIconChip: { width: '30%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1 },
  filterIconTxt:  { color: C.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  filterBtn:  { borderRadius: 14, overflow: 'hidden' },
  filterBtnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
  filterBtnTxt:  { color: '#fff', fontWeight: '900', fontSize: 15 },
  // List
  filterTagBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1 },
  filterTagTxt: { color: C.muted, fontSize: 13, fontWeight: '600' },
  paidBtn:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1 },
  paidBtnActive:{ backgroundColor: C.s2, borderColor: C.dim },
  paidBtnTxt:   { color: C.muted, fontSize: 12, fontWeight: '600' },
  paidBtnTxtActive: { color: C.text, fontWeight: '700' },
  planCard:     { backgroundColor: C.s1, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  planTitle:    { color: '#dc2626', fontSize: 15, fontWeight: '800', flex: 1, marginRight: 8 },
  planDesc:     { color: C.muted, fontSize: 12, lineHeight: 18 },
  planAthletes: { color: C.dim, fontSize: 11 },
  workoutsBadge:{ backgroundColor: C.s2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  workoutsBadgeTxt: { color: C.muted, fontSize: 11, fontWeight: '600' },
  paidTag:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(251,146,60,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  paidTagTxt:   { color: C.orange, fontSize: 10, fontWeight: '700' },
  // Detail
  detailDesc:    { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  detailSection: { color: C.text, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  tagRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.s2 },
  tagTxt:        { color: C.text, fontSize: 12, fontWeight: '600' },
  workoutItem:      { backgroundColor: C.s1, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  workoutItemTitle: { color: '#dc2626', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  workoutExercise:  { color: C.muted, fontSize: 12, lineHeight: 20 },
  dayBadge:         { backgroundColor: 'rgba(220,38,38,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(220,38,38,0.3)' },
  dayBadgeTxt:      { color: '#dc2626', fontSize: 11, fontWeight: '800' },
  dayPickerRow:     { flexDirection: 'row', gap: 4, marginBottom: 10, flexWrap: 'wrap' },
  dayPickerChip:    { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.s2 },
  dayPickerChipActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  dayPickerTxt:     { color: C.muted, fontSize: 11, fontWeight: '600' },
  dayPickerTxtActive:  { color: '#fff', fontWeight: '800' },

  // ── Create Template builder ────────────────────────────────────────────────
  exChip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.s2, borderRadius: 20, borderWidth: 1, borderColor: C.border, maxWidth: 200 },
  exChipSelected:{ backgroundColor: '#dc2626', borderColor: '#dc2626' },
  exChipTxt:     { color: C.text, fontSize: 12, fontWeight: '600' },

  dayBox:        { backgroundColor: C.s1, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  dayHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  dayLabel:      { color: C.text, fontSize: 13, fontWeight: '800' },
  dayCount:      { color: '#dc2626', fontSize: 11, fontWeight: '700' },
  dayDropArea:   { padding: 12, minHeight: 44 },
  dayDropAreaActive: { backgroundColor: 'rgba(220,38,38,0.06)' },
  dayExRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dayExName:     { flex: 1, color: C.text, fontSize: 12, fontWeight: '600' },
  dayAddHint:    { color: '#dc2626', fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  dayEmpty:      { color: C.dim, fontSize: 12 },

  daysSummary:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 12, backgroundColor: C.s1, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  daysSummaryTxt:{ fontSize: 13, fontWeight: '700' },
});

// ─── Tab bar shared style ─────────────────────────────────────────────────────
const TAB_BAR_H = StyleSheet.create({
  bar:       { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: C.border },
  tabBtn:    { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, marginBottom: -2, borderBottomColor: 'transparent' },
  tabBtnAct: { borderBottomColor: '#dc2626' },
  tabTxt:    { color: C.muted, fontSize: 13, fontWeight: '600' },
  tabTxtAct: { color: C.text, fontWeight: '800' },
});

// ─── ExercisesLibrary (yerel dataset — Supabase yok) ──────────────────────────
function ExercisesLibrary({ lang }) {
  const { muscleFilter, clearMuscleFilter } = useMuscleFilter();

  const [search, setSearch] = useState('');
  const [cat,    setCat]    = useState('');
  const [muscle, setMuscle] = useState('');
  const [equip,  setEquip]  = useState('');
  const [page,   setPage]   = useState(1);
  const [openFilter, setOpenFilter] = useState(null); // null | 'cat' | 'muscle' | 'equip'
  const [selected, setSelected] = useState(null);
  const [ratings, setRatings] = useState({}); // { exercise_key: { avg, count } }

  // Topluluk puan özetlerini bir kez çek (ex_ratings küçük); satırlara dağıt.
  const loadRatings = useCallback(async () => {
    const { data } = await supabase.from('ex_ratings').select('exercise_key, rating');
    const map = {};
    (data || []).forEach(r => {
      const m = map[r.exercise_key] || (map[r.exercise_key] = { sum: 0, count: 0 });
      m.sum += r.rating; m.count += 1;
    });
    Object.keys(map).forEach(k => { map[k] = { avg: map[k].sum / map[k].count, count: map[k].count }; });
    setRatings(map);
  }, []);
  useFocusEffect(useCallback(() => { loadRatings(); }, [loadRatings]));

  // BodyMap → Egzersizler köprüsü (bir kez uygula, sonra temizle)
  useFocusEffect(useCallback(() => {
    if (!muscleFilter) return;
    if (muscleFilter.filterType === 'muscle') { setMuscle(muscleFilter.value); setCat(''); }
    else { setCat(muscleFilter.value ?? ''); setMuscle(''); }
    setEquip(''); setPage(1);
    clearMuscleFilter();
  }, [muscleFilter]));

  const all      = filterExercises({ search, cat, muscle, equip });
  const visible  = all.slice(0, page * PAGE);
  const hasMore  = visible.length < all.length;

  useEffect(() => { setPage(1); }, [search, cat, muscle, equip]);

  const renderItem = useCallback(({ item }) => (
    <ExerciseRow item={item} onPress={setSelected} lang={lang} rating={ratings[item.id]} />
  ), [lang, ratings]);

  const catActive    = cat    ? { label: CAT_LABEL[cat]?.[lang] ?? cat, color: EX_CAT_COLOR[cat] } : null;
  const muscleActive = muscle ? { label: MUSCLE_LABEL[muscle]?.[lang] ?? muscle, color: MUSCLE_COLOR[muscle] } : null;
  const equipActive  = equip  ? { label: EQUIP_LABEL[equip]?.[lang] ?? equip, color: C.lime } : null;

  const allLbl = lang === 'tr' ? 'Tümü' : 'All';

  return (
    <View style={s.fill}>
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color={C.dim} />
        <TextInput style={s.searchInput} placeholder={t('searchPlaceholder', lang)} placeholderTextColor={C.dim} value={search} onChangeText={setSearch} />
        {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={C.dim} /></TouchableOpacity>}
      </View>

      {/* Açılır filtreler: Kategori · Kas · Ekipman */}
      <View style={fa.row}>
        <FilterAccordion icon="grid-outline" title={t('category', lang)} value={catActive?.label} placeholder={allLbl}
          activeColor={catActive?.color ?? C.lime} hasValue={!!cat} isOpen={openFilter === 'cat'}
          onToggle={() => setOpenFilter(o => (o === 'cat' ? null : 'cat'))} />
        <FilterAccordion icon="body-outline" title={t('muscleGroups', lang)} value={muscleActive?.label} placeholder={allLbl}
          activeColor={muscleActive?.color ?? C.lime} hasValue={!!muscle} isOpen={openFilter === 'muscle'}
          onToggle={() => setOpenFilter(o => (o === 'muscle' ? null : 'muscle'))} />
      </View>
      <View style={[fa.row, { marginBottom: 6 }]}>
        <FilterAccordion icon="barbell-outline" title={t('equipment', lang)} value={equipActive?.label} placeholder={allLbl}
          activeColor={C.lime} hasValue={!!equip} isOpen={openFilter === 'equip'}
          onToggle={() => setOpenFilter(o => (o === 'equip' ? null : 'equip'))} />
      </View>

      {openFilter === 'cat' && (
        <Animated.View entering={FadeInDown.duration(200)} style={fa.panel}>
          <View style={fa.grid}>
            {CATEGORIES.map((c, i) => {
              const on = cat === c; const col = EX_CAT_COLOR[c];
              return (
                <Animated.View key={c} entering={FadeInDown.delay(i * 16).duration(180)}>
                  <TouchableOpacity style={[fa.chip, on && { backgroundColor: col, borderColor: col }]}
                    onPress={() => { setCat(on ? '' : c); setOpenFilter(null); }} activeOpacity={0.75}>
                    <Ionicons name={CAT_ICON[c]} size={13} color={on ? '#0a0c0f' : col} />
                    <Text style={[fa.chipTxt, on && { color: '#0a0c0f', fontWeight: '900' }]}>{CAT_LABEL[c]?.[lang]}</Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      )}

      {openFilter === 'muscle' && (
        <Animated.View entering={FadeInDown.duration(200)} style={fa.panel}>
          <View style={fa.grid}>
            {Object.keys(MUSCLE_LABEL).map((mk, i) => {
              const on = muscle === mk; const col = MUSCLE_COLOR[mk] ?? C.lime;
              return (
                <Animated.View key={mk} entering={FadeInDown.delay(i * 14).duration(180)}>
                  <TouchableOpacity style={[fa.chip, on && { backgroundColor: col, borderColor: col }]}
                    onPress={() => { setMuscle(on ? '' : mk); setOpenFilter(null); }} activeOpacity={0.75}>
                    <Text style={[fa.chipTxt, on && { color: '#0a0c0f', fontWeight: '900' }]}>{MUSCLE_LABEL[mk]?.[lang]}</Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      )}

      {openFilter === 'equip' && (
        <Animated.View entering={FadeInDown.duration(200)} style={fa.panel}>
          <View style={fa.grid}>
            {EQUIPMENTS.map((eq, i) => {
              const on = equip === eq;
              return (
                <Animated.View key={eq} entering={FadeInDown.delay(i * 16).duration(180)}>
                  <TouchableOpacity style={[fa.chip, on && { backgroundColor: C.lime, borderColor: C.lime }]}
                    onPress={() => { setEquip(on ? '' : eq); setOpenFilter(null); }} activeOpacity={0.75}>
                    <Ionicons name={EQUIP_ICON[eq]} size={13} color={on ? '#0a0c0f' : C.lime} />
                    <Text style={[fa.chipTxt, on && { color: '#0a0c0f', fontWeight: '900' }]}>{EQUIP_LABEL[eq]?.[lang]}</Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      )}

      <Text style={s.countTxt}>{all.length} {t('exercises', lang)}</Text>

      <FlatList
        data={visible}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        onEndReached={() => { if (hasMore) setPage(p => p + 1); }}
        onEndReachedThreshold={0.4}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<Text style={{ color: C.dim, textAlign: 'center', marginTop: 40 }}>{t('noData', lang)}</Text>}
      />

      <ExerciseDetail item={selected} visible={!!selected} onClose={() => setSelected(null)} onRated={loadRatings} lang={lang} />
    </View>
  );
}

// ─── Root ExercisesScreen with 3 tabs ────────────────────────────────────────
export default function ExercisesScreen({ route }) {
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState(0); // 0=Exercises 1=Workouts 2=Templates

  // AI Coach "Şablonları Gör" → route param ile Templates sekmesine geç
  useEffect(() => {
    const it = route?.params?.initialTab;
    if (typeof it === 'number') setActiveTab(it);
  }, [route?.params?.initialTab]);

  const TABS = [
    { label: t('tabExercisesLib', lang) },
    { label: t('tabWorkoutsLib', lang)  },
    { label: t('tabTemplatesLib', lang) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Tab bar */}
      <View style={TAB_BAR_H.bar}>
        {TABS.map((tab, i) => (
          <TouchableOpacity key={i} style={[TAB_BAR_H.tabBtn, activeTab === i && TAB_BAR_H.tabBtnAct]} onPress={() => setActiveTab(i)}>
            <Text style={[TAB_BAR_H.tabTxt, activeTab === i && TAB_BAR_H.tabTxtAct]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 0 && <ExercisesLibrary lang={lang} />}
      {activeTab === 1 && <WorkoutsTab lang={lang} />}
      {activeTab === 2 && <TemplatesTab lang={lang} planFilter={route?.params} />}
    </View>
  );
}


const s = StyleSheet.create({
  fill:       { flex: 1, backgroundColor: C.bg },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.s1, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, margin: 16, marginBottom: 10 },
  searchInput:{ flex: 1, color: C.text, fontSize: 14 },
  catList:    { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  catBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.s1 },
  catTxt:     { color: C.muted, fontSize: 12, fontWeight: '700' },
  diffScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  diffContent:{ paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  diffBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.s1 },
  diffTxt:    { color: C.muted, fontSize: 11, fontWeight: '700' },
  countTxt:   { color: C.dim, fontSize: 11, fontWeight: '600', paddingHorizontal: 16, marginBottom: 6 },
  list:       { paddingHorizontal: 16, paddingBottom: 32 },
  exRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.s1, borderRadius: 14, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  thumb:      { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: C.s2 },
  thumbLetter:{ fontSize: 24, fontWeight: '900' },
  exName:     { color: C.text, fontSize: 13, fontWeight: '700' },
  badge:      { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt:   { fontSize: 10, fontWeight: '700' },
  muscleTxt:  { color: C.dim, fontSize: 11 },
  effWrap:    { flexDirection: 'column', gap: 2, marginRight: 4 },
  effDot:     { width: 5, height: 5, borderRadius: 2.5 },
});
