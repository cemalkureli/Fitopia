import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Dimensions, Image, ActivityIndicator,
  ScrollView, Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../utils/theme';
import { supabase } from '../lib/supabase';
import ExerciseMedia from '../components/ExerciseMedia';
import { useLang } from '../context/LanguageContext';
import { t, CATEGORY_LABELS, MUSCLE_LABELS } from '../utils/i18n';

const { width, height } = Dimensions.get('window');

// Kategori filtre listesi (DB değerleri)
const CAT_KEYS = ['Göğüs','Sırt','Omuz','Kol','Bacak','Core','Kardio','Compound'];

const CAT_COLOR = {
  'Göğüs':   C.orange, 'Sırt':   C.blue,  'Omuz':    C.purple,
  'Kol':     C.teal,   'Bacak':  C.green,  'Core':    C.lime,
  'Kardio':  C.red,    'Compound':C.muted,
};

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
const ExerciseRow = memo(({ item, onPress, lang }) => {
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
      {/* Etki nokta göstergesi */}
      <View style={s.effWrap}>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={[s.effDot, { backgroundColor: i < (item.effectiveness ?? 0) ? color : C.s3 }]} />
        ))}
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.dim} />
    </TouchableOpacity>
  );
});

// ─── Detay bottom sheet ───────────────────────────────────────────────────────
function ExerciseDetail({ item, visible, onClose, onRated, lang }) {
  const [userRating, setUserRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [liveAvg,    setLiveAvg]    = useState(0);
  const [liveVotes,  setLiveVotes]  = useState(0);
  const color = CAT_COLOR[item?.category] ?? C.lime;
  const DIFF  = [t('diff1',lang), t('diff2',lang), t('diff3',lang), t('diff4',lang), t('diff5',lang)];

  useEffect(() => {
    if (!visible || !item) return;
    setUserRating(0); setSubmitted(false);
    setLiveAvg(item?.avg_rating ?? 0);
    setLiveVotes(item?.vote_count ?? 0);
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
      await supabase.from('exercise_ratings').upsert({ exercise_id: item.id, user_id: ud.user.id, rating });
      // XP sadece ilk oyda verilir
      if (wasFirstTime) {
        await supabase.rpc('increment_xp', { uid: ud.user.id, amount: 5, rating_inc: 1 }).catch(() => {});
      }
      // Güncel topluluk ortalamasını çek
      const { data: summary } = await supabase
        .from('exercise_rating_summary')
        .select('avg_rating, vote_count')
        .eq('exercise_id', item.id)
        .single();
      if (summary) {
        setLiveAvg(Number(summary.avg_rating) || 0);
        setLiveVotes(summary.vote_count || 0);
      }
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

              {/* Nasıl yapılır */}
              {item.instructions ? (
                <>
                  <Text style={det.sectionTitle}>{t('instructions', lang)}</Text>
                  <Text style={det.instrTxt}>{item.instructions}</Text>
                </>
              ) : null}

              {/* Kaslar */}
              <Text style={det.sectionTitle}>{t('muscleGroups', lang)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                <View style={[det.muscleTag, { backgroundColor: C.teal+'22', borderColor: C.teal }]}>
                  <Text style={[det.muscleTxt, { color: C.teal }]}>
                    {MUSCLE_LABELS[lang]?.[item.primary_muscle] ?? item.primary_muscle}
                  </Text>
                </View>
                {(item.secondary_muscles || []).map((m, i) => (
                  <View key={i} style={det.muscleTag}>
                    <Text style={det.muscleTxt}>{MUSCLE_LABELS[lang]?.[m] ?? m}</Text>
                  </View>
                ))}
              </View>

              {/* Etki */}
              <Text style={det.sectionTitle}>{t('effectiveness', lang)}</Text>
              <EffBar value={item.effectiveness ?? 3} label={t('generalEffect', lang)} color={color} />
              <EffBar value={item.difficulty ?? 3}    label={t('difficulty', lang)}    color={C.orange} />

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
                  {lang === 'tr' ? 'Oyunu değiştirebilirsin' : 'You can change your rating'}
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
  muscleTag:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border, backgroundColor: C.s2 },
  muscleTxt:  { color: C.muted, fontSize: 12, fontWeight: '600' },
  closeBtn:   { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────
const PAGE = 20;

export default function ExercisesScreen() {
  const { lang } = useLang();
  const [exercises, setExercises] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadMore,  setLoadMore]  = useState(false);
  const [hasMore,   setHasMore]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [cat,       setCat]       = useState('');   // '' = Tümü
  const [selected,  setSelected]  = useState(null);
  const offsetRef   = useRef(0);
  const searchTimer = useRef(null);

  const fetchExercises = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    if (!reset) setLoadMore(true);

    let q = supabase.from('exercises').select('*')
      .range(offset, offset + PAGE - 1).order('name');
    if (cat)           q = q.eq('category', cat);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);

    const { data, error } = await q;
    if (error) { setLoading(false); setLoadMore(false); return; }

    // Dedup by slug
    const seen = new Set();
    const unique = (data || []).filter(ex => { if (seen.has(ex.slug)) return false; seen.add(ex.slug); return true; });

    // Ratings ayrı sorgu
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
  }, [cat, search]);

  useEffect(() => {
    setLoading(true); offsetRef.current = 0;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchExercises(true), search ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [cat, search]);

  const renderItem   = useCallback(({ item }) => <ExerciseRow item={item} onPress={setSelected} lang={lang} />, [lang]);
  const renderCat    = useCallback(({ item: c }) => {
    const label = c === '' ? (lang === 'tr' ? 'Tümü' : 'All') : (CATEGORY_LABELS[lang]?.[c] ?? c);
    const color = CAT_COLOR[c] ?? C.lime;
    return (
      <TouchableOpacity
        style={[s.catBtn, cat === c && { backgroundColor: color + '20', borderColor: color }]}
        onPress={() => setCat(c)}
      >
        <Text style={[s.catTxt, cat === c && { color, fontWeight: '700' }]}>{label}</Text>
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
  catBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1 },
  catTxt:     { color: C.muted, fontSize: 12, fontWeight: '600' },
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
