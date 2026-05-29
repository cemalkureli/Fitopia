import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Dimensions, Image, ActivityIndicator,
  Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeIn, SlideInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../utils/theme';
import { supabase } from '../lib/supabase';
import ExerciseMedia from '../components/ExerciseMedia';

const { width, height } = Dimensions.get('window');

const CATS = ['Tümü','Göğüs','Sırt','Omuz','Kol','Bacak','Core','Kardio','Compound'];

const CAT_COLOR = {
  'Göğüs':   C.orange,
  'Sırt':    C.blue,
  'Omuz':    C.purple,
  'Kol':     C.teal,
  'Bacak':   C.green,
  'Core':    C.lime,
  'Kardio':  C.red,
  'Compound':C.muted,
};

const DIFF_LABEL = ['','Kolay','Orta-Kolay','Orta','Zor','Çok Zor'];
const STAR_COLORS = ['#f87171','#fb923c','#e8f44a','#34d399','#14b8a6'];

// ─── Yıldız bileşeni ──────────────────────────────────────────────────────────
function Stars({ value, max = 5, size = 14, onPress }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <TouchableOpacity
          key={i}
          onPress={onPress ? () => onPress(i + 1) : undefined}
          disabled={!onPress}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
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
function EffectivenessBar({ value, label, color }) {
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
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  label: { color: C.muted, fontSize: 11, width: 80 },
  track: { flex: 1, height: 6, backgroundColor: C.s3, borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 3 },
  val:   { fontSize: 11, fontWeight: '700', width: 30, textAlign: 'right' },
});

// ─── Kas etiketi ─────────────────────────────────────────────────────────────
function MuscleTag({ name, primary }) {
  return (
    <View style={[mt.tag, primary && { backgroundColor: C.teal + '20', borderColor: C.teal }]}>
      <Text style={[mt.text, primary && { color: C.teal }]}>{name}</Text>
    </View>
  );
}
const mt = StyleSheet.create({
  tag:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.border, backgroundColor: C.s2, marginRight: 4, marginBottom: 4 },
  text: { color: C.muted, fontSize: 11, fontWeight: '600' },
});

// ─── Egzersiz satırı ─────────────────────────────────────────────────────────
const ExerciseRow = memo(({ item, onPress }) => {
  const color = CAT_COLOR[item.category] ?? C.lime;
  const avgRating = item.avg_rating ?? 0;

  return (
    <TouchableOpacity style={s.exRow} onPress={() => onPress(item)} activeOpacity={0.8}>
      {/* Thumbnail */}
      {item.thumb_url ? (
        <Image source={{ uri: item.thumb_url }} style={s.thumb} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[color + '33', color + '11']} style={s.thumb}>
          <Text style={[s.thumbLetter, { color }]}>{(item.name ?? '?')[0]}</Text>
        </LinearGradient>
      )}

      {/* Bilgi */}
      <View style={{ flex: 1 }}>
        <Text style={s.exName} numberOfLines={1}>{item.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <View style={[s.catBadge, { backgroundColor: color + '15' }]}>
            <Text style={[s.catBadgeText, { color }]}>{item.category}</Text>
          </View>
          <Text style={s.muscleMini}>{item.primary_muscle}</Text>
        </View>
        {avgRating > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <Stars value={avgRating} size={11} />
            <Text style={{ color: C.dim, fontSize: 10 }}>({item.vote_count ?? 0})</Text>
          </View>
        )}
      </View>

      {/* Etki değeri */}
      <View style={s.effWrap}>
        {Array.from({ length: 5 }, (_, i) => (
          <View
            key={i}
            style={[s.effDot, { backgroundColor: i < (item.effectiveness ?? 0) ? color : C.s3 }]}
          />
        ))}
      </View>

      <Ionicons name="chevron-forward" size={14} color={C.dim} />
    </TouchableOpacity>
  );
});

// ─── Detay modal ─────────────────────────────────────────────────────────────
function ExerciseDetail({ item, visible, onClose, onRated }) {
  const [userRating, setUserRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const color = CAT_COLOR[item?.category] ?? C.lime;

  useEffect(() => {
    if (!visible || !item) return;
    setUserRating(0);
    setSubmitted(false);
    // Kullanıcının önceki oyunu çek
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      supabase.from('exercise_ratings')
        .select('rating')
        .eq('exercise_id', item.id)
        .eq('user_id', data.user.id)
        .single()
        .then(({ data: r }) => {
          if (r) { setUserRating(r.rating); setSubmitted(true); }
        });
    });
  }, [visible, item?.id]);

  const handleRate = async (rating) => {
    setUserRating(rating);
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) { setSubmitting(false); return; }

      await supabase.from('exercise_ratings').upsert({
        exercise_id: item.id,
        user_id:     userData.user.id,
        rating,
      });

      // XP güncelle
      await supabase.from('user_xp').upsert({
        user_id:       userData.user.id,
        xp:            5,
        total_ratings: 1,
      }, { onConflict: 'user_id', ignoreDuplicates: false });

      await supabase.rpc('increment_xp', { uid: userData.user.id, amount: 5, rating_inc: 1 }).catch(() => {});

      setSubmitted(true);
      onRated?.();
    } catch {}
    setSubmitting(false);
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.detailOverlay} activeOpacity={1} onPress={onClose} />
      <Animated.View entering={SlideInUp.springify().damping(18)} style={s.detailSheet}>
        {/* Kapat çubuğu */}
        <View style={s.dragBar} />

        {/* Video */}
        <View style={[s.videoWrap, { borderColor: color + '40' }]}>
          {item.webm_url
            ? <ExerciseMedia source={item.webm_url} style={{ flex: 1 }} />
            : (
              <LinearGradient colors={[color + '22', color + '08']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="barbell-outline" size={48} color={color} />
              </LinearGradient>
            )
          }
        </View>

        {/* Başlık + kategori */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 20, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.detailName}>{item.name}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              <View style={[s.catBadge, { backgroundColor: color + '15' }]}>
                <Text style={[s.catBadgeText, { color }]}>{item.category}</Text>
              </View>
              <View style={[s.catBadge, { backgroundColor: C.s2 }]}>
                <Text style={[s.catBadgeText, { color: C.muted }]}>{DIFF_LABEL[item.difficulty] || 'Orta'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Açıklama */}
        {item.instructions ? (
          <Text style={s.instrText}>{item.instructions}</Text>
        ) : null}

        {/* Kas grupları */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Çalışan Kaslar</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <MuscleTag name={item.primary_muscle} primary />
            {(item.secondary_muscles || []).map((m, i) => (
              <MuscleTag key={i} name={m} />
            ))}
          </View>
        </View>

        {/* Etki değerleri */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Etki Değerleri</Text>
          <EffectivenessBar value={item.effectiveness ?? 3} label="Genel Etki" color={color} />
          <EffectivenessBar value={item.difficulty ?? 3}    label="Zorluk"     color={C.orange} />
        </View>

        {/* Topluluk puanı */}
        <View style={s.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.sectionTitle}>Topluluk Puanı</Text>
            {item.vote_count > 0 && (
              <Text style={s.voteCount}>{item.vote_count} oy · Ort. {Number(item.avg_rating).toFixed(1)}</Text>
            )}
          </View>
          <Stars value={item.avg_rating ?? 0} size={22} />
        </View>

        {/* Kullanıcı oyu */}
        <View style={[s.section, { marginBottom: 8 }]}>
          <Text style={s.sectionTitle}>
            {submitted ? 'Oyun' : 'Oy Ver'}
          </Text>
          {submitting ? (
            <ActivityIndicator color={C.lime} />
          ) : (
            <Stars value={userRating} size={28} onPress={submitted ? undefined : handleRate} />
          )}
          {submitted && <Text style={{ color: C.teal, fontSize: 12, marginTop: 6 }}>+5 XP kazandın!</Text>}
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────
const PAGE = 20;

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadMore,  setLoadMore]  = useState(false);
  const [hasMore,   setHasMore]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [cat,       setCat]       = useState('Tümü');
  const [selected,  setSelected]  = useState(null);
  const offsetRef = useRef(0);
  const searchTimer = useRef(null);

  const fetchExercises = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    if (!reset) setLoadMore(true);

    // Egzersiz sorgusu (join olmadan — duplicate row riski yok)
    let q = supabase
      .from('exercises')
      .select('*')
      .range(offset, offset + PAGE - 1)
      .order('name');

    if (cat !== 'Tümü') q = q.eq('category', cat);
    if (search.trim())  q = q.ilike('name', `%${search.trim()}%`);

    const { data, error } = await q;
    if (error) { setLoading(false); setLoadMore(false); return; }

    // Slug'a göre dedup (güvenlik önlemi)
    const seen = new Set();
    const unique = (data || []).filter(ex => {
      if (seen.has(ex.slug)) return false;
      seen.add(ex.slug);
      return true;
    });

    // Puanları ayrı çek
    if (unique.length > 0) {
      const ids = unique.map(e => e.id);
      const { data: ratings } = await supabase
        .from('exercise_rating_summary')
        .select('*')
        .in('exercise_id', ids);

      const ratingMap = {};
      (ratings || []).forEach(r => { ratingMap[r.exercise_id] = r; });
      unique.forEach(ex => {
        ex.avg_rating = ratingMap[ex.id]?.avg_rating ?? 0;
        ex.vote_count = ratingMap[ex.id]?.vote_count ?? 0;
      });
    }

    if (reset) {
      setExercises(unique);
      offsetRef.current = unique.length;
    } else {
      setExercises(prev => {
        // Merge — prev'deki slug'larla çakışma olmasın
        const existingSlugs = new Set(prev.map(e => e.slug));
        return [...prev, ...unique.filter(e => !existingSlugs.has(e.slug))];
      });
      offsetRef.current += unique.length;
    }
    setHasMore(unique.length === PAGE);
    setLoading(false);
    setLoadMore(false);
  }, [cat, search]);

  useEffect(() => {
    setLoading(true);
    offsetRef.current = 0;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchExercises(true), search ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [cat, search]);

  const handleEndReached = useCallback(() => {
    if (!loadMore && hasMore) fetchExercises(false);
  }, [loadMore, hasMore, fetchExercises]);

  const renderItem    = useCallback(({ item }) => <ExerciseRow item={item} onPress={setSelected} />, []);
  const renderCat     = useCallback(({ item: c }) => (
    <TouchableOpacity
      style={[s.catBtn, cat === c && { backgroundColor: (CAT_COLOR[c] ?? C.lime) + '20', borderColor: CAT_COLOR[c] ?? C.lime }]}
      onPress={() => setCat(c)}
    >
      <Text style={[s.catText, cat === c && { color: CAT_COLOR[c] ?? C.lime, fontWeight: '700' }]}>{c}</Text>
    </TouchableOpacity>
  ), [cat]);

  const renderFooter = useCallback(() =>
    loadMore ? <ActivityIndicator color={C.teal} style={{ margin: 16 }} /> : null
  , [loadMore]);

  return (
    <View style={s.fill}>
      {/* Arama */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color={C.dim} />
        <TextInput
          style={s.searchInput}
          placeholder="Egzersiz ara..."
          placeholderTextColor={C.dim}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={C.dim} />
          </TouchableOpacity>
        )}
      </View>

      {/* Kategori */}
      <FlatList
        data={CATS}
        keyExtractor={c => c}
        renderItem={renderCat}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.catList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      />

      {/* Sayaç */}
      <Text style={s.countText}>{loading ? '...' : `${exercises.length}+ egzersiz`}</Text>

      {/* Liste */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.lime} size="large" />
          <Text style={{ color: C.muted, marginTop: 12, fontSize: 13 }}>Yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={item => item.slug ?? item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}

      {/* Detay modalı */}
      <ExerciseDetail
        item={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onRated={() => fetchExercises(true)}
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
  catText:    { color: C.muted, fontSize: 12, fontWeight: '600' },
  countText:  { color: C.dim, fontSize: 11, fontWeight: '600', paddingHorizontal: 16, marginBottom: 6 },
  list:       { paddingHorizontal: 16, paddingBottom: 32 },

  exRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.s1, borderRadius: 14, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  thumb:       { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: C.s2 },
  thumbLetter: { fontSize: 24, fontWeight: '900' },
  exName:      { color: C.text, fontSize: 13, fontWeight: '700' },
  catBadge:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  catBadgeText:{ fontSize: 10, fontWeight: '700' },
  muscleMini:  { color: C.dim, fontSize: 11 },
  effWrap:     { flexDirection: 'column', gap: 2, marginRight: 4 },
  effDot:      { width: 5, height: 5, borderRadius: 2.5 },

  // Detail sheet
  detailOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  detailSheet:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: height * 0.92, borderWidth: 1, borderColor: C.border },
  dragBar:       { width: 36, height: 4, backgroundColor: C.s3, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  videoWrap:     { width: '100%', height: 220, borderWidth: 1, overflow: 'hidden', backgroundColor: C.s2 },
  detailName:    { color: C.text, fontSize: 18, fontWeight: '900' },
  instrText:     { color: C.muted, fontSize: 13, lineHeight: 20, paddingHorizontal: 20, marginTop: 10 },
  section:       { paddingHorizontal: 20, paddingTop: 14 },
  sectionTitle:  { color: C.text, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  voteCount:     { color: C.dim, fontSize: 11 },
});
