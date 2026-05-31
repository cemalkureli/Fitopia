/**
 * MascotFlipCard
 * - Front/back flip with animation
 * - Interactive muscle zone hotspots (glow on hover/tap)
 * - Tap muscle → filter exercises screen by that muscle group
 */
import React, { useRef, useState } from 'react';
import {
  View, Image, TouchableOpacity, Animated,
  StyleSheet, PanResponder, Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C } from '../utils/theme';
import { useMuscleFilter } from '../context/MuscleFilterContext';
import { useLang } from '../context/LanguageContext';
import { t } from '../utils/i18n';

// ── Images (user places these files) ─────────────────────────────────────────
let IMGS = { male_front: null, male_back: null, female_front: null, female_back: null };
try { IMGS.male_front   = require('../../assets/mascot_male/front.png');   } catch {}
try { IMGS.male_back    = require('../../assets/mascot_male/back.png');    } catch {}
try { IMGS.female_front = require('../../assets/mascot_female/front.png'); } catch {}
try { IMGS.female_back  = require('../../assets/mascot_female/back.png');  } catch {}

// ── Muscle zones (% of image width/height) ────────────────────────────────────
// Each zone: { id, label, cat (DB category), top%, left%, w%, h%, side: 'front'|'back' }
const ZONES_FRONT = [
  { id: 'chest',    label: 'Göğüs',   labelEn: 'Chest',     cat: 'Göğüs', top: 22, left: 25, w: 50, h: 14 },
  { id: 'shoulder', label: 'Omuz',    labelEn: 'Shoulder',  cat: 'Omuz',  top: 18, left: 10, w: 18, h: 10 },
  { id: 'shoulder2',label: 'Omuz',    labelEn: 'Shoulder',  cat: 'Omuz',  top: 18, left: 72, w: 18, h: 10 },
  { id: 'bicep_l',  label: 'Kol',     labelEn: 'Arms',      cat: 'Kol',   top: 30, left:  8, w: 14, h: 18 },
  { id: 'bicep_r',  label: 'Kol',     labelEn: 'Arms',      cat: 'Kol',   top: 30, left: 78, w: 14, h: 18 },
  { id: 'forearm_l',label: 'Kol',     labelEn: 'Arms',      cat: 'Kol',   top: 47, left:  5, w: 12, h: 14 },
  { id: 'forearm_r',label: 'Kol',     labelEn: 'Arms',      cat: 'Kol',   top: 47, left: 83, w: 12, h: 14 },
  { id: 'abs',      label: 'Core',    labelEn: 'Abs',       cat: 'Core',  top: 35, left: 28, w: 44, h: 18 },
  { id: 'quad_l',   label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 54, left: 18, w: 24, h: 20 },
  { id: 'quad_r',   label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 54, left: 58, w: 24, h: 20 },
  { id: 'calf_l',   label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 76, left: 20, w: 18, h: 14 },
  { id: 'calf_r',   label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 76, left: 62, w: 18, h: 14 },
];

const ZONES_BACK = [
  { id: 'trap',     label: 'Sırt',    labelEn: 'Back',      cat: 'Sırt',  top: 18, left: 28, w: 44, h: 12 },
  { id: 'lat_l',    label: 'Sırt',    labelEn: 'Back',      cat: 'Sırt',  top: 28, left: 14, w: 22, h: 22 },
  { id: 'lat_r',    label: 'Sırt',    labelEn: 'Back',      cat: 'Sırt',  top: 28, left: 64, w: 22, h: 22 },
  { id: 'lspine',   label: 'Sırt',    labelEn: 'Back',      cat: 'Sırt',  top: 35, left: 36, w: 28, h: 14 },
  { id: 'tri_l',    label: 'Kol',     labelEn: 'Arms',      cat: 'Kol',   top: 30, left:  8, w: 13, h: 16 },
  { id: 'tri_r',    label: 'Kol',     labelEn: 'Arms',      cat: 'Kol',   top: 30, left: 79, w: 13, h: 16 },
  { id: 'glute_l',  label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 50, left: 22, w: 24, h: 14 },
  { id: 'glute_r',  label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 50, left: 54, w: 24, h: 14 },
  { id: 'ham_l',    label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 60, left: 20, w: 20, h: 18 },
  { id: 'ham_r',    label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 60, left: 60, w: 20, h: 18 },
  { id: 'calf_bl',  label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 76, left: 22, w: 16, h: 13 },
  { id: 'calf_br',  label: 'Bacak',   labelEn: 'Legs',      cat: 'Bacak', top: 76, left: 62, w: 16, h: 13 },
];

// Unique selectable muscles for tooltip (by cat)
const CAT_COLORS = {
  'Göğüs': '#ef4444', 'Omuz': '#f97316', 'Kol': '#a78bfa',
  'Core': '#4ade80', 'Bacak': '#38bdf8', 'Sırt': '#fb7185',
};

// ── Animated zone overlay ─────────────────────────────────────────────────────
function MuscleZone({ zone, imgW, imgH, onPress, isActive }) {
  const glow = useRef(new Animated.Value(0)).current;
  const col  = CAT_COLORS[zone.cat] ?? '#dc2626';

  React.useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.4, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.timing(glow, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isActive]);

  const top  = (zone.top  / 100) * imgH;
  const left = (zone.left / 100) * imgW;
  const w    = (zone.w    / 100) * imgW;
  const h    = (zone.h    / 100) * imgH;

  return (
    <TouchableOpacity
      style={[ss.zone, { top, left, width: w, height: h }]}
      onPress={() => onPress(zone)}
      activeOpacity={0.7}
    >
      <Animated.View style={[
        ss.zoneGlow,
        {
          backgroundColor: col,
          opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
          borderColor: col,
          borderWidth: isActive ? 1.5 : 0,
        }
      ]} />
    </TouchableOpacity>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MascotFlipCard({ gender = 'female', width = 260, height = 420, style }) {
  const { lang }                          = useLang();
  const { setMuscleFilter }               = useMuscleFilter();
  const navigation                        = useNavigation();
  const [showFront, setShowFront]         = useState(true);
  const [activeZone, setActiveZone]       = useState(null);
  const [tooltip, setTooltip]             = useState(null); // { label, labelEn, cat }
  const flipAnim                          = useRef(new Animated.Value(0)).current;
  const isFlipping                        = useRef(false);
  const tooltipTimer                      = useRef(null);

  const zones = showFront ? ZONES_FRONT : ZONES_BACK;

  const flip = () => {
    if (isFlipping.current) return;
    isFlipping.current = true;
    setActiveZone(null); setTooltip(null);
    Animated.sequence([
      Animated.timing(flipAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(flipAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => { isFlipping.current = false; });
    setTimeout(() => setShowFront(p => !p), 180);
  };

  const handleZoneTap = (zone) => {
    // Highlight zone
    setActiveZone(zone.id);
    // Show tooltip
    setTooltip({ label: zone.label, labelEn: zone.labelEn, cat: zone.cat });
    clearTimeout(tooltipTimer.current);
    // After 600ms, navigate to exercises with filter
    tooltipTimer.current = setTimeout(() => {
      setMuscleFilter({ cat: zone.cat, label: zone.label, labelEn: zone.labelEn });
      setActiveZone(null); setTooltip(null);
      navigation.navigate('Egzersizler');
    }, 600);
  };

  const scaleX = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const frontSrc = gender === 'male' ? IMGS.male_front   : IMGS.female_front;
  const backSrc  = gender === 'male' ? IMGS.male_back    : IMGS.female_back;
  const src      = showFront ? frontSrc : backSrc;

  // Image area dimensions for zone calculations
  const imgW = width;
  const imgH = height;

  return (
    <View style={[ss.wrap, { width, height }, style]}>
      {/* Flip image */}
      <TouchableOpacity activeOpacity={0.95} onPress={() => { setActiveZone(null); setTooltip(null); }} style={{ flex: 1 }}>
        <Animated.View style={[ss.imgWrap, { transform: [{ scaleX }] }]}>
          {src ? (
            <Image source={src} style={[ss.img, { width: imgW, height: imgH }]} resizeMode="contain" />
          ) : (
            <View style={[ss.placeholder, { width: imgW, height: imgH }]} />
          )}

          {/* Muscle zone hotspots */}
          {zones.map(zone => (
            <MuscleZone
              key={zone.id}
              zone={zone}
              imgW={imgW}
              imgH={imgH}
              isActive={activeZone === zone.id}
              onPress={handleZoneTap}
            />
          ))}
        </Animated.View>
      </TouchableOpacity>

      {/* Tooltip */}
      {tooltip && (
        <Animated.View style={[ss.tooltip, { borderColor: CAT_COLORS[tooltip.cat] }]}>
          <View style={[ss.tooltipDot, { backgroundColor: CAT_COLORS[tooltip.cat] }]} />
          <Text style={[ss.tooltipTxt, { color: CAT_COLORS[tooltip.cat] }]}>
            {lang === 'tr' ? tooltip.label : tooltip.labelEn}
          </Text>
          <Ionicons name="arrow-forward" size={12} color={CAT_COLORS[tooltip.cat]} />
        </Animated.View>
      )}

      {/* Rotate button */}
      <View style={ss.rotateBtn}>
        <TouchableOpacity onPress={flip} style={ss.rotateTouchable} activeOpacity={0.75}>
          <Ionicons name="sync-outline" size={22} color={showFront ? C.teal : C.orange} />
          <Text style={[ss.rotateLbl, { color: showFront ? C.teal : C.orange }]}>
            {showFront ? (lang === 'tr' ? 'Arka' : 'Back') : (lang === 'tr' ? 'Ön' : 'Front')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  wrap:          { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  imgWrap:       { flex: 1, position: 'relative' },
  img:           {},
  placeholder:   { backgroundColor: C.s2, borderRadius: 16 },
  zone:          { position: 'absolute', borderRadius: 8, overflow: 'hidden' },
  zoneGlow:      { ...StyleSheet.absoluteFillObject, borderRadius: 8 },
  tooltip:       {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(2,6,23,0.92)', borderRadius: 20,
    borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7,
  },
  tooltipDot:    { width: 8, height: 8, borderRadius: 4 },
  tooltipTxt:    { fontSize: 13, fontWeight: '700' },
  rotateBtn:     { width: 44, alignItems: 'center', justifyContent: 'center' },
  rotateTouchable:{ alignItems: 'center', gap: 4, padding: 8 },
  rotateLbl:     { fontSize: 9, fontWeight: '700' },
});
