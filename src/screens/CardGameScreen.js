/**
 * CardGameScreen — "Egzersiz Kartları" swipe oyunu (Tinder mantığı).
 * Sağa kaydır → beğen (yeşil kalp efekti, Likes'e ekle).
 * Sola kaydır → beğenme (kırmızı efekt, Dislikes'e ekle).
 * Bölümler: Oyna (deste) · Beğendiklerim · Beğenmediklerim.
 * Kartlar cam/transparan, temaya uygun; akışkan animasyonlar.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, PanResponder, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedRN, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { C, F } from '../utils/theme';
import { useLang } from '../context/LanguageContext';
import { getCardLikes, getCardDislikes, decideCard, removeCard, resetCards } from '../utils/storage';
import { EXERCISES, thumbUrl, CAT_LABEL, CAT_COLOR, MUSCLE_LABEL } from '../data/exercises';

const { width: SW, height: SH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SW * 0.28;
const CARD_W = SW - 40;
const CARD_H = Math.min(SH * 0.56, 540);

const MUSCLE_LABELS = {
  tr: { chest:'Göğüs', back:'Sırt', shoulders:'Omuz', biceps:'Biceps', triceps:'Triceps', legs:'Bacak', quads:'Ön Bacak', hamstrings:'Arka Bacak', glutes:'Kalça', calves:'Baldır', abs:'Karın', core:'Core', forearms:'Ön Kol', traps:'Trapez' },
  en: { chest:'Chest', back:'Back', shoulders:'Shoulders', biceps:'Biceps', triceps:'Triceps', legs:'Legs', quads:'Quads', hamstrings:'Hamstrings', glutes:'Glutes', calves:'Calves', abs:'Abs', core:'Core', forearms:'Forearms', traps:'Traps' },
};
const catColor = { Göğüs:'#f472b6', Sırt:'#38bdf8', Bacak:'#a78bfa', Omuz:'#fb923c', Kol:'#34d399', Karın:'#facc15', Kardio:'#ef4444' };

function muscleLabel(m, lang) { return MUSCLE_LABELS[lang]?.[m] ?? m ?? ''; }

// ─── Tek kart (görsel) ────────────────────────────────────────────────────────
function CardFace({ ex, lang }) {
  const accent   = CAT_COLOR[ex.cat] ?? C.lime;
  const catLabel = CAT_LABEL[ex.cat]?.[lang] ?? ex.cat ?? '—';
  const muscle   = MUSCLE_LABEL[ex.muscle]?.[lang] ?? ex.target ?? '';
  return (
    <View style={s.cardInner}>
      {ex.m ? (
        <ExpoImage source={{ uri: thumbUrl(ex.m) }} style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }]} contentFit="cover" cachePolicy="memory-disk" transition={150} />
      ) : (
        <LinearGradient colors={[accent + '22', '#0a0f1e']} style={StyleSheet.absoluteFill} />
      )}
      {/* alttan koyu degrade — cam/transparan his */}
      <LinearGradient
        colors={['rgba(5,7,14,0)', 'rgba(5,7,14,0.35)', 'rgba(5,7,14,0.92)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.cardBody}>
        <View style={s.cardChipRow}>
          <View style={[s.cardChip, { borderColor: accent + '88' }]}>
            <Ionicons name="barbell-outline" size={13} color={accent} />
            <Text style={[s.cardChipTxt, { color: accent }]}>{catLabel}</Text>
          </View>
        </View>
        <Text style={s.cardName} numberOfLines={2}>{ex.name}</Text>
        {muscle ? (
          <View style={s.cardMetaRow}>
            <Ionicons name="body-outline" size={15} color={C.muted} />
            <Text style={s.cardMeta}>{muscle}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Deste (swipe) ────────────────────────────────────────────────────────────
function Deck({ cards, onDecide, lang }) {
  const [index, setIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;
  const burst = useRef(new Animated.Value(0)).current;
  const animating = useRef(false);
  const [burstKind, setBurstKind] = useState(null); // 'like' | 'dislike'

  // En güncel index/cards/onDecide'ı ref'te tut — PanResponder bir kez oluştuğu için
  // closure'da eski değerleri "dondurmasın" (stale closure bug'ı tamamen ortadan kalkar).
  const indexRef    = useRef(0);        indexRef.current = index;
  const cardsRef    = useRef(cards);    cardsRef.current = cards;
  const onDecideRef = useRef(onDecide); onDecideRef.current = onDecide;

  useEffect(() => { setIndex(0); indexRef.current = 0; position.setValue({ x: 0, y: 0 }); }, [cards]);

  const rotate = position.x.interpolate({ inputRange: [-SW / 2, 0, SW / 2], outputRange: ['-9deg', '0deg', '9deg'] });
  const likeOpacity = position.x.interpolate({ inputRange: [10, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, -10], outputRange: [1, 0], extrapolate: 'clamp' });
  const tintLike = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 0.35], extrapolate: 'clamp' });
  const tintNope = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [0.35, 0], extrapolate: 'clamp' });

  const playBurst = (kind) => {
    setBurstKind(kind);
    burst.setValue(0);
    Animated.sequence([
      Animated.spring(burst, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(burst, { toValue: 0, duration: 260, delay: 180, useNativeDriver: true }),
    ]).start(() => setBurstKind(null));
  };

  // Stabil (useRef ile bir kez oluşan) handler'lar — hep ref'lerden okur.
  const finish = useRef((dir) => {
    const card = cardsRef.current[indexRef.current];
    if (!card || animating.current) return;
    animating.current = true;
    const decision = dir === 'right' ? 'like' : 'dislike';
    playBurst(decision);
    // commit YALNIZCA bir kez çalışır: kartı ilerlet + kararı kaydet + kilidi aç.
    // Hem animasyon callback'i hem de güvenlik timeout'u çağırır; ikisinden
    // hangisi önce gelirse o iş görür → animating asla takılı kalmaz.
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      position.setValue({ x: 0, y: 0 });
      setIndex(i => { const n = i + 1; indexRef.current = n; return n; });
      onDecideRef.current?.(card, decision);
      animating.current = false;
    };
    Animated.timing(position, {
      toValue: { x: dir === 'right' ? SW * 1.3 : -SW * 1.3, y: 40 },
      duration: 220, useNativeDriver: true,
    }).start(commit);
    setTimeout(commit, 320); // güvenlik: native callback ateşlenmezse bile ilerle
  }).current;

  const reset = useRef(() => Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 6 }).start()).current;

  // PanResponder: mesafe VEYA hız eşiğini geçince karar ver. Hızlı bir "fiske"de
  // (parmak az yol katedip yüksek hızla kalkar) eski kod mesafe eşiğine takılıp
  // kartı geri yaylandırıyordu. Ayrıca animasyon sürerken position'a DOKUNMUYORUz
  // (reset çağırmıyoruz) — aksi halde finish animasyonu yarıda kesilip kilit
  // takılı kalıyordu. Süren animasyon kendi doğal süresinde bitiyor.
  const VX_THRESHOLD = 0.3;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => { if (!animating.current) position.setValue({ x: g.dx, y: g.dy * 0.4 }); },
    onPanResponderRelease: (_, g) => {
      if (animating.current) return; // animasyon sürerken dokunma
      const right = g.dx > SWIPE_THRESHOLD || (g.vx > VX_THRESHOLD && g.dx > 30);
      const left  = g.dx < -SWIPE_THRESHOLD || (g.vx < -VX_THRESHOLD && g.dx < -30);
      if (right) finish('right');
      else if (left) finish('left');
      else reset();
    },
    onPanResponderTerminate: () => { if (!animating.current) reset(); },
  })).current;

  const remaining = cards.length - index;
  if (remaining <= 0) {
    return (
      <AnimatedRN.View entering={FadeIn.duration(400)} style={s.emptyDeck}>
        <View style={s.emptyCircle}><Ionicons name="checkmark-done" size={40} color={C.lime} /></View>
        <Text style={s.emptyTitle}>{lang === 'tr' ? 'Deste bitti!' : 'Deck complete!'}</Text>
        <Text style={s.emptySub}>{lang === 'tr' ? 'Tüm kartları değerlendirdin. Sekmelerden seçimlerine bak.' : 'You rated every card. Check your picks in the tabs.'}</Text>
      </AnimatedRN.View>
    );
  }

  return (
    <View style={s.deckWrap}>
      <View style={s.deckArea}>
        {/* arkadaki kartlar (statik, kademeli) */}
        {cards.slice(index + 1, index + 3).reverse().map((c, i) => {
          const depth = cards.slice(index + 1, index + 3).length - i;
          return (
            <View key={c.name} style={[s.card, { transform: [{ scale: 1 - depth * 0.04 }, { translateY: depth * 12 }], opacity: 1 - depth * 0.15 }]}>
              <CardFace ex={c} lang={lang} />
            </View>
          );
        })}
        {/* üstteki sürüklenebilir kart */}
        <Animated.View
          {...pan.panHandlers}
          style={[s.card, { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }]}
        >
          <CardFace ex={cards[index]} lang={lang} />
          {/* sürükleme tint'leri */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.cardRadius, { backgroundColor: C.lime, opacity: tintLike }]} />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.cardRadius, { backgroundColor: C.red, opacity: tintNope }]} />
          {/* LIKE / NOPE damgaları */}
          <Animated.View style={[s.stamp, s.stampLike, { opacity: likeOpacity }]}>
            <Ionicons name="heart" size={20} color={C.lime} />
            <Text style={[s.stampTxt, { color: C.lime }]}>{lang === 'tr' ? 'BEĞEN' : 'LIKE'}</Text>
          </Animated.View>
          <Animated.View style={[s.stamp, s.stampNope, { opacity: nopeOpacity }]}>
            <Ionicons name="heart-dislike" size={20} color={C.red} />
            <Text style={[s.stampTxt, { color: C.red }]}>{lang === 'tr' ? 'GEÇ' : 'NOPE'}</Text>
          </Animated.View>
        </Animated.View>

        {/* karar burst efekti */}
        {burstKind && (
          <Animated.View pointerEvents="none" style={[s.burst, {
            opacity: burst,
            transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] }) }],
          }]}>
            <Ionicons
              name={burstKind === 'like' ? 'heart' : 'heart-dislike'}
              size={120}
              color={burstKind === 'like' ? C.lime : C.red}
            />
          </Animated.View>
        )}
      </View>

      {/* aksiyon butonları */}
      <View style={s.actions}>
        <TouchableOpacity onPress={() => finish('left')} activeOpacity={0.8} style={[s.actionBtn, { borderColor: C.red + '66' }]}>
          <Ionicons name="close" size={30} color={C.red} />
        </TouchableOpacity>
        <View style={s.counterPill}>
          <Text style={s.counterTxt}>{remaining}</Text>
        </View>
        <TouchableOpacity onPress={() => finish('right')} activeOpacity={0.8} style={[s.actionBtn, { borderColor: C.lime + '66' }]}>
          <Ionicons name="heart" size={26} color={C.lime} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Liste (beğendiklerim / beğenmediklerim) ──────────────────────────────────
function CardList({ items, kind, onRemove, lang }) {
  if (!items.length) {
    return (
      <View style={s.listEmpty}>
        <Ionicons name={kind === 'like' ? 'heart-outline' : 'heart-dislike-outline'} size={40} color={C.dim} />
        <Text style={s.listEmptyTxt}>
          {kind === 'like'
            ? (lang === 'tr' ? 'Henüz beğenilen kart yok.' : 'No liked cards yet.')
            : (lang === 'tr' ? 'Henüz geçilen kart yok.' : 'No passed cards yet.')}
        </Text>
      </View>
    );
  }
  const accent = kind === 'like' ? C.lime : C.red;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {items.map((ex, i) => (
        <AnimatedRN.View key={ex.name} entering={FadeInDown.delay(i * 30).duration(260)} style={s.listRow}>
          {ex.m ? (
            <ExpoImage source={{ uri: thumbUrl(ex.m) }} style={[s.listThumb, { backgroundColor: '#fff' }]} contentFit="cover" cachePolicy="memory-disk" transition={150} />
          ) : (
            <View style={[s.listThumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: C.s2 }]}>
              <Text style={{ color: accent, fontFamily: F.extrabold, fontSize: 18 }}>{ex.name?.[0] ?? '?'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.listName} numberOfLines={1}>{ex.name}</Text>
            <Text style={s.listMeta}>{(CAT_LABEL[ex.cat]?.[lang] ?? ex.cat ?? '')}{ex.muscle ? ' · ' + (MUSCLE_LABEL[ex.muscle]?.[lang] ?? '') : ''}</Text>
          </View>
          <View style={[s.listBadge, { backgroundColor: accent + '1A', borderColor: accent + '44' }]}>
            <Ionicons name={kind === 'like' ? 'heart' : 'heart-dislike'} size={14} color={accent} />
          </View>
          <TouchableOpacity onPress={() => onRemove(ex.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={16} color={C.dim} />
          </TouchableOpacity>
        </AnimatedRN.View>
      ))}
    </ScrollView>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────
export default function CardGameScreen() {
  const { lang } = useLang();
  const [tab, setTab] = useState('play');        // 'play' | 'likes' | 'dislikes'
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState([]);
  const [likes, setLikes] = useState([]);
  const [dislikes, setDislikes] = useState([]);

  useFocusEffect(useCallback(() => {
    getCardLikes().then(setLikes);
    getCardDislikes().then(setDislikes);
  }, []));

  const startGame = async () => {
    setStarted(true);
    setLoading(true);
    const [L, D] = await Promise.all([getCardLikes(), getCardDislikes()]);
    const decided = new Set([...L, ...D].map(x => x.name));
    // Yerel dataset — karar verilmemişleri karıştır, 40 kart al
    const pool = EXERCISES.filter(e => !decided.has(e.name));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    setDeck(pool.slice(0, 40).map(e => ({ name: e.name, cat: e.cat, muscle: e.muscle, target: e.target, m: e.m })));
    setLoading(false);
  };

  const handleDecide = async (card, decision) => {
    const { likes: L, dislikes: D } = await decideCard(card, decision);
    setLikes(L); setDislikes(D);
  };

  const handleRemove = async (name, kind) => {
    await removeCard(name, kind);
    if (kind === 'like') setLikes(await getCardLikes());
    else setDislikes(await getCardDislikes());
  };

  const TABS = [
    { key: 'play',     label: lang === 'tr' ? 'Oyna' : 'Play',    icon: 'game-controller-outline' },
    { key: 'likes',    label: lang === 'tr' ? 'Beğendiklerim' : 'Likes', icon: 'heart' },
    { key: 'dislikes', label: lang === 'tr' ? 'Geçtiklerim' : 'Passed', icon: 'heart-dislike' },
  ];

  return (
    <View style={s.fill}>
      {/* segmented tabs */}
      <View style={s.segRow}>
        {TABS.map(tb => {
          const on = tab === tb.key;
          const badge = tb.key === 'likes' ? likes.length : tb.key === 'dislikes' ? dislikes.length : 0;
          return (
            <TouchableOpacity key={tb.key} onPress={() => setTab(tb.key)} activeOpacity={0.85} style={[s.segBtn, on && s.segBtnOn]}>
              <Ionicons name={tb.icon} size={15} color={on ? C.bg : C.muted} />
              <Text style={[s.segTxt, on && s.segTxtOn]}>{tb.label}</Text>
              {badge > 0 && <View style={s.segBadge}><Text style={s.segBadgeTxt}>{badge}</Text></View>}
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'play' && (
        !started ? (
          // ── Start Game intro ──
          <AnimatedRN.View entering={FadeIn.duration(400)} style={s.intro}>
            <AnimatedRN.View entering={ZoomIn.duration(500).springify()} style={s.introIcon}>
              <LinearGradient colors={[C.lime + '33', C.lime + '08']} style={s.introIconGrad}>
                <Ionicons name="albums" size={54} color={C.lime} />
              </LinearGradient>
            </AnimatedRN.View>
            <AnimatedRN.Text entering={FadeInDown.delay(150).duration(400)} style={s.introTitle}>
              {lang === 'tr' ? 'Egzersiz Kartları' : 'Exercise Cards'}
            </AnimatedRN.Text>
            <AnimatedRN.Text entering={FadeInDown.delay(250).duration(400)} style={s.introDesc}>
              {lang === 'tr'
                ? 'Kartları kaydır: sağa kaydırırsan beğenirsin 💚, sola kaydırırsan geçersin ❤️‍🔥. Seçimlerin sekmelerde saklanır.'
                : 'Swipe the cards: right to like 💚, left to pass ❤️‍🔥. Your picks are saved in the tabs.'}
            </AnimatedRN.Text>
            <AnimatedRN.View entering={FadeInUp.delay(400).duration(400)} style={{ alignSelf: 'stretch' }}>
              <TouchableOpacity onPress={startGame} activeOpacity={0.9}>
                <LinearGradient colors={['#e8f44a', '#a3c200']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.startBtn}>
                  <Ionicons name="play" size={20} color={C.bg} />
                  <Text style={s.startTxt}>{lang === 'tr' ? 'Oyuna Başla' : 'Start Game'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </AnimatedRN.View>
          </AnimatedRN.View>
        ) : loading ? (
          <View style={s.loadingWrap}><ActivityIndicator color={C.lime} size="large" /></View>
        ) : (
          <Deck cards={deck} onDecide={handleDecide} lang={lang} />
        )
      )}

      {tab === 'likes' && <CardList items={likes} kind="like" onRemove={(n) => handleRemove(n, 'like')} lang={lang} />}
      {tab === 'dislikes' && <CardList items={dislikes} kind="dislike" onRemove={(n) => handleRemove(n, 'dislike')} lang={lang} />}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },

  // segmented tabs
  segRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 40, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1 },
  segBtnOn: { backgroundColor: C.lime, borderColor: C.lime },
  segTxt: { color: C.muted, fontSize: 12, fontFamily: F.bold },
  segTxtOn: { color: C.bg },
  segBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: 'rgba(2,6,23,0.35)', alignItems: 'center', justifyContent: 'center' },
  segBadgeTxt: { color: C.bg, fontSize: 10, fontFamily: F.extrabold },

  // intro
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  introIcon: { marginBottom: 4 },
  introIconGrad: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.lime + '33' },
  introTitle: { color: C.text, fontSize: 26, fontFamily: F.extrabold, textAlign: 'center' },
  introDesc: { color: C.muted, fontSize: 14, fontFamily: F.regular, textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 18, marginTop: 12 },
  startTxt: { color: C.bg, fontSize: 16, fontFamily: F.extrabold, letterSpacing: 0.3 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // deck
  deckWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  deckArea: { width: CARD_W, height: CARD_H, alignItems: 'center', justifyContent: 'center' },
  card: { position: 'absolute', width: CARD_W, height: CARD_H, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(148,170,214,0.22)', backgroundColor: C.s1 },
  cardRadius: { borderRadius: 26 },
  cardInner: { flex: 1 },
  cardBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, gap: 8 },
  cardChipRow: { flexDirection: 'row' },
  cardChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(5,7,14,0.5)' },
  cardChipTxt: { fontSize: 12, fontFamily: F.bold },
  cardName: { color: '#fff', fontSize: 30, fontFamily: F.extrabold, lineHeight: 34 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMeta: { color: C.text, fontSize: 14, fontFamily: F.semibold },

  // stamps
  stamp: { position: 'absolute', top: 22, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 2, backgroundColor: 'rgba(5,7,14,0.55)' },
  stampLike: { right: 20, borderColor: C.lime, transform: [{ rotate: '12deg' }] },
  stampNope: { left: 20, borderColor: C.red, transform: [{ rotate: '-12deg' }] },
  stampTxt: { fontSize: 15, fontFamily: F.extrabold, letterSpacing: 1 },

  burst: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  // actions
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26, marginTop: 22 },
  actionBtn: { width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, backgroundColor: C.s1, alignItems: 'center', justifyContent: 'center' },
  counterPill: { minWidth: 44, height: 30, borderRadius: 15, backgroundColor: C.s1, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  counterTxt: { color: C.muted, fontSize: 14, fontFamily: F.extrabold },

  // empty deck
  emptyDeck: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.lime + '14', borderWidth: 1, borderColor: C.lime + '33', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: C.text, fontSize: 20, fontFamily: F.extrabold },
  emptySub: { color: C.muted, fontSize: 13.5, fontFamily: F.regular, textAlign: 'center', lineHeight: 20 },

  // lists
  listEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  listEmptyTxt: { color: C.dim, fontSize: 13.5, fontFamily: F.medium, textAlign: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.s1, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 10, marginBottom: 10 },
  listThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: C.s2 },
  listName: { color: C.text, fontSize: 15, fontFamily: F.bold },
  listMeta: { color: C.muted, fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  listBadge: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
