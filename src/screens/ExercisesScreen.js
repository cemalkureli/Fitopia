import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
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
import { getFavorites, toggleFavorite } from '../utils/storage';
import { TRAINING_PLANS, PLAN_FILTERS } from '../data/trainingPlans';
import { setActiveProgram, getMyPlans, saveMyPlan, deleteMyPlan } from '../utils/storage';

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

const CAT_KEYS = ['Göğüs','Sırt','Omuz','Kol','Bacak','Core','Kardio','Compound'];

const CAT_COLOR = {
  'Göğüs':    C.orange, 'Sırt':    C.blue,  'Omuz':    C.purple,
  'Kol':      C.teal,   'Bacak':   C.green,  'Core':    C.lime,
  'Kardio':   C.red,    'Compound':C.muted,
};

const CAT_ICON = {
  '':         'apps-outline',
  'Göğüs':   'body-outline',
  'Sırt':    'accessibility-outline',
  'Omuz':    'barbell-outline',
  'Kol':     'fitness-outline',
  'Bacak':   'walk-outline',
  'Core':    'radio-button-on-outline',
  'Kardio':  'heart-outline',
  'Compound':'flash-outline',
};

const DIFF_META = [
  { key: 'all',   color: C.muted,  icon: 'options-outline'     },
  { key: 'diff1', color: C.green,  icon: 'leaf-outline'        },
  { key: 'diff2', color: C.teal,   icon: 'trending-up-outline' },
  { key: 'diff3', color: C.lime,   icon: 'flame-outline'       },
  { key: 'diff4', color: C.orange, icon: 'alert-outline'       },
  { key: 'diff5', color: C.red,    icon: 'skull-outline'       },
];

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
const ExerciseRow = memo(({ item, onPress, lang, isFav, onToggleFav }) => {
  const color    = CAT_COLOR[item.category] ?? C.lime;
  const catLabel = CATEGORY_LABELS[lang]?.[item.category] ?? item.category;
  const muscle   = MUSCLE_LABELS[lang]?.[item.primary_muscle] ?? item.primary_muscle;

  return (
    <TouchableOpacity style={s.exRow} onPress={() => onPress(item)} activeOpacity={0.8}>
      {item.thumb_url ? (
        <Image source={{ uri: item.thumb_url }} style={s.thumb} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[color + '33', color + '11']} style={s.thumb}>
          <Text style={[s.thumbLetter, { color }]}>{(item.name ?? '?')[0]}</Text>
        </LinearGradient>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.exName} numberOfLines={1}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <View style={[s.badge, { backgroundColor: color + '18' }]}>
            <Text style={[s.badgeTxt, { color }]}>{catLabel}</Text>
          </View>
          <Text style={s.muscleTxt}>{muscle}</Text>
        </View>
        {(item.avg_rating ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <Stars value={item.avg_rating} size={11} />
            <Text style={{ color: C.dim, fontSize: 10 }}>({item.vote_count})</Text>
          </View>
        )}
      </View>
      {/* Favori butonu */}
      <TouchableOpacity
        onPress={e => { e.stopPropagation?.(); onToggleFav(item.name); }}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        style={{ padding: 4 }}
      >
        <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={18} color={isFav ? C.red : C.dim} />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={14} color={C.dim} />
    </TouchableOpacity>
  );
});

// ─── Detay bottom sheet ───────────────────────────────────────────────────────
function ExerciseDetail({ item, visible, onClose, onRated, onUpdateSelected, lang }) {
  const [userRating,    setUserRating]    = useState(0);
  const [submitting,    setSubmitting]    = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [liveAvg,       setLiveAvg]       = useState(0);
  const [liveVotes,     setLiveVotes]     = useState(0);
  const [activeMuscle,  setActiveMuscle]  = useState(null);
  const color = CAT_COLOR[item?.category] ?? C.lime;
  const DIFF  = [t('diff1',lang), t('diff2',lang), t('diff3',lang), t('diff4',lang), t('diff5',lang)];

  const refreshSummary = async (exerciseId) => {
    const { data: s } = await supabase
      .from('exercise_rating_summary')
      .select('avg_rating, vote_count')
      .eq('exercise_id', exerciseId)
      .maybeSingle();
    const avg   = s ? (Number(s.avg_rating) || 0) : 0;
    const votes = s ? (s.vote_count || 0) : 0;
    setLiveAvg(avg);
    setLiveVotes(votes);
    onUpdateSelected?.(avg, votes);
  };

  useEffect(() => {
    if (!visible || !item) return;
    setUserRating(0); setSubmitted(false); setActiveMuscle(null); setLiveAvg(0); setLiveVotes(0);
    refreshSummary(item.id);
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      supabase.from('exercise_ratings').select('rating')
        .eq('exercise_id', item.id).eq('user_id', data.user.id).single()
        .then(({ data: r }) => { if (r) { setUserRating(r.rating); setSubmitted(true); } });
    });
  }, [visible, item?.id]);

  const handleRate = async (rating) => {
    if (rating === userRating) return; // aynı yıldıza tekrar basınca bir şey yapma
    const wasFirstTime = !submitted;
    setUserRating(rating); setSubmitting(true);
    try {
      const { data: ud } = await supabase.auth.getUser();
      if (!ud?.user) return;
      await supabase.from('exercise_ratings')
        .upsert({ exercise_id: item.id, user_id: ud.user.id, rating }, { onConflict: 'exercise_id,user_id' });
      // XP sadece ilk oyda verilir
      if (wasFirstTime) {
        await supabase.rpc('increment_xp', { uid: ud.user.id, amount: 5, rating_inc: 1 }).catch(() => {});
      }
      await refreshSummary(item.id);
      setSubmitted(true); onRated?.();
    } catch {}
    setSubmitting(false);
  };

  if (!item) return null;
  const catLabel = CATEGORY_LABELS[lang]?.[item.category] ?? item.category;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={det.container}>
        {/* Overlay */}
        <TouchableOpacity style={det.overlay} activeOpacity={1} onPress={onClose} />

        {/* Sheet */}
        <View style={det.sheet}>
          <View style={det.dragBar} />

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Video */}
            <View style={[det.videoWrap, { borderColor: color + '44' }]}>
              {item.webm_url ? (
                <ExerciseMedia source={item.webm_url} style={{ flex: 1 }} />
              ) : (
                <LinearGradient colors={[color+'22', color+'08']} style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                  <Ionicons name="barbell-outline" size={56} color={color} />
                </LinearGradient>
              )}
            </View>

            <View style={{ padding: 20 }}>
              {/* Başlık */}
              <Text style={det.name}>{item.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={[s.badge, { backgroundColor: color + '18' }]}>
                  <Text style={[s.badgeTxt, { color }]}>{catLabel}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: C.s2 }]}>
                  <Text style={[s.badgeTxt, { color: C.muted }]}>{DIFF[(item.difficulty ?? 3) - 1]}</Text>
                </View>
              </View>

              {/* Detaylar */}
              {(lang === 'en' ? (item.instructions_en || item.instructions) : item.instructions) ? (
                <>
                  <Text style={det.sectionTitle}>{t('instructions', lang)}</Text>
                  <Text style={det.instrTxt}>{lang === 'en' ? (item.instructions_en || item.instructions) : item.instructions}</Text>
                </>
              ) : null}

              {/* Kaslar — tıklanabilir */}
              <Text style={det.sectionTitle}>{t('muscleGroups', lang)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {[item.primary_muscle, ...(item.secondary_muscles || [])].filter(Boolean).map((m, i) => {
                  const isPrimary = i === 0;
                  const isActive  = activeMuscle === m;
                  const label     = MUSCLE_LABELS[lang]?.[m] ?? m;
                  const score     = item.muscle_activations?.[m];
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setActiveMuscle(isActive ? null : m)}
                      style={[
                        det.muscleTag,
                        isPrimary && { backgroundColor: C.teal+'22', borderColor: C.teal },
                        isActive  && { backgroundColor: color+'33', borderColor: color },
                      ]}
                    >
                      <Text style={[det.muscleTxt, isPrimary && { color: C.teal }, isActive && { color }]}>
                        {label}{score ? ` · ${score}/5` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Seçili kas aktivasyon barı */}
              {activeMuscle && item.muscle_activations?.[activeMuscle] != null && (
                <View style={det.activationBox}>
                  <Text style={[det.activationTitle, { color }]}>
                    {MUSCLE_LABELS[lang]?.[activeMuscle] ?? activeMuscle}
                  </Text>
                  <EffBar
                    value={item.muscle_activations[activeMuscle]}
                    label={t('activation', lang)}
                    color={color}
                  />
                  <Text style={det.activationNote}>
                    {lang === 'tr'
                      ? `${t('inThisExercise', lang)} ${MUSCLE_LABELS.tr[activeMuscle] ?? activeMuscle} ${item.muscle_activations[activeMuscle] >= 4 ? t('actsPrimary', lang) : t('actsSecondary', lang)}.`
                      : `${MUSCLE_LABELS.en[activeMuscle] ?? activeMuscle} ${item.muscle_activations[activeMuscle] >= 4 ? t('actsPrimary', lang) : t('actsSecondary', lang)} ${t('inThisExercise', lang)}`
                    }
                  </Text>
                </View>
              )}

              {/* Etki — per-muscle activation */}
              <Text style={det.sectionTitle}>{t('effectiveness', lang)}</Text>
              {item.muscle_activations && Object.keys(item.muscle_activations).length > 0
                ? [item.primary_muscle, ...(item.secondary_muscles || [])].filter(Boolean).map(m => {
                    const val = item.muscle_activations?.[m];
                    if (val == null) return null;
                    const isPrimary = m === item.primary_muscle;
                    const barColor  = isPrimary ? color : C.teal;
                    return (
                      <EffBar
                        key={m}
                        value={val}
                        label={MUSCLE_LABELS[lang]?.[m] ?? m}
                        color={barColor}
                      />
                    );
                  })
                : <EffBar value={item.effectiveness ?? 3} label={t('generalEffect', lang)} color={color} />
              }
              <EffBar value={item.difficulty ?? 3} label={t('difficulty', lang)} color={C.orange} />

              {/* Topluluk puanı */}
              <Text style={det.sectionTitle}>{t('communityRating', lang)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Stars value={liveAvg} size={20} />
                {liveVotes > 0 && (
                  <Text style={{ color: C.dim, fontSize: 12 }}>
                    {t('avg', lang)} {Number(liveAvg).toFixed(1)} · {liveVotes} {t('votes', lang)}
                  </Text>
                )}
              </View>

              {/* Kullanıcı oyu */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={det.sectionTitle}>{t('yourRating', lang)}</Text>
                {submitted && <Text style={{ color: C.teal, fontSize: 11 }}>{t('xpEarned', lang)}</Text>}
              </View>
              {submitting ? (
                <ActivityIndicator color={C.lime} style={{ alignSelf: 'flex-start' }} />
              ) : (
                <Stars value={userRating} size={30} onPress={handleRate} />
              )}
              {submitted && (
                <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>
                  {t('ratingChangeable', lang)}
                </Text>
              )}

              {/* Kapat */}
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
  videoWrap:  { height: 220, borderWidth: 1, overflow: 'hidden', backgroundColor: C.s2 },
  name:       { color: C.text, fontSize: 20, fontWeight: '900' },
  sectionTitle:{ color: C.text, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  instrTxt:   { color: C.muted, fontSize: 13, lineHeight: 20 },
  muscleTag:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border, backgroundColor: C.s2 },
  muscleTxt:     { color: C.muted, fontSize: 12, fontWeight: '600' },
  activationBox: { backgroundColor: C.s2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginTop: 8, marginBottom: 4 },
  activationTitle:{ fontSize: 13, fontWeight: '800', marginBottom: 8 },
  activationNote: { color: C.muted, fontSize: 11, marginTop: 4, lineHeight: 16 },
  closeBtn:      { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
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

  const deleteWorkout = async () => {
    Alert.alert(lang === 'tr' ? 'Antrenmanı Sil' : 'Delete Workout', lang === 'tr' ? 'Emin misin?' : 'Are you sure?', [
      { text: t('cancel', lang), style: 'cancel' },
      { text: lang === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('custom_workouts').delete().eq('id', active.id);
        setView('main'); setActive(null);
        await loadWorkouts(userId);
      }},
    ]);
  };

  const loadPicker = async () => {
    setLoadingPicker(true);
    const { data } = await supabase.from('exercises').select('id, name, category, primary_muscle').order('name');
    setAllEx(data || []);
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
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [tmplForm, setTmplForm] = useState({ title: '', description: '', level: 'intermediate', goals: [], days: 3 });
  const [editEx,       setEditEx]       = useState(null);
  const [setsData,     setSetsData]     = useState([]);
  const [editRir,      setEditRir]      = useState('1');
  const [editIntensity,setEditIntensity]= useState(null); // null | 'failure' | 'superset' | 'finisher'
  const [editSaving,   setEditSaving]   = useState(false);

  const openEdit = (ex) => {
    setEditEx(ex);
    const sd = ex.sets_data?.length ? ex.sets_data : Array.from({ length: ex.sets || 3 }, () => ({ weight: String(ex.weight || ''), reps: String(ex.reps || 10) }));
    setSetsData(sd.map(s => ({ weight: String(s.weight ?? ''), reps: String(s.reps ?? '') })));
    setEditRir(String(ex.rir ?? 1));
    setEditIntensity(ex.intensity ?? null);
    setView('exerciseDetail');
  };

  const updateSetField = (i, field, val) => setSetsData(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  const addSet    = () => setSetsData(prev => [...prev, { weight: prev[prev.length-1]?.weight ?? '', reps: prev[prev.length-1]?.reps ?? '' }]);
  const removeSet = (i) => setSetsData(prev => prev.filter((_, idx) => idx !== i));

  const saveEdit = async () => {
    if (!editEx) return;
    setEditSaving(true);
    try {
      const cleanSets = setsData.map(s => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0 }));
      await supabase.from('workout_exercises').update({
        sets:      cleanSets.length,
        reps:      cleanSets[0]?.reps || 10,
        weight:    cleanSets[0]?.weight || 0,
        rir:       parseFloat(editRir) || 1,
        sets_data: cleanSets,
        intensity: editIntensity,
      }).eq('id', editEx.id);
      await loadWorkoutExercises(active.id);
      setEditEx(null);
    } finally {
      setEditSaving(false);
    }
  };

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
          title={lang === 'tr' ? 'Egzersiz Ekle' : 'Add Exercises'}
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
                  ? `${lang === 'tr' ? 'Egzersiz Ekle' : 'Add Exercises'} (${pickerSel.size})`
                  : (lang === 'tr' ? 'Egzersiz Seç' : 'Select Exercises')
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
    // Mini volume chart
    const maxW = Math.max(...setsData.map(s => parseFloat(s.weight) || 0), 1);
    const totalVol = setsData.reduce((a, s) => a + (parseFloat(s.weight)||0)*(parseInt(s.reps)||0), 0);

    return (
      <View style={[wt.fill, { backgroundColor: C.bg }]}>
        <SubHdr
          title={editEx.exercise_name}
          onBack={() => { setEditEx(null); setView('detail'); }}
          right={[
            <TouchableOpacity key="save" onPress={saveEdit} disabled={editSaving} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#dc2626', borderRadius: 10 }}>
              {editSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{lang === 'tr' ? 'Kaydet' : 'Save'}</Text>}
            </TouchableOpacity>,
          ]}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            {/* Volume summary */}
            <View style={ed.summaryRow}>
              <View style={ed.summaryItem}>
                <Text style={ed.summaryVal}>{setsData.length}</Text>
                <Text style={ed.summaryLbl}>{lang === 'tr' ? 'Set' : 'Sets'}</Text>
              </View>
              <View style={ed.summaryDiv} />
              <View style={ed.summaryItem}>
                <Text style={ed.summaryVal}>{setsData[0]?.weight || '—'}</Text>
                <Text style={ed.summaryLbl}>kg</Text>
              </View>
              <View style={ed.summaryDiv} />
              <View style={ed.summaryItem}>
                <Text style={ed.summaryVal}>{totalVol > 0 ? `${totalVol}` : '—'}</Text>
                <Text style={ed.summaryLbl}>{lang === 'tr' ? 'Hacim' : 'Volume'}</Text>
              </View>
              <View style={ed.summaryDiv} />
              <View style={ed.summaryItem}>
                <Text style={ed.summaryVal}>{editRir}</Text>
                <Text style={ed.summaryLbl}>RIR</Text>
              </View>
            </View>

            {/* Mini bar chart (weight per set) */}
            {setsData.length > 0 && setsData.some(s => parseFloat(s.weight) > 0) && (
              <View style={ed.chartWrap}>
                <View style={ed.chartBars}>
                  {setsData.map((s, i) => {
                    const h = Math.max(4, ((parseFloat(s.weight)||0) / maxW) * 56);
                    return (
                      <View key={i} style={ed.chartBarCol}>
                        <View style={[ed.chartBar, { height: h }]} />
                        <Text style={ed.chartBarLbl}>{i+1}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={ed.chartTitle}>{lang === 'tr' ? 'Set Başına Ağırlık (kg)' : 'Weight per Set (kg)'}</Text>
              </View>
            )}

            {/* Column headers */}
            <View style={ed.tableHeader}>
              <Text style={[ed.thTxt, { width: 36 }]}>{lang === 'tr' ? 'Set' : 'Set'}</Text>
              <Text style={[ed.thTxt, { flex: 1 }]}>{lang === 'tr' ? 'Ağırlık (kg)' : 'Weight (kg)'}</Text>
              <Text style={[ed.thTxt, { flex: 1 }]}>{lang === 'tr' ? 'Tekrar' : 'Reps'}</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Set rows */}
            {setsData.map((s, i) => (
              <Animated.View key={i} entering={FadeInLeft.delay(i * 40).duration(240)} style={ed.setRow}>
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
              </Animated.View>
            ))}

            {/* Add set */}
            <TouchableOpacity style={ed.addSetRow} onPress={addSet}>
              <Ionicons name="add-circle" size={20} color="#dc2626" />
              <Text style={ed.addSetTxt}>{lang === 'tr' ? 'Set Ekle' : 'Add Set'}</Text>
            </TouchableOpacity>

            {/* RIR */}
            <View style={ed.rirRow}>
              <Text style={ed.rirLabel}>RIR</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['0','1','2','3','4'].map(v => (
                  <TouchableOpacity key={v} style={[ed.rirBtn, editRir === v && ed.rirBtnActive]} onPress={() => setEditRir(v)}>
                    <Text style={[ed.rirBtnTxt, editRir === v && { color: '#fff', fontWeight: '800' }]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Intensity type */}
            <View style={ed.intensityRow}>
              {[
                { key: 'failure',  label: 'Failure',  icon: 'flash' },
                { key: 'superset', label: 'Superset', icon: 'repeat' },
                { key: 'finisher', label: 'Finisher', icon: 'flag' },
              ].map(({ key, label, icon }) => {
                const active = editIntensity === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[ed.intensityBtn, active && ed.intensityBtnActive]}
                    onPress={() => setEditIntensity(active ? null : key)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={`${icon}${active ? '' : '-outline'}`} size={16} color={active ? '#fff' : C.muted} />
                    <Text style={[ed.intensityTxt, active && { color: '#fff', fontWeight: '800' }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Terim açıklamaları */}
            <View style={ed.termSection}>
              <Text style={ed.termSectionTitle}>{lang === 'tr' ? 'Terimler' : 'Terminology'}</Text>
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
      <View style={[wt.fill, { backgroundColor: C.bg }]}>
        <SubHdr
          title={active.title}
          onBack={() => { setView('main'); setActive(null); }}
          right={[
            <TouchableOpacity key="edit" onPress={() => {}} style={{ padding: 6 }}>
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
              <Text style={wt.detailSectionTitle}>{lang === 'tr' ? 'Egzersizler' : 'Exercises'}</Text>
              {wkExercises.map((ex, i) => (
                <Animated.View key={ex.id} entering={FadeInLeft.delay(i * 40).duration(260)}>
                  <TouchableOpacity style={wt.exCard} onPress={() => openEdit(ex)} activeOpacity={0.75}>
                    <View style={wt.exCardIcon}>
                      <Ionicons name="barbell-outline" size={18} color="#dc2626" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={wt.exCardName}>{ex.exercise_name}</Text>
                      <View style={wt.exCardMeta}>
                        <View style={wt.exMetaItem}><Ionicons name="copy-outline" size={11} color={C.dim} /><Text style={wt.exMetaTxt}>{ex.sets} {lang === 'tr' ? 'set' : 'sets'}</Text></View>
                        <View style={wt.exMetaItem}><Ionicons name="repeat-outline" size={11} color={C.dim} /><Text style={wt.exMetaTxt}>{ex.reps} {lang === 'tr' ? 'tekrar' : 'reps'}</Text></View>
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
              <Text style={wt.addExTxt}>{lang === 'tr' ? 'Egzersiz Ekle' : 'Add Exercises'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Create Template from this workout */}
          <TouchableOpacity
            style={wt.activeProgramBtn}
            onPress={() => setCreatingTemplate(true)}
          >
            <Ionicons name="bookmark-outline" size={16} color={C.lime} />
            <Text style={wt.activeProgramTxt}>
              {lang === 'tr' ? 'Template Oluştur' : 'Create Template'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

      {/* Create Template Modal */}
      <Modal visible={creatingTemplate} transparent animationType="slide" onRequestClose={() => setCreatingTemplate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={wt.modalOverlay} activeOpacity={1} onPress={() => setCreatingTemplate(false)}>
            <TouchableOpacity activeOpacity={1} style={[wt.createModal, { maxHeight: '90%' }]} onPress={() => {}}>
              <View style={wt.createHandle} />
              <Text style={wt.createTitle}>{lang === 'tr' ? 'Template Oluştur' : 'Create Template'}</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Title */}
                <TextInput style={wt.createInput} value={tmplForm.title} onChangeText={v => setTmplForm(f => ({...f, title: v}))}
                  placeholder={lang === 'tr' ? 'Plan Adı' : 'Plan Name'} placeholderTextColor={C.dim} />
                <TextInput style={wt.createInput} value={tmplForm.description} onChangeText={v => setTmplForm(f => ({...f, description: v}))}
                  placeholder={lang === 'tr' ? 'Açıklama' : 'Description'} placeholderTextColor={C.dim} />

                {/* Days per week */}
                <Text style={wt.tmplSectionLabel}>{lang === 'tr' ? 'Haftalık Gün' : 'Days per Week'}</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6].map(d => (
                    <TouchableOpacity key={d} style={[wt.tmplChip, tmplForm.days === d && wt.tmplChipActive]} onPress={() => setTmplForm(f => ({...f, days: d}))}>
                      <Text style={[wt.tmplChipTxt, tmplForm.days === d && { color: '#fff', fontWeight: '800' }]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Level */}
                <Text style={wt.tmplSectionLabel}>{lang === 'tr' ? 'Seviye' : 'Level'}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['beginner','intermediate','advanced'].map(lv => {
                    const label = lang === 'tr' ? {beginner:'Başlangıç',intermediate:'Orta',advanced:'İleri'}[lv] : {beginner:'Beginner',intermediate:'Intermediate',advanced:'Advanced'}[lv];
                    return (
                      <TouchableOpacity key={lv} style={[wt.tmplChip, { flex: 1 }, tmplForm.level === lv && wt.tmplChipActive]} onPress={() => setTmplForm(f => ({...f, level: lv}))}>
                        <Text style={[wt.tmplChipTxt, tmplForm.level === lv && { color: '#fff', fontWeight: '800' }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Goals (multi-select) */}
                <Text style={wt.tmplSectionLabel}>{lang === 'tr' ? 'Hedefler' : 'Goals'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[{k:'strength',tr:'Güç',en:'Strength'},{k:'bodybuilding',tr:'Kas',en:'Bodybuilding'},{k:'fat_loss',tr:'Yağ Yak',en:'Fat Loss'},{k:'powerlifting',tr:'Powerlifting',en:'Powerlifting'},{k:'athleticism',tr:'Atletizm',en:'Athleticism'}].map(g => {
                    const active = tmplForm.goals.includes(g.k);
                    return (
                      <TouchableOpacity key={g.k} style={[wt.tmplChip, active && wt.tmplChipActive]}
                        onPress={() => setTmplForm(f => ({ ...f, goals: active ? f.goals.filter(x => x !== g.k) : [...f.goals, g.k] }))}>
                        <Text style={[wt.tmplChipTxt, active && { color: '#fff', fontWeight: '800' }]}>{lang === 'tr' ? g.tr : g.en}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <TouchableOpacity style={[wt.createBtn, { marginTop: 16 }]}
                onPress={async () => {
                  if (!tmplForm.title.trim()) return;
                  const plan = {
                    id:          `my-${Date.now()}`,
                    title:       tmplForm.title.trim(),
                    description: tmplForm.description.trim(),
                    level:       tmplForm.level,
                    days:        tmplForm.days,
                    goals:       tmplForm.goals,
                    targetMuscles: [],
                    environment:   [],
                    athleteCount:  1,
                    isPaid:        false,
                    isMine:        true,
                    workouts: [{ name: active?.title ?? 'Workout', exercises: wkExercises.map(e => e.exercise_name) }],
                    createdAt: new Date().toISOString(),
                  };
                  await saveMyPlan(plan);
                  setCreatingTemplate(false);
                  setTmplForm({ title: '', description: '', level: 'intermediate', goals: [], days: 3 });
                  Alert.alert(lang === 'tr' ? '✓ Kaydedildi' : '✓ Saved',
                    lang === 'tr' ? 'Plan "Planlarım" sekmesine eklendi.' : 'Plan added to "My Plans" tab.');
                }}
                disabled={!tmplForm.title.trim()}
              >
                <LinearGradient colors={['#dc2626','#7f1d1d']} style={wt.createBtnGrad}>
                  <Text style={wt.createBtnTxt}>{lang === 'tr' ? 'Kaydet' : 'Save'}</Text>
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
    <View style={wt.fill}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* All Workouts accordion */}
        <TouchableOpacity style={wt.accordion} onPress={() => setAllOpen(v => !v)}>
          <Text style={wt.accordionTitle}>{lang === 'tr' ? 'Tüm Antrenmanlar' : 'All Workouts'}</Text>
          <Ionicons name={allOpen ? 'chevron-up' : 'chevron-down'} size={18} color='#dc2626' />
        </TouchableOpacity>

        {allOpen && (
          <>
            <TouchableOpacity style={wt.addWorkout} onPress={() => setCreating(true)}>
              <Ionicons name="add" size={20} color='#dc2626' />
              <Text style={wt.addWorkoutTxt}>{lang === 'tr' ? 'Antrenman Ekle' : 'Add Workout'}</Text>
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

      {/* Create modal */}
      <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={wt.modalOverlay} activeOpacity={1} onPress={() => setCreating(false)}>
            <TouchableOpacity activeOpacity={1} style={wt.createModal} onPress={() => {}}>
              <View style={wt.createHandle} />
              <Text style={wt.createTitle}>{lang === 'tr' ? 'Yeni Antrenman' : 'New Workout'}</Text>
              <TextInput style={wt.createInput} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder={lang === 'tr' ? 'Başlık' : 'Title'} placeholderTextColor={C.dim} />
              <TextInput style={wt.createInput} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder={lang === 'tr' ? 'Açıklama' : 'Description'} placeholderTextColor={C.dim} />
              <TouchableOpacity style={wt.createBtn} onPress={createWorkout} disabled={saving || !form.title.trim()}>
                <LinearGradient colors={['#dc2626', '#7f1d1d']} style={wt.createBtnGrad}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={wt.createBtnTxt}>{lang === 'tr' ? 'Oluştur' : 'Create'}</Text>}
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
  rirLabel:     { color: C.muted, fontSize: 13, fontWeight: '800', width: 36 },
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
const GOAL_LABELS_TR = { strength: 'Güç', bodybuilding: 'Vücut Geliştirme', fat_loss: 'Yağ Yakma', athleticism: 'Atletizm', powerlifting: 'Powerlifting', hypertrophy: 'Hipertrofi' };
const GOAL_LABELS_EN = { strength: 'Strength', bodybuilding: 'Bodybuilding', fat_loss: 'Fat Loss', athleticism: 'Athleticism', powerlifting: 'Powerlifting', hypertrophy: 'Hypertrophy' };

function TemplatesTab({ lang }) {
  const [view,       setView]       = useState('main');
  const [selected,   setSelected]   = useState(null);
  const [filterDays, setFilterDays] = useState([]);
  const [filterLvl,  setFilterLvl]  = useState([]);
  const [filterGoal, setFilterGoal] = useState([]);
  const [showPaid,   setShowPaid]   = useState('all');
  const [plansOpen,  setPlansOpen]  = useState(true);
  const [myPlansOpen,setMyPlansOpen]= useState(true);
  const [myPlans,    setMyPlans]    = useState([]);
  const [activeTab,  setActiveTab]  = useState('all'); // 'all' | 'mine'

  useEffect(() => {
    getMyPlans().then(setMyPlans);
  }, []);

  // Refresh my plans when coming back from detail
  useEffect(() => {
    if (view === 'main') getMyPlans().then(setMyPlans);
  }, [view]);

  const levelLabel = (lv) => lang === 'tr' ? LEVEL_LABELS_TR[lv] : LEVEL_LABELS_EN[lv];
  const goalLabel  = (g)  => lang === 'tr' ? GOAL_LABELS_TR[g] : GOAL_LABELS_EN[g];

  const filtered = TRAINING_PLANS.filter(p => {
    if (showPaid === 'free' && p.isPaid) return false;
    if (showPaid === 'paid' && !p.isPaid) return false;
    if (filterDays.length && !filterDays.includes(p.days)) return false;
    if (filterLvl.length  && !filterLvl.includes(p.level))  return false;
    if (filterGoal.length && !p.goals.some(g => filterGoal.includes(g))) return false;
    return true;
  });

  const toggleArr = (arr, setArr, val) => {
    setArr(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  };

  const hasFilters = filterDays.length + filterLvl.length + filterGoal.length > 0;

  // ── Filter modal ────────────────────────────────────────────────────────────
  if (view === 'filter') {
    const DayBtn = ({ d }) => (
      <TouchableOpacity
        style={[ft.filterChip, filterDays.includes(d) && ft.filterChipActive]}
        onPress={() => toggleArr(filterDays, setFilterDays, d)}
      >
        <Text style={[ft.filterChipTxt, filterDays.includes(d) && ft.filterChipTxtActive]}>{d}</Text>
      </TouchableOpacity>
    );
    const LevelBtn = ({ lv }) => (
      <TouchableOpacity
        style={[ft.filterChip, { flex: 1 }, filterLvl.includes(lv) && ft.filterChipActive]}
        onPress={() => toggleArr(filterLvl, setFilterLvl, lv)}
      >
        <Ionicons name="bar-chart-outline" size={18} color={filterLvl.includes(lv) ? '#fff' : C.dim} />
        <Text style={[ft.filterChipTxt, filterLvl.includes(lv) && ft.filterChipTxtActive]}>{levelLabel(lv)}</Text>
      </TouchableOpacity>
    );
    const GoalBtn = ({ g, icon }) => (
      <TouchableOpacity
        style={[ft.filterIconChip, filterGoal.includes(g) && ft.filterChipActive]}
        onPress={() => toggleArr(filterGoal, setFilterGoal, g)}
      >
        <Ionicons name={icon} size={24} color={filterGoal.includes(g) ? '#fff' : C.muted} />
        <Text style={[ft.filterIconTxt, filterGoal.includes(g) && { color: '#fff' }]}>{goalLabel(g)}</Text>
      </TouchableOpacity>
    );

    return (
      <View style={[wt.fill, { backgroundColor: C.bg }]}>
        <View style={ft.header}>
          <Text style={ft.title}>{lang === 'tr' ? 'Filtreler' : 'Filters'}</Text>
          <TouchableOpacity onPress={() => setView('main')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={C.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {/* Days */}
          <Text style={ft.sectionLabel}>{lang === 'tr' ? 'Gün Sayısı' : 'Number of days'}</Text>
          <View style={ft.chipRow}>
            {[1,2,3,4,5,6].map(d => <DayBtn key={d} d={d} />)}
          </View>
          {/* Level */}
          <Text style={ft.sectionLabel}>{lang === 'tr' ? 'Seviye' : 'Level'}</Text>
          <View style={[ft.chipRow, { gap: 10 }]}>
            {['beginner','intermediate','advanced'].map(lv => <LevelBtn key={lv} lv={lv} />)}
          </View>
          {/* Goal */}
          <Text style={ft.sectionLabel}>{lang === 'tr' ? 'Hedef' : 'Goal'}</Text>
          <View style={ft.iconGrid}>
            <GoalBtn g="powerlifting" icon="barbell-outline" />
            <GoalBtn g="bodybuilding" icon="body-outline" />
            <GoalBtn g="fat_loss"    icon="scale-outline" />
            <GoalBtn g="athleticism" icon="walk-outline" />
            <GoalBtn g="strength"    icon="flash-outline" />
          </View>
        </ScrollView>
        {/* Filter CTA */}
        <View style={{ padding: 16 }}>
          <TouchableOpacity style={ft.filterBtn} onPress={() => setView('main')}>
            <LinearGradient colors={['#dc2626','#7f1d1d']} style={ft.filterBtnGrad}>
              <Text style={ft.filterBtnTxt}>{lang === 'tr' ? 'Filtrele' : 'Filter'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Plan detail ─────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const lvColor = LEVEL_COLORS[selected.level] ?? C.lime;
    return (
      <View style={[wt.fill, { backgroundColor: C.bg }]}>
        <SubHdr title={selected.title} onBack={() => { setView('main'); setSelected(null); }} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={ft.detailDesc}>{selected.description}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Ionicons name="people-outline" size={14} color={C.dim} />
            <Text style={{ color: C.muted, fontSize: 12 }}>{selected.athleteCount.toLocaleString()} {lang === 'tr' ? 'sporcu bu programı kopyaladı' : 'athletes copied this program'}</Text>
          </View>
          {/* Level */}
          <Text style={ft.detailSection}>{lang === 'tr' ? 'Seviye' : 'Level'}</Text>
          <View style={ft.tagRow}>
            <View style={[ft.tag, { backgroundColor: lvColor + '22', borderColor: lvColor + '44' }]}>
              <Text style={[ft.tagTxt, { color: lvColor }]}>{levelLabel(selected.level)}</Text>
            </View>
          </View>
          {/* Goal */}
          <Text style={ft.detailSection}>{lang === 'tr' ? 'Hedef' : 'Goal'}</Text>
          <View style={ft.tagRow}>
            {selected.goals.map(g => (
              <View key={g} style={ft.tag}><Text style={ft.tagTxt}>{goalLabel(g)}</Text></View>
            ))}
          </View>
          {/* Days */}
          <Text style={ft.detailSection}>{lang === 'tr' ? 'Haftalık Gün' : 'Days per Week'}</Text>
          <View style={ft.tagRow}><View style={ft.tag}><Text style={ft.tagTxt}>{selected.days} {lang === 'tr' ? 'gün' : 'days'}</Text></View></View>
          {/* Workouts — each tappable to set as active program */}
          <Text style={ft.detailSection}>{lang === 'tr' ? 'Antrenmanlar' : 'Workouts'}</Text>
          {selected.workouts.map((w, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 50).duration(280)} style={ft.workoutItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={ft.workoutItemTitle}>{w.name}</Text>
                <TouchableOpacity
                  style={ft.setActiveBtn}
                  onPress={async () => {
                    await setActiveProgram({
                      id:          `${selected.id}-${i}`,
                      title:       `${selected.title} — ${w.name}`,
                      description: selected.description,
                      exercises:   w.exercises.map(ex => ({ name: ex })),
                    });
                    Alert.alert(
                      lang === 'tr' ? '✓ Program Ayarlandı' : '✓ Program Set',
                      lang === 'tr'
                        ? `"${w.name}" artık aktif programın.`
                        : `"${w.name}" is now your active program.`
                    );
                  }}
                >
                  <Ionicons name="calendar-outline" size={12} color={C.lime} />
                  <Text style={ft.setActiveTxt}>{lang === 'tr' ? 'Aktif Yap' : 'Set Active'}</Text>
                </TouchableOpacity>
              </View>
              {w.exercises.map((ex, j) => (
                <Text key={j} style={ft.workoutExercise}>• {ex}</Text>
              ))}
            </Animated.View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Templates list ──────────────────────────────────────────────────────────
  return (
    <View style={wt.fill}>
      {/* All Plans / My Plans tab */}
      <View style={ft.subTabBar}>
        {[
          { key: 'all',  label: lang === 'tr' ? 'Tüm Planlar' : 'All Plans' },
          { key: 'mine', label: lang === 'tr' ? 'Planlarım' : 'My Plans' },
        ].map(t => (
          <TouchableOpacity key={t.key} style={[ft.subTab, activeTab === t.key && ft.subTabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[ft.subTabTxt, activeTab === t.key && ft.subTabTxtActive]}>{t.label}</Text>
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
                  {lang === 'tr' ? 'Henüz plan yok.\nAntrenman → Template Oluştur ile ekle.' : 'No plans yet.\nGo to Workouts → Create Template.'}
                </Text>
              </View>
            ) : myPlans.map((plan, i) => (
              <Animated.View key={plan.id} entering={FadeInDown.delay(i * 50).duration(280)}>
                <TouchableOpacity style={ft.planCard} onPress={() => { setSelected(plan); setView('detail'); }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={ft.planTitle}>{plan.title}</Text>
                    <View style={ft.workoutsBadge}>
                      <Text style={ft.workoutsBadgeTxt}>{plan.days} {lang === 'tr' ? 'gün' : 'days'}</Text>
                    </View>
                  </View>
                  {plan.description ? <Text style={ft.planDesc} numberOfLines={2}>{plan.description}</Text> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <Ionicons name="person-outline" size={12} color={C.dim} />
                    <Text style={ft.planAthletes}>{lang === 'tr' ? 'Kişisel plan' : 'Personal plan'}</Text>
                    <TouchableOpacity
                      onPress={() => Alert.alert(lang === 'tr' ? 'Planı Sil' : 'Delete Plan', '', [
                        { text: t('cancel', lang), style: 'cancel' },
                        { text: lang === 'tr' ? 'Sil' : 'Delete', style: 'destructive', onPress: async () => { await deleteMyPlan(plan.id); getMyPlans().then(setMyPlans); }},
                      ])}
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
                <Text style={[ft.filterTagTxt, hasFilters && { color: '#dc2626' }]}>{lang === 'tr' ? 'Filtre' : 'Filter'}</Text>
              </TouchableOpacity>
              {['all','free','paid'].map(p => (
                <TouchableOpacity key={p} style={[ft.paidBtn, showPaid === p && ft.paidBtnActive]} onPress={() => setShowPaid(p)}>
                  <Text style={[ft.paidBtnTxt, showPaid === p && ft.paidBtnTxtActive]}>
                    {p === 'all' ? (lang === 'tr' ? 'Tümü' : 'All') : p === 'free' ? (lang === 'tr' ? 'Ücretsiz' : 'Free') : (lang === 'tr' ? 'Premium' : 'Premium')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={wt.accordion} onPress={() => setPlansOpen(v => !v)}>
              <Text style={wt.accordionTitle}>{lang === 'tr' ? 'Antrenman Planları' : 'Training Plans'}</Text>
              <Ionicons name={plansOpen ? 'chevron-up' : 'chevron-down'} size={18} color='#dc2626' />
            </TouchableOpacity>

            {plansOpen && filtered.map((plan, i) => (
              <Animated.View key={plan.id} entering={FadeInDown.delay(i * 50).duration(280)}>
                <TouchableOpacity style={ft.planCard} onPress={() => { setSelected(plan); setView('detail'); }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={ft.planTitle}>{plan.title}</Text>
                    <View style={ft.workoutsBadge}>
                      <Text style={ft.workoutsBadgeTxt}>{plan.workouts.length} {lang === 'tr' ? 'antrenman' : 'workouts'}</Text>
                    </View>
                  </View>
                  <Text style={ft.planDesc} numberOfLines={2}>{plan.description}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <Ionicons name="people-outline" size={12} color={C.dim} />
                    <Text style={ft.planAthletes}>{plan.athleteCount.toLocaleString()} {lang === 'tr' ? 'sporcu' : 'athletes'}</Text>
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
    </View>
  );
}

const ft = StyleSheet.create({
  subTabBar:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  subTab:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, marginBottom: -1, borderBottomColor: 'transparent' },
  subTabActive: { borderBottomColor: '#dc2626' },
  subTabTxt:    { color: C.muted, fontSize: 13, fontWeight: '600' },
  subTabTxtActive: { color: C.text, fontWeight: '800' },
  setActiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(232,244,74,0.3)', backgroundColor: 'rgba(232,244,74,0.08)' },
  setActiveTxt: { color: C.lime, fontSize: 11, fontWeight: '700' },
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
  workoutItem:   { backgroundColor: C.s1, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  workoutItemTitle: { color: '#dc2626', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  workoutExercise:  { color: C.muted, fontSize: 12, lineHeight: 20 },
});

// ─── Tab bar shared style ─────────────────────────────────────────────────────
const TAB_BAR_H = StyleSheet.create({
  bar:       { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: C.border },
  tabBtn:    { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, marginBottom: -2, borderBottomColor: 'transparent' },
  tabBtnAct: { borderBottomColor: '#dc2626' },
  tabTxt:    { color: C.muted, fontSize: 13, fontWeight: '600' },
  tabTxtAct: { color: C.text, fontWeight: '800' },
});

// ─── ExercisesScreen (exercises-only tab) ─────────────────────────────────────
function ExercisesLibrary({ lang }) {
  // All existing state and logic moved here
  const [exercises, setExercises] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadMore,  setLoadMore]  = useState(false);
  const [hasMore,   setHasMore]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [cat,       setCat]       = useState('');
  const [diff,      setDiff]      = useState(0);
  const [selected,  setSelected]  = useState(null);
  const [favorites, setFavorites] = useState([]);
  const offsetRef   = useRef(0);
  const searchTimer = useRef(null);

  useEffect(() => { getFavorites().then(setFavorites); }, []);

  const handleToggleFav = useCallback(async (exerciseName) => {
    const updated = await toggleFavorite(exerciseName);
    setFavorites([...updated]);
  }, []);

  const fetchExercises = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    if (!reset) setLoadMore(true);
    let q = supabase.from('exercises').select('*').range(offset, offset + PAGE - 1).order('name');
    if (cat)           q = q.eq('category', cat);
    if (diff > 0)      q = q.eq('difficulty', diff);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    const { data, error } = await q;
    if (error) { setLoading(false); setLoadMore(false); return; }
    const seen = new Set();
    const unique = (data || []).filter(ex => { if (seen.has(ex.slug)) return false; seen.add(ex.slug); return true; });
    if (unique.length > 0) {
      const ids = unique.map(e => e.id);
      const { data: ratings } = await supabase.from('exercise_rating_summary').select('*').in('exercise_id', ids);
      const rm = {};
      (ratings || []).forEach(r => { rm[r.exercise_id] = r; });
      unique.forEach(ex => { ex.avg_rating = rm[ex.id]?.avg_rating ?? 0; ex.vote_count = rm[ex.id]?.vote_count ?? 0; });
    }
    if (reset) { setExercises(unique); offsetRef.current = unique.length; }
    else { setExercises(prev => { const ex = new Set(prev.map(e => e.slug)); return [...prev, ...unique.filter(e => !ex.has(e.slug))]; }); offsetRef.current += unique.length; }
    setHasMore(unique.length === PAGE);
    setLoading(false); setLoadMore(false);
  }, [cat, diff, search]);

  useEffect(() => {
    setLoading(true); offsetRef.current = 0;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchExercises(true), search ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [cat, diff, search]);

  const renderItem = useCallback(({ item }) => (
    <ExerciseRow item={item} onPress={setSelected} lang={lang} isFav={favorites.includes(item.name)} onToggleFav={handleToggleFav} />
  ), [lang, favorites, handleToggleFav]);

  const renderCat = useCallback(({ item: c }) => {
    const label = c === '' ? t('all', lang) : (CATEGORY_LABELS[lang]?.[c] ?? c);
    const color = CAT_COLOR[c] ?? C.lime;
    const icon  = CAT_ICON[c] ?? 'apps-outline';
    const active = cat === c;
    return (
      <TouchableOpacity style={[s.catBtn, active && { backgroundColor: color, borderColor: color }]} onPress={() => setCat(active ? '' : c)} activeOpacity={0.75}>
        <Ionicons name={icon} size={14} color={active ? '#0a0c0f' : color} />
        <Text style={[s.catTxt, active && { color: '#0a0c0f', fontWeight: '800' }]}>{label}</Text>
      </TouchableOpacity>
    );
  }, [cat, lang]);

  const renderFooter = useCallback(() => loadMore ? <ActivityIndicator color={C.teal} style={{ margin: 16 }} /> : null, [loadMore]);
  const CATS = ['', ...CAT_KEYS];

  return (
    <View style={s.fill}>
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color={C.dim} />
        <TextInput style={s.searchInput} placeholder={t('searchPlaceholder', lang)} placeholderTextColor={C.dim} value={search} onChangeText={setSearch} />
        {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={C.dim} /></TouchableOpacity>}
      </View>
      <FlatList data={CATS} keyExtractor={c => c || '__all__'} renderItem={renderCat} horizontal showsHorizontalScrollIndicator={false} style={s.catList} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.diffScroll} contentContainerStyle={s.diffContent}>
        {DIFF_META.map((dm, d) => {
          const active = diff === d;
          return (
            <TouchableOpacity key={d} style={[s.diffBtn, active && { backgroundColor: dm.color, borderColor: dm.color }]} onPress={() => setDiff(active ? 0 : d)} activeOpacity={0.75}>
              <Ionicons name={dm.icon} size={13} color={active ? '#0a0c0f' : dm.color} />
              <Text style={[s.diffTxt, active && { color: '#0a0c0f', fontWeight: '800' }]}>{t(dm.key, lang)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={s.countTxt}>{loading ? '...' : `${exercises.length}+ ${t('exercises', lang)}`}</Text>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.lime} size="large" />
          <Text style={{ color: C.muted, marginTop: 12, fontSize: 13 }}>{t('loading', lang)}</Text>
        </View>
      ) : (
        <FlatList data={exercises} keyExtractor={item => item.slug ?? item.id} renderItem={renderItem} contentContainerStyle={s.list} showsVerticalScrollIndicator={false} style={{ flex: 1 }} onEndReached={() => { if (!loadMore && hasMore) fetchExercises(false); }} onEndReachedThreshold={0.3} ListFooterComponent={renderFooter} initialNumToRender={12} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews={Platform.OS === 'android'} />
      )}
      <ExerciseDetail item={selected} visible={!!selected} onClose={() => setSelected(null)} onRated={() => fetchExercises(true)} onUpdateSelected={(avg, votes) => setSelected(prev => prev ? { ...prev, avg_rating: avg, vote_count: votes } : prev)} lang={lang} />
    </View>
  );
}

// ─── Root ExercisesScreen with 3 tabs ────────────────────────────────────────
export default function ExercisesScreen() {
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState(0); // 0=Exercises 1=Workouts 2=Templates

  const TABS = [
    { label: lang === 'tr' ? 'Egzersizler' : 'Exercises' },
    { label: lang === 'tr' ? 'Antrenman'   : 'Workouts'  },
    { label: lang === 'tr' ? 'Şablonlar'   : 'Templates' },
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
      {activeTab === 2 && <TemplatesTab lang={lang} />}
    </View>
  );
}

// ─── Dead code removal: old state moved to ExercisesLibrary ──────────────────
function _DEAD_ExercisesScreen_OLD() {
  const { lang } = useLang();
  const [exercises, setExercises] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadMore,  setLoadMore]  = useState(false);
  const [hasMore,   setHasMore]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [cat,       setCat]       = useState('');
  const [diff,      setDiff]      = useState(0);
  const [selected,  setSelected]  = useState(null);
  const [favorites, setFavorites] = useState([]);
  const offsetRef   = useRef(0);
  const searchTimer = useRef(null);

  useEffect(() => { getFavorites().then(setFavorites); }, []);

  const handleToggleFav = useCallback(async (exerciseName) => {
    const updated = await toggleFavorite(exerciseName);
    setFavorites([...updated]);
  }, []);

  const fetchExercises = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    if (!reset) setLoadMore(true);

    let q = supabase.from('exercises').select('*')
      .range(offset, offset + PAGE - 1).order('name');
    if (cat)           q = q.eq('category', cat);
    if (diff > 0)      q = q.eq('difficulty', diff);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);

    const { data, error } = await q;
    if (error) { setLoading(false); setLoadMore(false); return; }

    const seen = new Set();
    const unique = (data || []).filter(ex => { if (seen.has(ex.slug)) return false; seen.add(ex.slug); return true; });

    if (unique.length > 0) {
      const ids = unique.map(e => e.id);
      const { data: ratings } = await supabase.from('exercise_rating_summary').select('*').in('exercise_id', ids);
      const rm = {};
      (ratings || []).forEach(r => { rm[r.exercise_id] = r; });
      unique.forEach(ex => { ex.avg_rating = rm[ex.id]?.avg_rating ?? 0; ex.vote_count = rm[ex.id]?.vote_count ?? 0; });
    }

    if (reset) {
      setExercises(unique);
      offsetRef.current = unique.length;
    } else {
      setExercises(prev => {
        const existing = new Set(prev.map(e => e.slug));
        return [...prev, ...unique.filter(e => !existing.has(e.slug))];
      });
      offsetRef.current += unique.length;
    }
    setHasMore(unique.length === PAGE);
    setLoading(false); setLoadMore(false);
  }, [cat, diff, search]);

  useEffect(() => {
    setLoading(true); offsetRef.current = 0;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchExercises(true), search ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [cat, diff, search]);

  const renderItem = useCallback(({ item }) => (
    <ExerciseRow
      item={item}
      onPress={setSelected}
      lang={lang}
      isFav={favorites.includes(item.name)}
      onToggleFav={handleToggleFav}
    />
  ), [lang, favorites, handleToggleFav]);
  const renderCat = useCallback(({ item: c }) => {
    const label  = c === '' ? t('all', lang) : (CATEGORY_LABELS[lang]?.[c] ?? c);
    const color  = CAT_COLOR[c] ?? C.lime;
    const icon   = CAT_ICON[c] ?? 'apps-outline';
    const active = cat === c;
    return (
      <TouchableOpacity
        style={[s.catBtn, active && { backgroundColor: color, borderColor: color }]}
        onPress={() => setCat(c)}
        activeOpacity={0.75}
      >
        <Ionicons name={icon} size={14} color={active ? '#0a0c0f' : color} />
        <Text style={[s.catTxt, active && { color: '#0a0c0f', fontWeight: '800' }]}>{label}</Text>
      </TouchableOpacity>
    );
  }, [cat, lang]);
  const renderFooter = useCallback(() => loadMore ? <ActivityIndicator color={C.teal} style={{ margin: 16 }} /> : null, [loadMore]);

  const CATS = ['', ...CAT_KEYS];

  return (
    <View style={s.fill}>
      {/* Arama */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color={C.dim} />
        <TextInput
          style={s.searchInput}
          placeholder={t('searchPlaceholder', lang)}
          placeholderTextColor={C.dim}
          value={search} onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={C.dim} />
          </TouchableOpacity>
        )}
      </View>

      {/* Kategori filtreleri */}
      <FlatList
        data={CATS} keyExtractor={c => c || '__all__'}
        renderItem={renderCat}
        horizontal showsHorizontalScrollIndicator={false}
        style={s.catList} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      />

      {/* Zorluk filtresi */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.diffScroll}
        contentContainerStyle={s.diffContent}
      >
        {DIFF_META.map((dm, d) => {
          const label  = t(dm.key, lang);
          const active = diff === d;
          return (
            <TouchableOpacity
              key={d}
              style={[s.diffBtn, active && { backgroundColor: dm.color, borderColor: dm.color }]}
              onPress={() => setDiff(d)}
              activeOpacity={0.75}
            >
              <Ionicons name={dm.icon} size={13} color={active ? '#0a0c0f' : dm.color} />
              <Text style={[s.diffTxt, active && { color: '#0a0c0f', fontWeight: '800' }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sayaç */}
      <Text style={s.countTxt}>{loading ? '...' : `${exercises.length}+ ${t('exercises', lang)}`}</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.lime} size="large" />
          <Text style={{ color: C.muted, marginTop: 12, fontSize: 13 }}>{t('loading', lang)}</Text>
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={item => item.slug ?? item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          onEndReached={() => { if (!loadMore && hasMore) fetchExercises(false); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          initialNumToRender={12} maxToRenderPerBatch={10} windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}

      <ExerciseDetail
        item={selected} visible={!!selected}
        onClose={() => setSelected(null)}
        onRated={() => fetchExercises(true)}
        onUpdateSelected={(avg, votes) => setSelected(prev =>
          prev ? { ...prev, avg_rating: avg, vote_count: votes } : prev
        )}
        lang={lang}
      />
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
