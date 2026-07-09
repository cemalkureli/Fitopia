/**
 * BodyMap — MuscleWiki tarzı tıklanabilir 2D kas haritası.
 * Ön ve arka figür YAN YANA (döndürme yok); erkek/kadın modeli gender prop'u seçer.
 * Kasa dokun → kas kendi renginde boyanır + isim rozeti çıkar → kısa gecikmeyle
 * Egzersizler ekranı o kas filtresiyle açılır (eski mascot köprüsüyle birebir aynı).
 * Eski 3D/PNG mascot (MascotFlipCard + assets/zones) yerine geçer.
 */
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Body from 'react-native-body-highlighter';
import { C } from '../utils/theme';
import { useMuscleFilter } from '../context/MuscleFilterContext';
import { useLang } from '../context/LanguageContext';
import { BODY_SLUG_FILTER, MUSCLE_LABEL, MUSCLE_COLOR } from '../data/exercises';

// react-native-body-highlighter slug → Egzersizler filtresi + etiket + renk.
// Kaynak: data/exercises.js BODY_SLUG_FILTER (kind: 'cat'|'muscle', value).
const MUSCLE_INFO = Object.fromEntries(
  Object.entries(BODY_SLUG_FILTER).map(([slug, f]) => [slug, {
    filterType: f.kind,
    value:      f.value,
    color:      MUSCLE_COLOR[slug] ?? C.lime,
    tr:         MUSCLE_LABEL[slug]?.tr ?? slug,
    en:         MUSCLE_LABEL[slug]?.en ?? slug,
  }])
);

// Kas olmayan bölgeler — dokunma kapalı (silüet olarak çizilir)
const DISABLED = ['head', 'hair', 'neck', 'hands', 'feet', 'ankles', 'knees', 'tibialis'];

const SW = Dimensions.get('window').width;

export default function BodyMap({ gender = 'male', style }) {
  const { lang }            = useLang();
  const { setMuscleFilter } = useMuscleFilter();
  const navigation          = useNavigation();

  const [sel, setSel]   = useState(null);    // { slug, info }
  const [side, setSide] = useState('front'); // döndür butonu ön↔arka çevirir
  const timer = useRef(null);

  // Tek figür — mobil ekranda büyük görünüm; paket tabanı 200×400/scale
  const scale = (SW * 0.62) / 200;

  const flip = () => {
    clearTimeout(timer.current);
    setSel(null);
    setSide(p => (p === 'front' ? 'back' : 'front'));
  };

  const onPress = (part) => {
    const info = MUSCLE_INFO[part.slug];
    if (!info) return;
    clearTimeout(timer.current);
    setSel({ slug: part.slug, info });
    timer.current = setTimeout(() => {
      setMuscleFilter({
        filterType: info.filterType,
        value:      info.value,
        label:      info.tr,
        labelEn:    info.en,
      });
      setSel(null);
      navigation.navigate('Egzersizler');
    }, 700);
  };

  const data = sel ? [{ slug: sel.slug, intensity: 1 }] : [];
  const bodyProps = {
    data,
    gender,
    scale,
    colors:             sel ? [sel.info.color] : [C.lime],
    onBodyPartPress:    onPress,
    disabledParts:      DISABLED,
    defaultFill:        '#232c42',                 // koyu tema kas dolgusu
    defaultStroke:      'rgba(148,170,214,0.55)',  // ince açık kontur
    defaultStrokeWidth: 1.2,
    border:             'none',
  };

  return (
    <View style={[bm.wrap, style]}>
      <Body {...bodyProps} side={side} />

      {/* Döndür butonu — ön ↔ arka */}
      <TouchableOpacity style={bm.flipBtn} onPress={flip} activeOpacity={0.75}>
        <Ionicons name="sync-outline" size={18} color={side === 'front' ? C.teal : C.orange} />
        <Text style={[bm.flipLbl, { color: side === 'front' ? C.teal : C.orange }]}>
          {side === 'front' ? (lang === 'tr' ? 'Arka' : 'Back') : (lang === 'tr' ? 'Ön' : 'Front')}
        </Text>
      </TouchableOpacity>

      {/* Seçilen kas rozeti */}
      {sel && (
        <View style={[bm.badge, { borderColor: sel.info.color }]} pointerEvents="none">
          <View style={[bm.dot, { backgroundColor: sel.info.color }]} />
          <Text style={[bm.badgeTxt, { color: sel.info.color }]}>
            {lang === 'tr' ? sel.info.tr : sel.info.en}
          </Text>
          <Ionicons name="arrow-forward" size={12} color={sel.info.color} />
        </View>
      )}

      {!sel && (
        <Text style={bm.hint}>
          {lang === 'tr' ? 'Bir kasa dokun → egzersizleri gör' : 'Tap a muscle → see its exercises'}
        </Text>
      )}
    </View>
  );
}

const bm = StyleSheet.create({
  wrap:   { alignItems: 'center', paddingVertical: 8 },
  flipBtn:{
    position: 'absolute', top: 8, right: 8,
    alignItems: 'center', gap: 3, padding: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8,
  },
  flipLbl:{ fontSize: 9, fontWeight: '700' },
  badge:  {
    position: 'absolute', bottom: 26, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(2,6,23,0.94)', borderRadius: 20,
    borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7,
  },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  badgeTxt: { fontSize: 13, fontWeight: '800' },
  hint:     { color: C.dim, fontSize: 11.5, marginTop: 8 },
});
