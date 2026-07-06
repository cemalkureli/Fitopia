/**
 * AICoachScreen — Kişiselleştirilmiş AI Fitness Koçu
 * 22 adımlı değerlendirme sihirbazı. Dark theme, Fitopia renk sistemi.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedRN, { FadeInDown, FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C } from '../utils/theme';
import { supabase } from '../lib/supabase';
import { useLang } from '../context/LanguageContext';
import { useUnits } from '../context/UnitsContext';
import RulerPicker from '../components/RulerPicker';
import WheelPicker from '../components/WheelPicker';
import YearDigitPicker from '../components/YearDigitPicker';
import SyncedUnitField from '../components/SyncedUnitField';
import HeightField from '../components/HeightField';

const { width: SW } = Dimensions.get('window');

// ─── Adım sırası ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'welcome' },
  { id: 'gender',         cat: 1 },
  { id: 'goal',           cat: 1 },
  { id: 'motivation',     cat: 1 },
  { id: 'focus',          cat: 1 },
  { id: 'birth_year',     cat: 2 },
  { id: 'height',         cat: 2 },
  { id: 'weight',         cat: 2 },
  { id: 'target_weight',  cat: 2 },
  { id: 'body_shape',     cat: 2 },
  { id: 'occupation',     cat: 3 },
  { id: 'workout_place',  cat: 3 },
  { id: 'ex_type',        cat: 3 },
  { id: 'prefs',          cat: 3 },
  { id: 'injury',         cat: 3 },
  { id: 'activity',       cat: 3 },
  { id: 'frequency',      cat: 3 },
  { id: 'level',          cat: 3 },
  { id: 'pushups',        cat: 3 },
  { id: 'running',        cat: 3 },
  { id: 'comparison' },
  { id: 'generating' },
  { id: 'result' },
];

const CAT_LABELS = {
  1: { tr: 'HEDEF & ODAK',        en: 'GOAL & FOCUS'       },
  2: { tr: 'VÜCUDUNUz HAKKINDA', en: 'ABOUT YOUR BODY'    },
  3: { tr: 'FİTNESS DEĞERLENDİRME', en: 'FITNESS ASSESSMENT' },
};

// Koç hedefi → Şablonlar (Templates) hedef filtresi eşlemesi.
// Böylece "Planımı Al" Egzersizler→Şablonlar sekmesini seçilen hedefe göre filtreler.
const GOAL_TO_PLAN = { lose_weight: 'fat_loss', build_muscle: 'bodybuilding', keep_fit: 'general_fitness' };

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
function bmi(w, h) { return h > 0 ? (w / ((h / 100) ** 2)).toFixed(1) : null; }
function bmiInfo(v, lang) {
  const n = parseFloat(v);
  if (n < 18.5) return [lang === 'tr' ? 'Zayıf'         : 'Underweight',   C.blue,   lang === 'tr' ? 'Kilo almak faydalı olabilir.' : 'Gaining some weight may be beneficial.'];
  if (n < 25)   return [lang === 'tr' ? 'Normal'         : 'Normal',        C.lime,   lang === 'tr' ? 'Harika bir rakam! Böyle devam et.' : 'Great figure! Keep it up.'];
  if (n < 30)   return [lang === 'tr' ? 'Fazla Kilolu'   : 'Overweight',    C.orange, lang === 'tr' ? 'Biraz kilo vermek sağlığını iyileştirir.' : 'Losing some weight will improve your health.'];
  return          [lang === 'tr' ? 'Obez'            : 'Obese',         C.red,    lang === 'tr' ? 'Sağlıklı kilo hedeflenmeli.' : 'Healthy weight should be targeted.'];
}
function projDays(cur, tgt, freq) {
  const diff = Math.abs(cur - tgt);
  if (diff < 0.1) return 14;
  return Math.round((diff / (0.25 + (freq - 1) * 0.08)) * 7);
}
function addDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return d;
}
function fmtDate(d, lang) {
  return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' });
}

// Aralık sabitleri
const YEAR_MIN = 1950, YEAR_MAX = 2015;
const H_MIN = 120, H_MAX = 220;   // cm
const W_MIN = 30,  W_MAX = 200;   // kg
const FREQ_MIN = 1, FREQ_MAX = 7;

// Kilo+boy → BMI → vücut şekli indeksi (0 çok ince … 5 obez). Kullanıcı seçmez,
// girdiği verilerden türetilir.
function deriveShape(kg, cm) {
  const b = cm > 0 ? kg / ((cm / 100) ** 2) : 22;
  if (b < 18.5) return 0;
  if (b < 21)   return 1;
  if (b < 25)   return 2;
  if (b < 27.5) return 3;
  if (b < 30)   return 4;
  return 5;
}

// Birim dönüşümleri (SyncedUnitField için)
const HEIGHT_UNITS = [
  { key: 'cm', label: 'cm', toBase: x => x,          fromBase: b => String(Math.round(b)) },
  { key: 'ft', label: 'ft', toBase: x => x * 30.48,  fromBase: b => (b / 30.48).toFixed(2) },
];
const WEIGHT_UNITS = [
  { key: 'kg', label: 'kg', toBase: x => x,           fromBase: b => (Math.round(b * 2) / 2).toString() },
  { key: 'lb', label: 'lb', toBase: x => x / 2.20462, fromBase: b => (b * 2.20462).toFixed(1) },
];
const roundHalf = v => Math.round(v * 2) / 2;

// ─── Küçük bileşenler ─────────────────────────────────────────────────────────

// Progress header
function StepHeader({ step, onBack, lang }) {
  const cat = step.cat;
  return (
    <View style={s.hdr}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top:12,bottom:12,left:12,right:12 }} style={s.hdrBack}>
        <Ionicons name="arrow-back" size={22} color={C.text} />
      </TouchableOpacity>
      <View style={s.hdrCenter}>
        <Text style={s.hdrCatN}>0{cat}</Text>
        <Text style={s.hdrCatL}>{CAT_LABELS[cat]?.[lang]}</Text>
      </View>
      <View style={s.hdrBars}>
        {[1,2,3].map(n => (
          <View key={n} style={s.hdrBarSeg}>
            <View style={[s.hdrBarFill, { flex: n <= cat ? 1 : 0 }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

// NEXT button
function NextBtn({ onPress, disabled, label }) {
  return (
    <View style={s.nextWrap}>
      <TouchableOpacity onPress={onPress} disabled={!!disabled} activeOpacity={0.85}>
        <LinearGradient colors={disabled ? [C.s2,C.s2] : ['#e8f44a','#a3c200']} style={s.nextBtn}>
          <Text style={[s.nextTxt, disabled && { color: C.dim }]}>{label ?? 'NEXT'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// Seçenek satırı
function OptionRow({ label, sublabel, icon, selected, onPress, color, multi }) {
  const c = color ?? C.lime;
  return (
    <TouchableOpacity
      style={[s.optRow, selected && { borderColor: c, backgroundColor: c + '14' }]}
      onPress={onPress} activeOpacity={0.8}
    >
      {icon && <Ionicons name={icon} size={20} color={selected ? c : C.muted} style={{ marginRight: 12 }} />}
      <View style={{ flex: 1 }}>
        <Text style={[s.optLbl, selected && { color: c, fontWeight: '800' }]}>{label}</Text>
        {sublabel ? <Text style={s.optSub}>{sublabel}</Text> : null}
      </View>
      <View style={[s.optCheck, selected && { backgroundColor: c, borderColor: c }]}>
        {selected && <Ionicons name={multi ? 'checkmark' : 'checkmark'} size={12} color="#000" />}
      </View>
    </TouchableOpacity>
  );
}

// Büyük hedef kartı
function GoalCard({ label, icon, color, selected, onPress, tip }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ marginBottom: 10 }}>
      <LinearGradient
        colors={selected ? [color + 'DD', color + '88'] : [C.s1, C.s1]}
        style={[s.goalCard, selected && { borderColor: color }]}
      >
        <Ionicons name={icon} size={36} color={selected ? '#fff' : color} />
        <Text style={[s.goalLbl, selected && { color: '#fff' }]}>{label}</Text>
        {selected && tip ? (
          <AnimatedRN.View entering={FadeIn.duration(250)} style={s.goalTip}>
            <Text style={s.goalTipTxt}>{tip}</Text>
          </AnimatedRN.View>
        ) : null}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Vücut şekli slider
const SHAPES = [
  { k: 0, icon: 'body', color: '#06b6d4' },
  { k: 1, icon: 'body', color: '#4ade80' },
  { k: 2, icon: 'body', color: C.lime   },
  { k: 3, icon: 'body', color: C.orange },
  { k: 4, icon: 'body', color: '#f97316'},
  { k: 5, icon: 'body', color: C.red    },
];
const SHAPE_LBL = {
  0: { tr:'Çok İnce',     en:'Very Cut'     },
  1: { tr:'İnce',         en:'Cut'          },
  2: { tr:'Normal',       en:'Normal'       },
  3: { tr:'Dolgun',       en:'Slightly Plump'},
  4: { tr:'Kilolu',       en:'Plump'        },
  5: { tr:'Obez',         en:'Obese'        },
};
// Aktivite slider
const ACT_OPTS = [
  { icon: 'desktop-outline',  tr: 'Hareketsiz',  en: 'Sedentary',   desc_tr: 'Gün boyu masada oturuyorum',            desc_en: 'I sit at my desk all day'                    },
  { icon: 'walk-outline',     tr: 'Az Aktif',    en: 'Low Active',  desc_tr: 'Ara sıra 30 dk yürüyüş yapıyorum',       desc_en: 'I occasionally exercise or walk 30 minutes'  },
  { icon: 'bicycle-outline',  tr: 'Orta Aktif',  en: 'Moderate',    desc_tr: 'Günde 1 saat antrenman yapıyorum',        desc_en: 'I spend an hour working out every day'       },
  { icon: 'barbell-outline',  tr: 'Aktif',       en: 'Active',      desc_tr: 'Yoğun antrenman yapmayı seviyorum',       desc_en: 'I love working out and want more exercises'  },
];

// Projeksiyon grafiği
function ProjectionChart({ curKg, tgtKg, days, lang }) {
  const lose   = curKg > tgtKg;
  const diff   = Math.abs(curKg - tgtKg).toFixed(1);
  const endDate = addDays(days);
  const segs    = 8;
  const pts     = Array.from({ length: segs }, (_, i) => {
    const t = i / (segs - 1);
    return lose ? 1 - t * 0.82 : 0.18 + t * 0.82;
  });
  return (
    <View style={s.chart}>
      <Text style={s.chartTitle}>{lang === 'tr' ? 'Hedef Tahmini' : 'Goal Projection'}</Text>
      <View style={s.chartKgRow}>
        <Text style={s.chartCur}>{curKg} kg</Text>
        <Ionicons name="arrow-forward" size={16} color={C.dim} />
        <Text style={[s.chartTgt, { color: C.lime }]}>{tgtKg} kg</Text>
      </View>
      <View style={s.chartBars}>
        {pts.map((h2, i) => (
          <View key={i} style={s.chartBarCol}>
            <LinearGradient
              colors={i === segs-1 ? [C.lime,'#a3c200'] : [C.teal+'99',C.blue+'33']}
              style={[s.chartBar, { height: `${h2 * 100}%` }]}
            />
          </View>
        ))}
      </View>
      <View style={s.chartDates}>
        <Text style={s.chartDate}>{lang === 'tr' ? 'Bugün' : 'Today'}</Text>
        <Text style={[s.chartDate, { color: C.lime, fontWeight: '800' }]}>{fmtDate(endDate, lang)}</Text>
      </View>
      <View style={s.chartInfo}>
        <Ionicons name="checkmark-circle" size={18} color={C.lime} />
        <Text style={s.chartInfoTxt}>
          {diff} kg {lose ? (lang === 'tr' ? 'kayıp' : 'loss') : (lang === 'tr' ? 'kazanım' : 'gain')}
          {' — '}{days} {lang === 'tr' ? 'gün' : 'days'}
        </Text>
      </View>
    </View>
  );
}

// Plan kartı
function PlanCard({ answers, lang }) {
  const w   = answers.weight;
  const h2  = answers.height;
  const b   = bmi(w, h2);
  const [bLabel, bColor, bDesc] = b ? bmiInfo(b, lang) : ['—', C.muted, ''];
  const GOAL_LBL = { lose_weight: lang==='tr'?'Kilo Ver':'Lose Weight', build_muscle: lang==='tr'?'Kas Kazan':'Build Muscle', keep_fit: lang==='tr'?'Formda Kal':'Keep Fit' };
  const LVL_LBL  = { beginner: lang==='tr'?'Başlangıç':'Beginner', intermediate: lang==='tr'?'Orta':'Intermediate', advanced: lang==='tr'?'İleri':'Advanced' };
  const FOCUS_LBL = { full_body:'Full Body', chest:lang==='tr'?'Göğüs':'Chest', back:lang==='tr'?'Sırt':'Back', arms:lang==='tr'?'Kollar':'Arms', legs:lang==='tr'?'Bacaklar':'Legs', core:'Core' };
  // Çoklu odak: 2 etiket + "+N" (taşmayı önle)
  const fa = answers.focusAreas ?? [];
  const focusVal = fa.length === 0 ? '—'
    : fa.slice(0, 2).map(k => FOCUS_LBL[k] ?? k).join(' · ') + (fa.length > 2 ? ` +${fa.length - 2}` : '');
  const items = [
    { icon:'barbell-outline', lbl: lang==='tr'?'Antrenman':'Training', val: `${answers.workoutFreq}×/` + (lang==='tr'?'hafta':'week') },
    { icon:'flame-outline',   lbl: lang==='tr'?'Seviye':'Level',       val: LVL_LBL[answers.fitnessLevel] ?? '—' },
    { icon:'body-outline',    lbl: lang==='tr'?'Odak':'Focus',         val: focusVal },
    { icon:'trophy-outline',  lbl: lang==='tr'?'Hedef':'Goal',         val: GOAL_LBL[answers.goal] ?? '—' },
  ];
  const extras = [
    answers.warmup   && (lang==='tr'?'Isınma dahil':'Warm-up included'),
    answers.cooldown && (lang==='tr'?'Esneme dahil':'Stretching included'),
  ].filter(Boolean);
  return (
    <View style={s.planCard}>
      <Text style={s.planTitle}>{lang === 'tr' ? 'Plan Özeti' : 'Plan Summary'}</Text>
      <View style={s.planGrid}>
        {items.map((it, i) => (
          <View key={i} style={s.planItem}>
            <Ionicons name={it.icon} size={20} color={C.lime} />
            <Text style={s.planVal}>{it.val}</Text>
            <Text style={s.planLbl}>{it.lbl}</Text>
          </View>
        ))}
      </View>
      {extras.length > 0 && (
        <View style={s.planExtras}>
          {extras.map((e, i) => (
            <View key={i} style={s.planExtraChip}>
              <Ionicons name="checkmark" size={12} color={C.lime} />
              <Text style={s.planExtraTxt}>{e}</Text>
            </View>
          ))}
        </View>
      )}
      {b && (
        <View style={[s.planBmi, { borderColor: bColor + '44' }]}>
          <Text style={[s.planBmiVal, { color: bColor }]}>BMI {b}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.planBmiLbl, { color: bColor }]}>{bLabel}</Text>
            <Text style={s.planBmiDesc}>{bDesc}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// Güç projeksiyonu — seviyeye göre 12 haftalık tahmini artış (yükselen bar şeridi)
function StrengthCard({ level, lang }) {
  const gain = level === 'beginner' ? 35 : level === 'advanced' ? 15 : 25;
  const bars = Array.from({ length: 8 }, (_, i) => (i + 1) / 8);
  return (
    <View style={s.planCard}>
      <Text style={s.planTitle}>{lang==='tr'?'Güç Projeksiyonu':'Strength Projection'}</Text>
      <View style={s.strengthRow}>
        <View style={s.strengthBars}>
          {bars.map((f, i) => (
            <View key={i} style={[s.strengthBar, {
              height: 14 + f * 42,
              backgroundColor: i === bars.length - 1 ? C.lime : C.teal + 'AA',
            }]} />
          ))}
        </View>
        <View style={s.strengthInfo}>
          <Text style={s.strengthPct}>+{gain}%</Text>
          <Text style={s.strengthLbl}>{lang==='tr'?'ilk 12 haftada\ntahmini güç artışı':'estimated strength gain\nin first 12 weeks'}</Text>
        </View>
      </View>
    </View>
  );
}

// Beslenme hedefleri — Mifflin-St Jeor + hedefe göre kalori & protein
function NutritionCard({ answers, lang }) {
  const { gender, weight, height, birthYear, activityLevel, goal } = answers;
  const age = new Date().getFullYear() - (birthYear || 1995);
  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'female' ? -161 : 5);
  const tdee = bmr * (1.3 + 0.125 * (activityLevel ?? 1));               // hareketsiz→aktif
  const kcal = Math.round((tdee + (goal === 'lose_weight' ? -400 : goal === 'build_muscle' ? 300 : 0)) / 10) * 10;
  const protein = Math.round(weight * (goal === 'build_muscle' ? 1.8 : goal === 'lose_weight' ? 2.0 : 1.6));
  const water = Math.round(weight * 0.035 * 10) / 10; // litre
  const items = [
    { icon:'flame',          val:`${kcal}`,     unit:'kcal',              lbl: lang==='tr'?'Günlük Kalori':'Daily Calories', col:C.orange },
    { icon:'egg',            val:`${protein}g`, unit:'',                  lbl: lang==='tr'?'Protein':'Protein',              col:C.lime   },
    { icon:'water',          val:`${water}L`,   unit:'',                  lbl: lang==='tr'?'Su':'Water',                     col:C.blue   },
  ];
  return (
    <View style={s.planCard}>
      <Text style={s.planTitle}>{lang==='tr'?'Beslenme Hedeflerin':'Your Nutrition Targets'}</Text>
      <View style={s.planGrid}>
        {items.map((it, i) => (
          <View key={i} style={[s.planItem, { flexBasis: '30%' }]}>
            <Ionicons name={it.icon} size={20} color={it.col} />
            <Text style={[s.planVal, { color: it.col }]}>{it.val}</Text>
            <Text style={s.planLbl}>{it.lbl}</Text>
          </View>
        ))}
      </View>
      <Text style={s.nutriNote}>
        {lang==='tr'
          ? 'Hedefine göre hesaplandı — yaklaşık değerlerdir.'
          : 'Calculated for your goal — approximate values.'}
      </Text>
    </View>
  );
}

// Diğer planlar vs bizim plan karşılaştırması
function PlanComparison({ lang }) {
  const theirs = lang==='tr'
    ? ['Yavaş Sonuç', 'Uygunsuz', 'Kolay Bozulur', 'Sınırlı Destek']
    : ['Slow Effects', 'Not Suitable', 'Easy to Rebound', 'Limited Support'];
  const ours = lang==='tr'
    ? ['Hızlı Değişim', 'Sana Özel', 'Kalıcı Sonuç', 'Takip Kolaylığı']
    : ['Faster Changes', 'Fit You Perfectly', 'Lasting Results', 'Easy to Follow'];
  return (
    <View style={s.cmpRow}>
      <View style={[s.cmpCard, { backgroundColor: C.s2, borderColor: C.border }]}>
        <Text style={s.cmpLbl}>{lang==='tr'?'Diğer Planlar':'Other Plans'}</Text>
        {theirs.map((t,i) => (
          <View key={i} style={s.cmpItem}>
            <Ionicons name="close" size={14} color={C.red} />
            <Text style={s.cmpTxt}>{t}</Text>
          </View>
        ))}
      </View>
      <LinearGradient colors={['rgba(232,244,74,0.16)','rgba(232,244,74,0.04)']} style={[s.cmpCard, { borderColor: C.lime }]}>
        <Text style={[s.cmpLbl, { color: C.lime }]}>{lang==='tr'?'Planımız':'Our Plan'}</Text>
        {ours.map((t,i) => (
          <View key={i} style={s.cmpItem}>
            <Ionicons name="checkmark-circle" size={14} color={C.lime} />
            <Text style={[s.cmpTxt, { color: C.text }]}>{t}</Text>
          </View>
        ))}
      </LinearGradient>
    </View>
  );
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────
export default function AICoachScreen({ navigation }) {
  const { lang } = useLang();
  const { weightUnit, lengthUnit } = useUnits();
  const [stepIdx, setStepIdx] = useState(0);
  const [saving,  setSaving]  = useState(false);
  const [userId,  setUserId]  = useState(null);
  const [hasProfile, setHasProfile] = useState(false);

  // Manuel giriş geçerlilik durumu (aralık dışı → NEXT bloklanır)
  const [invalidSteps, setInvalidSteps] = useState({});
  const setStepInvalid = (id, bad) => setInvalidSteps(prev => (prev[id] === bad ? prev : { ...prev, [id]: bad }));

  // Yıl için "taslak" (digit spinner), wheel'i süren committed değerden ayrı
  const [yearDraft, setYearDraft] = useState(1995);

  // Aktif giriş birimleri (ayarlardaki tercihe göre başlar)
  const [heightUnit, setHeightUnit] = useState(lengthUnit === 'cm' ? 'cm' : 'ft');
  const [weightUnitSel, setWeightUnitSel] = useState(weightUnit === 'kg' ? 'kg' : 'lb');
  const [tgtUnitSel, setTgtUnitSel] = useState(weightUnit === 'kg' ? 'kg' : 'lb');

  const [a, setA] = useState({  // answers
    gender:          null,
    goal:            null,
    motivation:      [],
    focusAreas:      [],   // çoklu odak bölge (full_body diğerlerini dışlar)
    warmup:          true, // ısınma rutini planına dahil
    cooldown:        true, // soğuma/esneme dahil
    birthYear:       1995,
    height:          175,
    weight:          75,
    targetWeight:    70,
    bodyShape:       2,
    targetBodyShape: 1,
    occupation:      null,
    workoutPlace:    null,
    exType:          null,
    injury:          [],
    activityLevel:   1,
    workoutFreq:     3,
    fitnessLevel:    'intermediate',
    pushups:         null,
    running:         null,
  });

  const set = (k, v) => setA(prev => ({ ...prev, [k]: v }));
  const toggleArr = (k, v) => setA(prev => ({
    ...prev,
    [k]: prev[k].includes(v) ? prev[k].filter(x => x !== v) : [...prev[k], v],
  }));

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      setUserId(data.user.id);
      supabase.from('ai_profiles').select('*').eq('id', data.user.id).single()
        .then(({ data: p }) => {
          if (!p?.completed_at) return;
          setHasProfile(true);
          setA(prev => ({
            ...prev,
            gender:         p.gender ?? prev.gender,
            goal:           p.goal ?? prev.goal,
            focusAreas:     p.focus_area ? [p.focus_area] : prev.focusAreas,
            height:         p.height_cm ?? prev.height,
            weight:         p.weight_kg ?? prev.weight,
            targetWeight:   p.target_weight_kg ?? prev.targetWeight,
            bodyShape:      p.body_shape ?? prev.bodyShape,
            targetBodyShape:p.target_body_shape ?? prev.targetBodyShape,
            activityLevel:  p.activity_level ?? prev.activityLevel,
            workoutFreq:    p.workout_freq ?? prev.workoutFreq,
            fitnessLevel:   p.fitness_level ?? prev.fitnessLevel,
          }));
          setStepIdx(STEPS.findIndex(s => s.id === 'result'));
        });
      // Supabase kolonu olmayan tercihleri (çoklu odak, ısınma/soğuma) lokalden yükle
      AsyncStorage.getItem(`coach_prefs_${data.user.id}`).then(raw => {
        if (!raw) return;
        try {
          const p = JSON.parse(raw);
          setA(prev => ({
            ...prev,
            focusAreas: p.focusAreas?.length ? p.focusAreas : prev.focusAreas,
            warmup:     p.warmup   ?? prev.warmup,
            cooldown:   p.cooldown ?? prev.cooldown,
          }));
        } catch {}
      });
    });
  }, []));

  const step = STEPS[stepIdx];

  const canNext = () => {
    switch (step?.id) {
      case 'gender':       return !!a.gender;
      case 'goal':         return !!a.goal;
      case 'motivation':   return a.motivation.length > 0;
      case 'focus':        return a.focusAreas.length > 0;
      case 'birth_year':   return !invalidSteps.birth_year && yearDraft >= YEAR_MIN && yearDraft <= YEAR_MAX;
      case 'height':       return !invalidSteps.height;
      case 'weight':       return !invalidSteps.weight;
      case 'target_weight':return !invalidSteps.target_weight;
      case 'occupation':   return !!a.occupation;
      case 'workout_place':return !!a.workoutPlace;
      case 'ex_type':      return !!a.exType;
      case 'pushups':      return !!a.pushups;
      case 'running':      return !!a.running;
      default: return true;
    }
  };

  const goNext = async () => {
    if (step.id === 'running') {
      setSaving(true);
      setStepIdx(s => s + 1); // comparison
    } else if (step.id === 'comparison') {
      setStepIdx(s => s + 1); // generating
      await saveProfile();
      await new Promise(r => setTimeout(r, 2500));
      setStepIdx(STEPS.findIndex(s => s.id === 'result'));
      setSaving(false);
    } else {
      setStepIdx(s => s + 1);
    }
  };

  const goBack = () => { if (stepIdx > 0) setStepIdx(s => s - 1); };

  const saveProfile = async () => {
    if (!userId) return;
    await supabase.from('ai_profiles').upsert({
      id:                userId,
      gender:            a.gender,
      goal:              a.goal,
      focus_area:        a.focusAreas[0] ?? null, // Supabase kolonu tekli; birincil odak

      height_cm:         a.height,
      weight_kg:         a.weight,
      target_weight_kg:  a.targetWeight,
      body_shape:        deriveShape(a.weight, a.height),
      target_body_shape: deriveShape(a.targetWeight, a.height),
      activity_level:    a.activityLevel,
      workout_freq:      a.workoutFreq,
      fitness_level:     a.fitnessLevel,
      motivation:        a.motivation,
      injury_areas:      a.injury,
      completed_at:      new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    });
    // Ek tercihler (Supabase kolonu yok) — lokal, cihazda kalıcı
    await AsyncStorage.setItem(`coach_prefs_${userId}`, JSON.stringify({
      focusAreas: a.focusAreas, warmup: a.warmup, cooldown: a.cooldown,
    })).catch(() => {});
    setHasProfile(true);
  };

  // ─── Adım render ────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step?.id) {

      // 0. Welcome
      case 'welcome': return (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <AnimatedRN.View entering={FadeIn.duration(500)} style={s.welcomeWrap}>
            <LinearGradient colors={[C.lime+'22', C.lime+'06']} style={s.coachCircle}>
              <Ionicons name="medal" size={52} color={C.lime} />
            </LinearGradient>
            <Text style={s.welcomeHi}>{lang==='tr'?'Merhaba!':'Hello!'}</Text>
            <Text style={s.welcomeDesc}>
              {lang==='tr'
                ? 'Kişisel antrenörünüzüm.\nSize özel plan için\nbir kaç soru soracağım.'
                : "I'm your personal coach.\nA few questions to build\nyour personalized plan."}
            </Text>
            {hasProfile && (
              <TouchableOpacity
                onPress={() => setStepIdx(STEPS.findIndex(s2=>s2.id==='result'))}
                style={s.existingBtn}
              >
                <Ionicons name="checkmark-circle" size={16} color={C.lime} />
                <Text style={s.existingTxt}>{lang==='tr'?'Mevcut planı görüntüle':'View existing plan'}</Text>
              </TouchableOpacity>
            )}
          </AnimatedRN.View>
          <View style={{ padding: 16 }}>
            <TouchableOpacity onPress={goNext} activeOpacity={0.85}>
              <LinearGradient colors={['#e8f44a','#a3c200']} style={s.readyBtn}>
                <Text style={s.readyTxt}>{lang==='tr'?"Hazırım →":"I'm Ready →"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );

      // 1. Cinsiyet
      case 'gender': return (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.q}>{lang==='tr'?'Cinsiyetiniz?':"What's your gender?"}</Text>
          <Text style={s.qsub}>{lang==='tr'?'Sizi daha iyi tanıyalım':'Let us know you better'}</Text>
          <View style={s.genderRow}>
            {[
              { k:'male',   lbl: lang==='tr'?'Erkek':'Male',   icon:'man',   col: C.blue },
              { k:'female', lbl: lang==='tr'?'Kadın':'Female', icon:'woman', col:'#f97316' },
            ].map(g => (
              <TouchableOpacity key={g.k} style={[s.genderCard, a.gender===g.k&&{borderColor:g.col,backgroundColor:g.col+'18'}]} onPress={()=>set('gender',g.k)} activeOpacity={0.8}>
                {a.gender===g.k && <Ionicons name="checkmark-circle" size={20} color={g.col} style={s.genderCheck}/>}
                <Ionicons name={g.icon} size={56} color={a.gender===g.k?g.col:C.dim} />
                <Text style={[s.genderLbl, a.gender===g.k&&{color:g.col,fontWeight:'800'}]}>{g.lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={()=>{set('gender','other');setStepIdx(s=>s+1);}} style={s.otherBtn}>
            <Text style={s.otherTxt}>{lang==='tr'?'Diğer / Belirtmek istemiyorum':"Others / I'd rather not say"}</Text>
          </TouchableOpacity>
        </ScrollView>
      );

      // 2. Hedef
      case 'goal': {
        const goals = [
          { k:'lose_weight',  lbl:lang==='tr'?'Kilo Ver':'Lose Weight',  icon:'flame-outline',   col:C.orange, tip:lang==='tr'?'🔥 Daha sağlıklı, daha hafif bir sen!':'🔥 Slim & fit ahead! Get ready for a healthier you.' },
          { k:'build_muscle', lbl:lang==='tr'?'Kas Kazan':'Build Muscle', icon:'barbell-outline', col:C.lime,   tip:lang==='tr'?'💪 Kas kazan, özgüven kazan!':'💪 Muscle up, confidence up!' },
          { k:'keep_fit',     lbl:lang==='tr'?'Formda Kal':'Keep Fit',    icon:'heart-outline',   col:C.teal,   tip:lang==='tr'?'😊 Aktif kal, sağlıklı kal!':'😊 Stay active, stay healthy!' },
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Ana hedefiniz?':"What's your main goal?"}</Text>
            {goals.map(g=><GoalCard key={g.k} label={g.lbl} icon={g.icon} color={g.col} selected={a.goal===g.k} onPress={()=>set('goal',g.k)} tip={g.tip}/>)}
          </ScrollView>
        );
      }

      // 3. Motivasyon
      case 'motivation': {
        const opts = [
          { k:'attractive',  lbl:lang==='tr'?'Daha çekici görün':'Look more attractive',   icon:'sparkles-outline'   },
          { k:'stronger',    lbl:lang==='tr'?'Daha güçlü ol':'Get stronger',               icon:'barbell-outline'    },
          { k:'health',      lbl:lang==='tr'?'Sağlığı iyileştir':'Improve health',          icon:'medkit-outline'     },
          { k:'confident',   lbl:lang==='tr'?'Kendine güven':'Feel confident',              icon:'happy-outline'      },
          { k:'energy',      lbl:lang==='tr'?'Enerji kazan':'Boost energy',                 icon:'flash-outline'      },
          { k:'stress',      lbl:lang==='tr'?'Stresi azalt':'Release stress',               icon:'leaf-outline'       },
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Sizi en çok ne motive eder?':'What motivates you the most?'}</Text>
            <Text style={s.qsub}>{lang==='tr'?'Birden fazla seçebilirsiniz':'Multiple selections allowed'}</Text>
            {opts.map(o=><OptionRow key={o.k} label={o.lbl} icon={o.icon} selected={a.motivation.includes(o.k)} onPress={()=>toggleArr('motivation',o.k)} multi />)}
          </ScrollView>
        );
      }

      // 4. Odak bölge
      case 'focus': {
        const areas = [
          { k:'full_body', lbl:lang==='tr'?'Tüm Vücut':'Full Body',    icon:'body-outline'               },
          { k:'arms',      lbl:lang==='tr'?'Kollar':'Arms',            icon:'fitness-outline'            },
          { k:'chest',     lbl:lang==='tr'?'Göğüs':'Chest',           icon:'shirt-outline'              },
          { k:'core',      lbl:lang==='tr'?'Karın / Core':'Abs / Core',icon:'radio-button-on-outline'    },
          { k:'legs',      lbl:lang==='tr'?'Bacaklar':'Legs',          icon:'walk-outline'               },
          { k:'back',      lbl:lang==='tr'?'Sırt':'Back',              icon:'accessibility-outline'      },
        ];
        // Çoklu seçim; "Tüm Vücut" diğerlerini dışlar
        const toggleFocus = (k) => {
          setA(prev => {
            let next;
            if (k === 'full_body') next = prev.focusAreas.includes('full_body') ? [] : ['full_body'];
            else {
              const base = prev.focusAreas.filter(x => x !== 'full_body');
              next = base.includes(k) ? base.filter(x => x !== k) : [...base, k];
            }
            return { ...prev, focusAreas: next };
          });
        };
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Odak bölgeleriniz?':'Your focus areas?'}</Text>
            <Text style={s.qsub}>{lang==='tr'?'Birden fazla seçebilirsiniz':'Multiple selections allowed'}</Text>
            <View style={s.focusGrid}>
              {areas.map(a2=>{
                const on = a.focusAreas.includes(a2.k);
                return (
                  <TouchableOpacity key={a2.k} style={[s.focusCard, on&&{borderColor:C.lime,backgroundColor:C.lime+'14'}]} onPress={()=>toggleFocus(a2.k)} activeOpacity={0.8}>
                    {on && <Ionicons name="checkmark-circle" size={16} color={C.lime} style={{position:'absolute',top:8,right:8}} />}
                    <Ionicons name={a2.icon} size={28} color={on?C.lime:C.muted} />
                    <Text style={[s.focusLbl, on&&{color:C.lime,fontWeight:'800'}]}>{a2.lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        );
      }

      // 5. Doğum yılı — wheel + 4 haneli kilit spinner (senkron), aralık kontrolü
      case 'birth_year': {
        const years = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MAX - i);
        const outOfRange = yearDraft < YEAR_MIN || yearDraft > YEAR_MAX;
        const onWheel = (v) => { set('birthYear', v); setYearDraft(v); setStepInvalid('birth_year', false); };
        const onDigits = (v) => {
          setYearDraft(v);
          if (v >= YEAR_MIN && v <= YEAR_MAX) { set('birthYear', v); setStepInvalid('birth_year', false); }
          else setStepInvalid('birth_year', true);
        };
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.q}>{lang==='tr'?'Doğum yılınız?':"What's your birth year?"}</Text>
            <View style={s.infoCard}>
              <Ionicons name="information-circle-outline" size={18} color={C.muted} />
              <Text style={s.infoCardTxt}>
                {lang==='tr'?`Yaş grubunuza göre antrenman ayarlanır (${YEAR_MIN}–${YEAR_MAX}).`:`Used to adjust workout for your age group (${YEAR_MIN}–${YEAR_MAX}).`}
              </Text>
            </View>
            <WheelPicker values={years} value={a.birthYear} onChange={onWheel} color={C.lime} />
            <Text style={s.manualLbl}>{lang==='tr'?'veya elle gir':'or enter manually'}</Text>
            <YearDigitPicker value={yearDraft} onChange={onDigits} color={C.lime} invalid={outOfRange} />
            {outOfRange && (
              <Text style={s.errTxt}>
                {lang==='tr'?`Yıl ${YEAR_MIN} ile ${YEAR_MAX} arasında olmalı.`:`Year must be between ${YEAR_MIN} and ${YEAR_MAX}.`}
              </Text>
            )}
          </ScrollView>
        );
      }

      // 6. Boy — cetvel + cm/ft senkron manuel giriş
      case 'height':
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.q}>{lang==='tr'?'Boyunuz?':"What's your height?"}</Text>
            <RulerPicker value={a.height} onChange={v=>set('height',v)} min={H_MIN} max={H_MAX} unit="cm" color={C.lime} />
            <HeightField
              baseCm={a.height} onBase={v=>set('height',v)}
              min={H_MIN} max={H_MAX}
              activeUnit={heightUnit} onUnitChange={setHeightUnit} color={C.lime}
              onValidityChange={bad=>setStepInvalid('height', bad)}
              invalidMsg={lang==='tr'?`Boy ${H_MIN}–${H_MAX} cm arasında olmalı.`:`Height must be ${H_MIN}–${H_MAX} cm.`}
              prefUnitLabel={lang==='tr'?`Ayarlar: ${lengthUnit==='cm'?'cm':'feet'}`:`Settings: ${lengthUnit==='cm'?'cm':'feet'}`}
            />
          </ScrollView>
        );

      // 7. Kilo
      case 'weight': {
        const b = bmi(a.weight, a.height);
        const [bl, bc, bd] = b ? bmiInfo(b, lang) : ['—', C.muted, ''];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.q}>{lang==='tr'?'Mevcut kilonuz?':"What's your current weight?"}</Text>
            <RulerPicker value={a.weight} onChange={v=>set('weight',v)} min={W_MIN} max={W_MAX} unit="kg" color={C.lime} step={0.5} />
            <SyncedUnitField
              baseValue={a.weight} onBase={v=>set('weight',v)}
              min={W_MIN} max={W_MAX} units={WEIGHT_UNITS} roundBase={roundHalf}
              activeUnit={weightUnitSel} onUnitChange={setWeightUnitSel} color={C.lime}
              onValidityChange={bad=>setStepInvalid('weight', bad)}
              invalidMsg={lang==='tr'?`Kilo ${W_MIN}–${W_MAX} kg arasında olmalı.`:`Weight must be ${W_MIN}–${W_MAX} kg.`}
              prefUnitLabel={lang==='tr'?`Ayarlar: ${weightUnit}`:`Settings: ${weightUnit}`}
            />
            {b && (
              <AnimatedRN.View entering={FadeIn.duration(250)} style={[s.bmiCard,{borderColor:bc+'55'}]}>
                <Text style={[s.bmiVal,{color:bc}]}>{b}</Text>
                <View style={{flex:1}}>
                  <Text style={{color:C.text,fontWeight:'700'}}>BMI <Text style={{color:bc}}>({bl})</Text></Text>
                  <Text style={{color:C.muted,fontSize:12,marginTop:2}}>{bd}</Text>
                </View>
              </AnimatedRN.View>
            )}
          </ScrollView>
        );
      }

      // 8. Hedef kilo
      case 'target_weight': {
        const diff = (a.weight - a.targetWeight).toFixed(1);
        const isLose = a.weight > a.targetWeight;
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.q}>{lang==='tr'?'Hedef kilonuz?':"What's your target weight?"}</Text>
            <RulerPicker value={a.targetWeight} onChange={v=>set('targetWeight',v)} min={W_MIN} max={W_MAX} unit="kg" color={C.orange} step={0.5} />
            <SyncedUnitField
              baseValue={a.targetWeight} onBase={v=>set('targetWeight',v)}
              min={W_MIN} max={W_MAX} units={WEIGHT_UNITS} roundBase={roundHalf}
              activeUnit={tgtUnitSel} onUnitChange={setTgtUnitSel} color={C.orange}
              onValidityChange={bad=>setStepInvalid('target_weight', bad)}
              invalidMsg={lang==='tr'?`Hedef kilo ${W_MIN}–${W_MAX} kg arasında olmalı.`:`Target must be ${W_MIN}–${W_MAX} kg.`}
              prefUnitLabel={lang==='tr'?`Ayarlar: ${weightUnit}`:`Settings: ${weightUnit}`}
            />
            {Math.abs(diff) > 0.1 && (
              <AnimatedRN.View entering={FadeIn.duration(250)} style={[s.bmiCard,{borderColor:C.lime+'55'}]}>
                <Ionicons name="flag-outline" size={28} color={C.lime} />
                <View style={{flex:1}}>
                  <Text style={{color:C.lime,fontWeight:'800',fontSize:15}}>
                    {Math.abs(diff)} kg {isLose?(lang==='tr'?'kayıp':'loss'):(lang==='tr'?'kazanım':'gain')}
                  </Text>
                  <Text style={{color:C.muted,fontSize:12,marginTop:2}}>
                    {lang==='tr'?'Makul bir hedef!':'Reasonable goal!'}
                  </Text>
                </View>
              </AnimatedRN.View>
            )}
          </ScrollView>
        );
      }

      // 9. Vücut şekli — kullanıcı SEÇMEZ, girdiği kilo/boy/hedeften türetilir
      case 'body_shape': {
        const curShape = deriveShape(a.weight, a.height);
        const tgtShape = deriveShape(a.targetWeight, a.height);
        const cur = SHAPES[curShape], tgt = SHAPES[tgtShape];
        const same = curShape === tgtShape;
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Vücut dönüşümünüz':'Your body transformation'}</Text>
            <Text style={s.qsub}>{lang==='tr'?'Verdiğin bilgilere göre hesaplandı':'Calculated from your data'}</Text>

            <View style={s.shapeCompare}>
              <AnimatedRN.View entering={FadeInDown.duration(400)} style={s.shapeSide}>
                <Text style={s.shapeCap}>{lang==='tr'?'Şu an':'Now'}</Text>
                <LinearGradient colors={[cur.color+'33', cur.color+'0A']} style={[s.shapeFig,{borderColor:cur.color+'55'}]}>
                  <Ionicons name="body" size={54 + curShape*3} color={cur.color} />
                </LinearGradient>
                <Text style={[s.shapeName,{color:cur.color}]}>{SHAPE_LBL[curShape]?.[lang]}</Text>
              </AnimatedRN.View>

              <AnimatedRN.View entering={FadeIn.delay(350).duration(400)} style={s.shapeArrow}>
                <Ionicons name="arrow-forward" size={26} color={C.lime} />
              </AnimatedRN.View>

              <AnimatedRN.View entering={FadeInDown.delay(200).duration(400)} style={s.shapeSide}>
                <Text style={[s.shapeCap,{color:C.lime}]}>{lang==='tr'?'Hedef':'Goal'}</Text>
                <LinearGradient colors={[tgt.color+'44', tgt.color+'11']} style={[s.shapeFig,{borderColor:tgt.color}]}>
                  <Ionicons name="body" size={54 + tgtShape*3} color={tgt.color} />
                </LinearGradient>
                <Text style={[s.shapeName,{color:tgt.color}]}>{SHAPE_LBL[tgtShape]?.[lang]}</Text>
              </AnimatedRN.View>
            </View>

            <AnimatedRN.View entering={FadeInUp.delay(500).duration(350)} style={[s.infoCard,{marginTop:8}]}>
              <Ionicons name="sparkles-outline" size={18} color={C.lime} />
              <Text style={s.infoCardTxt}>
                {same
                  ? (lang==='tr'?'Formunu korumaya odaklı bir plan hazırlayacağız.':"We'll build a plan focused on keeping your shape.")
                  : (lang==='tr'?'Bu dönüşüm için sana özel bir plan hazırlıyoruz.':"We'll craft a personalized plan for this transformation.")}
              </Text>
            </AnimatedRN.View>
          </ScrollView>
        );
      }

      // 10. Meslek
      case 'occupation': {
        const occ = [
          { k:'student',    lbl:lang==='tr'?'Öğrenci':'Student',             icon:'school-outline'    },
          { k:'fulltime',   lbl:lang==='tr'?'Tam zamanlı çalışan':'Full-time employee', icon:'briefcase-outline' },
          { k:'parttime',   lbl:lang==='tr'?'Yarı zamanlı':'Part-time worker', icon:'bag-outline'      },
          { k:'freelance',  lbl:lang==='tr'?'Freelancer':'Freelancer',        icon:'laptop-outline'    },
          { k:'homemaker',  lbl:lang==='tr'?'Ev hanımı/reisi':'Homemaker',    icon:'home-outline'      },
          { k:'business',   lbl:lang==='tr'?'İşletme sahibi':'Business owner',icon:'storefront-outline'},
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Sizi en iyi anlatan hangisi?':'What best describes you?'}</Text>
            {occ.map(o=><OptionRow key={o.k} label={o.lbl} icon={o.icon} selected={a.occupation===o.k} onPress={()=>set('occupation',o.k)} />)}
          </ScrollView>
        );
      }

      // 11. Antrenman yeri
      case 'workout_place': {
        const places = [
          { k:'gym',    lbl:lang==='tr'?'Spor Salonu':'Gym',              icon:'barbell-outline',   sub:lang==='tr'?'Tam ekipman':'Full equipment'    },
          { k:'home',   lbl:lang==='tr'?'Evde':'At Home',                 icon:'home-outline',      sub:lang==='tr'?'Minimal ekipman':'Minimal equipment' },
          { k:'outdoor',lbl:lang==='tr'?'Açık Hava':'Outdoors',           icon:'sunny-outline',     sub:lang==='tr'?'Park, saha':'Park, field'        },
          { k:'yoga',   lbl:lang==='tr'?'Yoga Mat':'On the yoga mat',     icon:'flower-outline',    sub:lang==='tr'?'Zemin hareketleri':'Floor exercises' },
          { k:'any',    lbl:lang==='tr'?'Her yer':'Any place is OK',      icon:'globe-outline',     sub:lang==='tr'?'Esnek program':'Flexible routine'  },
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Genellikle nerede antrenman yaparsınız?':'Where do you usually work out?'}</Text>
            {places.map(p=><OptionRow key={p.k} label={p.lbl} sublabel={p.sub} icon={p.icon} selected={a.workoutPlace===p.k} onPress={()=>set('workoutPlace',p.k)} />)}
          </ScrollView>
        );
      }

      // 12. Egzersiz tipi
      case 'ex_type': {
        const types = [
          { k:'no_equip',  lbl:lang==='tr'?'Ekipmansız':'No equipment',     icon:'body-outline'               },
          { k:'no_jump',   lbl:lang==='tr'?'Zıplamadan':'No jumping',        icon:'remove-circle-outline'      },
          { k:'floor',     lbl:lang==='tr'?'Zemin hareketleri':'Floor/lying exercises', icon:'albums-outline' },
          { k:'any',       lbl:lang==='tr'?'Farketmez':'No preference',      icon:'checkmark-done-outline'     },
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Hangi egzersiz tipini tercih edersiniz?':'Which exercise type do you prefer?'}</Text>
            {types.map(t=><OptionRow key={t.k} label={t.lbl} icon={t.icon} selected={a.exType===t.k} onPress={()=>set('exType',t.k)} />)}
          </ScrollView>
        );
      }

      // 12b. Isınma & Soğuma tercihleri — iki büyük toggle kart
      case 'prefs': {
        const prefs = [
          { k:'warmup',   lbl:lang==='tr'?'Isınma Rutini':'Warm-up Routine',      icon:'flame-outline',
            sub:lang==='tr'?'Her antrenman öncesi ~5 dk hazırlık':'~5 min prep before each workout' },
          { k:'cooldown', lbl:lang==='tr'?'Soğuma & Esneme':'Cool-down Stretches', icon:'leaf-outline',
            sub:lang==='tr'?'Antrenman sonrası ~5 dk esneme':'~5 min stretching after workout' },
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Antrenman öncesi & sonrası':'Before & after your workout'}</Text>
            <Text style={s.qsub}>{lang==='tr'?'Planına dahil edelim mi?':'Include these in your plan?'}</Text>
            {prefs.map(p => {
              const on = a[p.k];
              return (
                <TouchableOpacity key={p.k} activeOpacity={0.85} onPress={()=>set(p.k, !on)}
                  style={[s.prefCard, on && { borderColor: C.lime, backgroundColor: C.lime+'10' }]}>
                  <View style={[s.prefIcon, { backgroundColor: (on?C.lime:C.dim)+'1A' }]}>
                    <Ionicons name={p.icon} size={24} color={on?C.lime:C.dim} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={[s.prefLbl, on && { color:'#fff' }]}>{p.lbl}</Text>
                    <Text style={s.prefSub}>{p.sub}</Text>
                  </View>
                  <View style={[s.prefTrack, on && { backgroundColor: C.lime }]}>
                    <View style={[s.prefThumb, on && { alignSelf:'flex-end' }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        );
      }

      // 13. Sakatlık/rahatsızlık
      case 'injury': {
        const areas = [
          { k:'none',      lbl:lang==='tr'?'Yok':'None',              icon:'checkmark-circle-outline' },
          { k:'knee',      lbl:lang==='tr'?'Diz':'Knee',              icon:'accessibility-outline'    },
          { k:'lower_back',lbl:lang==='tr'?'Alt Sırt':'Lower back',   icon:'body-outline'              },
          { k:'shoulder',  lbl:lang==='tr'?'Omuz':'Shoulder',         icon:'fitness-outline'           },
          { k:'ankle',     lbl:lang==='tr'?'Ayak Bileği':'Ankle',     icon:'walk-outline'              },
          { k:'wrist',     lbl:lang==='tr'?'Bilek':'Wrist',           icon:'hand-right-outline'        },
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Herhangi bir rahatsızlık var mı?':'Any discomfort or concerns?'}</Text>
            <View style={s.infoCard}>
              <Ionicons name="medical-outline" size={18} color={C.muted} />
              <Text style={s.infoCardTxt}>
                {lang==='tr'?'Bölgeleri özel olarak gözetleyelim.':'We will focus on areas needing extra care.'}
              </Text>
            </View>
            {areas.map(ar=><OptionRow key={ar.k} label={ar.lbl} icon={ar.icon} selected={a.injury.includes(ar.k)} onPress={()=>{ if(ar.k==='none'){set('injury',['none']);}else{toggleArr('injury',ar.k);}}} multi />)}
          </ScrollView>
        );
      }

      // 14. Aktivite seviyesi
      case 'activity': {
        const cur = ACT_OPTS[a.activityLevel];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Aktivite seviyeniz?':"What's your activity level?"}</Text>
            <View style={s.actIconWrap}>
              <LinearGradient colors={[C.lime+'22',C.lime+'06']} style={s.actIconCircle}>
                <Ionicons name={cur.icon} size={48} color={C.lime} />
              </LinearGradient>
              <Text style={s.actDesc}>{cur['desc_'+lang]}</Text>
            </View>
            <View style={s.sliderRow}>
              {ACT_OPTS.map((_,i)=>(
                <TouchableOpacity key={i} onPress={()=>set('activityLevel',i)} hitSlop={{top:12,bottom:12,left:12,right:12}}>
                  <View style={[s.sliderDot, a.activityLevel===i&&{backgroundColor:C.lime,width:22,height:22,borderRadius:11}]} />
                </TouchableOpacity>
              ))}
              <View style={s.sliderLine}/>
            </View>
            <View style={s.sliderLabels}>
              <Text style={s.sliderLbl}>{lang==='tr'?'Hareketsiz':'Sedentary'}</Text>
              <Text style={s.sliderLbl}>{lang==='tr'?'Aktif':'Active'}</Text>
            </View>
          </ScrollView>
        );
      }

      // 15. Antrenman sıklığı — +/- sayaç, 1-7/hafta, aşırı antrenman uyarısı
      case 'frequency': {
        const FREQ_DESC = {
          1: lang==='tr'?'Meşgulüm ama haftada bir antrenman yapmak istiyorum.':"I'm busy but still want to fit in a workout once a week.",
          2: lang==='tr'?'Biraz zamanım var ama çok değil.':'I have a bit of free time, but not too much.',
          3: lang==='tr'?'Antrenmanı yaşam tarzımın parçası yapıyorum.':'I enjoy working out as part of my lifestyle.',
          4: lang==='tr'?'Kendimi zorlamaya hazırım!':"I'm willing to work hard and push myself!",
          5: lang==='tr'?'Düzenli ve yoğun çalışmayı seviyorum.':'I love training regularly and intensely.',
          6: lang==='tr'?'Neredeyse her gün spordayım.':"I'm at the gym almost every day.",
          7: lang==='tr'?'Her gün antrenman yapmak istiyorum.':'I want to train every single day.',
        };
        const freq = a.workoutFreq;
        const overtrain = freq >= 6;
        const dec = () => set('workoutFreq', Math.max(FREQ_MIN, freq - 1));
        const inc = () => set('workoutFreq', Math.min(FREQ_MAX, freq + 1));
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Ne sıklıkla antrenman yapmak istersiniz?':'How often would you like to work out?'}</Text>
            <View style={s.actIconWrap}>
              <LinearGradient colors={[C.blue+'22',C.blue+'06']} style={s.actIconCircle}>
                <Text style={s.freqBig}>{freq}</Text>
              </LinearGradient>
              <Text style={[s.actDesc,{color:C.lime,fontWeight:'800'}]}>{freq} {lang==='tr'?'kez/hafta':'times / week'}</Text>
              <Text style={s.actDesc}>{FREQ_DESC[freq]}</Text>
            </View>
            <View style={s.counterRow}>
              <TouchableOpacity onPress={dec} disabled={freq<=FREQ_MIN} activeOpacity={0.8}
                style={[s.counterBtn, freq<=FREQ_MIN && {opacity:0.35}]}>
                <Ionicons name="remove" size={28} color={C.text} />
              </TouchableOpacity>
              <View style={s.counterVal}>
                <Text style={s.counterValTxt}>{freq}</Text>
                <Text style={s.counterValSub}>/ {FREQ_MAX}</Text>
              </View>
              <TouchableOpacity onPress={inc} disabled={freq>=FREQ_MAX} activeOpacity={0.8}
                style={[s.counterBtn, freq>=FREQ_MAX && {opacity:0.35}]}>
                <Ionicons name="add" size={28} color={C.text} />
              </TouchableOpacity>
            </View>
            {overtrain && (
              <AnimatedRN.View entering={FadeIn.duration(250)} style={s.warnCard}>
                <Ionicons name="warning-outline" size={18} color={C.orange} />
                <Text style={s.warnTxt}>
                  {lang==='tr'
                    ? 'Çok sık antrenman toparlanmayı zorlaştırır; dinlenme günleri verimi artırır.'
                    : 'Training too often hinders recovery — rest days improve results.'}
                </Text>
              </AnimatedRN.View>
            )}
          </ScrollView>
        );
      }

      // 16. Fitness seviyesi
      case 'level': {
        const lvls = [
          { k:'beginner',     lbl:lang==='tr'?'Başlamak kolay':'Easy to start',       icon:'leaf-outline',       col:C.teal,  tip:lang==='tr'?'Yeni başlıyorum veya uzun süredir yapmıyorum.':'New or haven\'t exercised in a while.' },
          { k:'intermediate', lbl:lang==='tr'?'Hafif ter dök':'Break a light sweat',  icon:'water-outline',      col:C.lime,  tip:lang==='tr'?'Düzenli spor yapıyorum, biraz zorlanmak istiyorum.':'I exercise regularly, want some challenge.' },
          { k:'advanced',     lbl:lang==='tr'?'Zorlu':'A bit challenging',            icon:'flame-outline',      col:C.orange,tip:lang==='tr'?'💪 Limitlerini zorla! Beraber güçleneceğiz.':'💪 Push your limits! We\'ll witness a stronger you.' },
        ];
        // Gauge görseli: seçime göre dolan hız göstergesi (Kolay → Yoğun)
        const lvlIdx = Math.max(0, lvls.findIndex(l => l.k === a.fitnessLevel));
        const cur = lvls[lvlIdx];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Antrenman tercihiniz?':'Choose your preferred workout level'}</Text>
            <View style={s.actIconWrap}>
              <LinearGradient colors={[cur.col+'22', cur.col+'06']} style={s.actIconCircle}>
                <Ionicons name="speedometer-outline" size={48} color={cur.col} />
              </LinearGradient>
              <View style={s.gaugeDots}>
                {lvls.map((lv,i)=>(
                  <View key={lv.k} style={[s.gaugeDot, i<=lvlIdx && { backgroundColor: cur.col }]} />
                ))}
              </View>
              <View style={s.gaugeLbls}>
                <Text style={s.sliderLbl}>{lang==='tr'?'Kolay':'Easy'}</Text>
                <Text style={s.sliderLbl}>{lang==='tr'?'Yoğun':'Intense'}</Text>
              </View>
            </View>
            {lvls.map(lv=><OptionRow key={lv.k} label={lv.lbl} sublabel={a.fitnessLevel===lv.k?lv.tip:undefined} icon={lv.icon} selected={a.fitnessLevel===lv.k} onPress={()=>set('fitnessLevel',lv.k)} color={lv.col} />)}
          </ScrollView>
        );
      }

      // 17. Şınav kapasitesi
      case 'pushups': {
        const opts = [
          { k:'beginner',     lbl:lang==='tr'?'Başlangıç (3-5)':'Beginner',     sublbl:'3-5 push-ups',    icon:'leaf-outline'    },
          { k:'intermediate', lbl:lang==='tr'?'Orta (5-10)':'Intermediate',      sublbl:'5-10 push-ups',   icon:'trending-up-outline' },
          { k:'advanced',     lbl:lang==='tr'?'İleri (10+)':'Advanced',          sublbl:'10+ push-ups',    icon:'flame-outline'   },
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Tek seferde kaç şınav çekebilirsiniz?':'How many push-ups can you do at one time?'}</Text>
            {opts.map(o=><OptionRow key={o.k} label={o.lbl} sublabel={o.sublbl} icon={o.icon} selected={a.pushups===o.k} onPress={()=>set('pushups',o.k)} />)}
          </ScrollView>
        );
      }

      // 18. Koşu sonrası
      case 'running': {
        const opts = [
          { k:'breathless',    lbl:lang==='tr'?'Nefes nefese':'Breathless',     icon:'sad-outline',   tip:lang==='tr'?'😊 Sorun değil! Kardiyoyu geliştireceğiz.':'😊 No big deal! We\'ll boost your cardio.' },
          { k:'slightly_tired',lbl:lang==='tr'?'Biraz yorulurum':'Slightly tired',icon:'hand-right-outline',tip:lang==='tr'?'💧 Güzel! Dayanıklılığını artıracağız.':'💧 Good work! We\'ll enhance your endurance.' },
          { k:'relaxed',       lbl:lang==='tr'?'Rahat hissederim':'Feel relaxed', icon:'happy-outline', tip:lang==='tr'?'😎 Etkileyici! Seviyeni daha da artıracağız.':'😎 Impressive! We\'ll take it even further.' },
        ];
        return (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.q}>{lang==='tr'?'Hızlı koşu sonrası nasıl hissedersiniz?':'How do you feel after fast running?'}</Text>
            {opts.map(o=><OptionRow key={o.k} label={o.lbl} sublabel={a.running===o.k?o.tip:undefined} icon={o.icon} selected={a.running===o.k} onPress={()=>set('running',o.k)} />)}
          </ScrollView>
        );
      }

      // 19. Planlar karşılaştırması (marketing screen)
      case 'comparison': return (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.q}>{lang==='tr'?'Fitness\'ı daha kolay & etkili yapalım!':'Let\'s make your fitness easier & more effective!'}</Text>
          <PlanComparison lang={lang} />
          <View style={{paddingTop:8}}>
            <TouchableOpacity onPress={goNext} activeOpacity={0.85}>
              <LinearGradient colors={['#e8f44a','#a3c200']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.readyBtn}>
                <Text style={s.readyTxt}>{lang==='tr'?'Planımı Al →':'Get My Plan →'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );

      // 20. Üretiliyor
      case 'generating': {
        const genItems = [
          lang==='tr'?'Vücut verileri analiz ediliyor':'Analyzing body data',
          lang==='tr'?'Metabolizma hesaplanıyor':'Calculating metabolism',
          lang==='tr'?'Odak egzersizler seçiliyor':'Picking targeted exercises',
          lang==='tr'?'Fitness seviyesi ayarlanıyor':'Adjusting your fitness level',
        ];
        return (
          <View style={s.genWrap}>
            <Text style={s.genTitle}>{lang==='tr'?'Koçunuz planınızı hazırlıyor...':'Your coach is creating your plan...'}</Text>
            {genItems.map((lbl,i)=>(
              <AnimatedRN.View key={i} entering={FadeInDown.delay(i*500).duration(350)} style={s.genItem}>
                <LinearGradient colors={[C.lime+'33',C.lime+'11']} style={s.genDot}>
                  <Ionicons name="checkmark" size={14} color={C.lime} />
                </LinearGradient>
                <View style={{flex:1}}>
                  <Text style={s.genLbl}>{lbl}</Text>
                  <View style={s.genBarBg}>
                    <LinearGradient colors={[C.lime,C.teal]} style={s.genBarFill}/>
                  </View>
                </View>
              </AnimatedRN.View>
            ))}
          </View>
        );
      }

      // 21. Sonuç
      case 'result': {
        const days = projDays(a.weight, a.targetWeight, a.workoutFreq);
        return (
          <ScrollView contentContainerStyle={{padding:16,paddingBottom:48}} showsVerticalScrollIndicator={false}>
            <AnimatedRN.View entering={FadeInUp.duration(400)}>
              <Text style={[s.q,{textAlign:'center',marginBottom:4}]}>
                {lang==='tr'?'🎯 Planınız hazır!':'🎯 Your plan is ready!'}
              </Text>
              <Text style={[s.qsub,{textAlign:'center',marginBottom:16}]}>
                {lang==='tr'?'Verilere dayalı tahminleriniz':'Your data-driven projections'}
              </Text>
              <ProjectionChart curKg={a.weight} tgtKg={a.targetWeight} days={days} lang={lang} />
              <PlanCard answers={a} lang={lang} />
              <StrengthCard level={a.fitnessLevel} lang={lang} />
              <NutritionCard answers={a} lang={lang} />

              {/* Şablonlara geç (Egzersizler → Templates) */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation?.navigate('Egzersizler', {
                  initialTab: 2,
                  filterDays: Math.min(a.workoutFreq || 3, 6),
                  filterGoal: GOAL_TO_PLAN[a.goal] ?? null,
                  // Evde/açık havada çalışanlara ev-dostu şablonları önce göster (filtre değil, sıralama)
                  sortEnv: (a.workoutPlace === 'home' || a.workoutPlace === 'outdoor' || a.workoutPlace === 'yoga') ? 'home' : null,
                  ts: Date.now(),
                })}
                style={{ marginBottom: 12 }}
              >
                <LinearGradient colors={['#e8f44a','#a3c200']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.templatesBtn}>
                  <Ionicons name="albums-outline" size={18} color={C.bg} />
                  <Text style={s.templatesTxt}>{lang==='tr'?'Antrenman Şablonlarını Gör':'View Workout Templates'}</Text>
                  <Ionicons name="arrow-forward" size={18} color={C.bg} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.restartBtn} onPress={()=>{ setStepIdx(0); setHasProfile(false); }} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={16} color={C.muted}/>
                <Text style={s.restartTxt}>{lang==='tr'?'Planı Güncelle':'Update Plan'}</Text>
              </TouchableOpacity>
            </AnimatedRN.View>
          </ScrollView>
        );
      }

      default: return null;
    }
  };

  const isQuestion = !!step?.cat;
  const showNext   = isQuestion && !['comparison'].includes(step?.id);

  return (
    <View style={s.container}>
      {isQuestion && <StepHeader step={step} onBack={goBack} lang={lang} />}
      <View style={{flex:1}}>{renderStep()}</View>
      {showNext && <NextBtn onPress={goNext} disabled={!canNext()||saving} label={lang==='tr'?'DEVAM':'NEXT'} />}
    </View>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:    { flex:1, backgroundColor:C.bg },
  scroll:       { padding:16, paddingBottom:16 },

  // Step header
  hdr:          { paddingHorizontal:16, paddingTop:12, paddingBottom:8 },
  hdrBack:      { position:'absolute', left:16, top:14, zIndex:1 },
  hdrCenter:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 },
  hdrCatN:      { color:C.lime, fontSize:13, fontWeight:'900' },
  hdrCatL:      { color:C.muted, fontSize:11, fontWeight:'700', letterSpacing:1 },
  hdrBars:      { flexDirection:'row', gap:4, height:3 },
  hdrBarSeg:    { flex:1, backgroundColor:C.s3, borderRadius:2, overflow:'hidden', flexDirection:'row' },
  hdrBarFill:   { backgroundColor:C.lime, height:'100%' },

  // NEXT
  nextWrap:     { padding:16, paddingBottom:24 },
  nextBtn:      { borderRadius:16, height:56, alignItems:'center', justifyContent:'center' },
  nextTxt:      { color:C.bg, fontSize:16, fontWeight:'900', letterSpacing:0.5 },

  // Questions
  q:            { color:C.text, fontSize:22, fontWeight:'900', marginBottom:6, lineHeight:30 },
  qsub:         { color:C.muted, fontSize:14, marginBottom:16 },

  // Option row
  optRow:       { flexDirection:'row', alignItems:'center', backgroundColor:C.s1, borderRadius:16, padding:16, borderWidth:1.5, borderColor:C.border, marginBottom:10 },
  optLbl:       { color:C.text, fontSize:15, fontWeight:'700' },
  optSub:       { color:C.muted, fontSize:12, marginTop:3, lineHeight:18 },
  optCheck:     { width:22, height:22, borderRadius:11, borderWidth:1.5, borderColor:C.border, alignItems:'center', justifyContent:'center' },

  // Goal card
  goalCard:     { borderRadius:18, padding:20, borderWidth:1.5, borderColor:C.border, flexDirection:'row', alignItems:'center', flexWrap:'wrap', gap:14 },
  goalLbl:      { color:C.text, fontSize:18, fontWeight:'900', flex:1 },
  goalTip:      { width:'100%', backgroundColor:'rgba(255,255,255,0.12)', borderRadius:12, padding:12 },
  goalTipTxt:   { color:'#fff', fontSize:13, lineHeight:20 },

  // Welcome
  welcomeWrap:  { alignItems:'center', paddingTop:32, paddingBottom:24, paddingHorizontal:24 },
  coachCircle:  { width:104, height:104, borderRadius:52, alignItems:'center', justifyContent:'center', marginBottom:24, borderWidth:1, borderColor:C.lime+'33' },
  welcomeHi:    { color:C.text, fontSize:38, fontWeight:'900', marginBottom:14 },
  welcomeDesc:  { color:C.muted, fontSize:16, textAlign:'center', lineHeight:26 },
  existingBtn:  { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.lime+'14', borderRadius:12, padding:12, borderWidth:1, borderColor:C.lime+'33', marginTop:20, alignSelf:'stretch' },
  existingTxt:  { color:C.lime, fontWeight:'700', fontSize:13, flex:1 },
  readyBtn:     { borderRadius:16, height:56, alignItems:'center', justifyContent:'center' },
  readyTxt:     { color:C.bg, fontSize:17, fontWeight:'900' },

  // Gender
  genderRow:    { flexDirection:'row', gap:12, marginBottom:16 },
  genderCard:   { flex:1, alignItems:'center', backgroundColor:C.s1, borderRadius:18, padding:24, borderWidth:1.5, borderColor:C.border, gap:12, position:'relative' },
  genderCheck:  { position:'absolute', top:10, right:10 },
  genderLbl:    { color:C.text, fontSize:16, fontWeight:'700' },
  otherBtn:     { alignItems:'center', paddingVertical:14 },
  otherTxt:     { color:C.muted, fontSize:13 },

  // Focus grid
  focusGrid:    { flexDirection:'row', flexWrap:'wrap', gap:10 },
  focusCard:    { width:(SW-42)/2, backgroundColor:C.s1, borderRadius:16, padding:18, borderWidth:1.5, borderColor:C.border, alignItems:'center', gap:10 },
  focusLbl:     { color:C.text, fontSize:13, fontWeight:'700', textAlign:'center' },

  // BMI card
  bmiCard:      { flexDirection:'row', alignItems:'center', gap:16, backgroundColor:C.s1, borderRadius:16, padding:16, borderWidth:1, marginTop:16 },
  bmiVal:       { fontSize:40, fontWeight:'900' },

  // Info card
  infoCard:     { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.s1, borderRadius:14, padding:14, borderWidth:1, borderColor:C.border, marginBottom:16 },
  infoCardTxt:  { color:C.muted, fontSize:13, flex:1 },

  // Activity/Frequency slider
  actIconWrap:  { alignItems:'center', paddingVertical:20, gap:14 },
  actIconCircle:{ width:96, height:96, borderRadius:48, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.lime+'33' },
  actDesc:      { color:C.text, fontSize:15, textAlign:'center', lineHeight:22, paddingHorizontal:16 },
  freqBig:      { color:C.lime, fontSize:60, fontWeight:'900', lineHeight:68 },
  sliderRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginHorizontal:8, position:'relative', paddingVertical:12 },
  sliderLine:   { position:'absolute', height:2, backgroundColor:C.s3, left:12, right:12, zIndex:-1 },
  sliderDot:    { width:16, height:16, borderRadius:8, backgroundColor:C.s3, borderWidth:2, borderColor:C.border },
  sliderLabels: { flexDirection:'row', justifyContent:'space-between', marginTop:4 },
  sliderLbl:    { color:C.dim, fontSize:12, fontWeight:'600' },

  // Body shape (türetilmiş, animasyonlu karşılaştırma)
  shapeCompare: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginVertical:20, gap:8 },
  shapeSide:    { flex:1, alignItems:'center', gap:10 },
  shapeCap:     { color:C.muted, fontSize:12, fontWeight:'700', letterSpacing:1, textTransform:'uppercase' },
  shapeFig:     { width:112, height:132, borderRadius:20, borderWidth:1.5, alignItems:'center', justifyContent:'center' },
  shapeName:    { fontSize:15, fontWeight:'800' },
  shapeArrow:   { paddingHorizontal:2 },

  // Sıklık sayacı (+/-)
  counterRow:   { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:20, marginTop:8 },
  counterBtn:   { width:64, height:64, borderRadius:20, backgroundColor:C.s1, borderWidth:1.5, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  counterVal:   { flexDirection:'row', alignItems:'baseline', gap:4, minWidth:90, justifyContent:'center' },
  counterValTxt:{ color:C.text, fontSize:44, fontWeight:'900' },
  counterValSub:{ color:C.dim, fontSize:16, fontWeight:'700' },
  warnCard:     { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.orange+'14', borderRadius:14, padding:14, borderWidth:1, borderColor:C.orange+'44', marginTop:18 },
  warnTxt:      { color:C.orange, fontSize:12.5, fontWeight:'600', flex:1, lineHeight:18 },

  // Manuel giriş / hata
  manualLbl:    { color:C.dim, fontSize:12, fontWeight:'600', textAlign:'center', marginTop:18, marginBottom:2, letterSpacing:0.5 },
  errTxt:       { color:C.red, fontSize:12.5, fontWeight:'600', textAlign:'center', marginTop:12 },

  // Şablonlara geç butonu
  templatesBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, borderRadius:16, height:54 },
  templatesTxt: { color:C.bg, fontSize:15, fontWeight:'900', letterSpacing:0.3 },

  // Plan comparison
  cmpRow:       { flexDirection:'row', gap:10 },
  cmpCard:      { flex:1, borderRadius:18, padding:16, borderWidth:1.5, gap:10 },
  cmpLbl:       { color:C.muted, fontSize:14, fontWeight:'800', marginBottom:4 },
  cmpItem:      { flexDirection:'row', alignItems:'center', gap:8 },
  cmpTxt:       { color:C.muted, fontSize:13, flex:1 },

  // Generating
  genWrap:      { flex:1, padding:24, justifyContent:'center' },
  genTitle:     { color:C.text, fontSize:22, fontWeight:'900', textAlign:'center', marginBottom:36, lineHeight:30 },
  genItem:      { flexDirection:'row', alignItems:'center', gap:14, marginBottom:28 },
  genDot:       { width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center' },
  genLbl:       { color:C.text, fontSize:14, fontWeight:'700', marginBottom:6 },
  genBarBg:     { height:4, backgroundColor:C.s3, borderRadius:2, overflow:'hidden' },
  genBarFill:   { height:'100%', width:'100%', borderRadius:2 },

  // Chart
  chart:        { backgroundColor:C.s1, borderRadius:18, padding:16, borderWidth:1, borderColor:C.border, marginVertical:16 },
  chartTitle:   { color:C.muted, fontSize:12, fontWeight:'700', marginBottom:8, textAlign:'center' },
  chartKgRow:   { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:12, marginBottom:12 },
  chartCur:     { color:C.muted, fontSize:22, fontWeight:'800' },
  chartTgt:     { fontSize:28, fontWeight:'900' },
  chartBars:    { flexDirection:'row', alignItems:'flex-end', height:72, gap:3, marginBottom:6 },
  chartBarCol:  { flex:1, height:'100%', justifyContent:'flex-end' },
  chartBar:     { borderRadius:4, width:'100%' },
  chartDates:   { flexDirection:'row', justifyContent:'space-between', marginBottom:10 },
  chartDate:    { color:C.dim, fontSize:12 },
  chartInfo:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.lime+'18', borderRadius:12, padding:12 },
  chartInfoTxt: { color:C.lime, fontSize:13, fontWeight:'700', flex:1 },

  // Plan card
  planCard:     { backgroundColor:C.s1, borderRadius:18, padding:16, borderWidth:1, borderColor:C.border, marginBottom:16 },
  planTitle:    { color:C.text, fontSize:15, fontWeight:'800', marginBottom:14, textAlign:'center' },
  planGrid:     { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:12 },
  planItem:     { flex:1, minWidth:'44%', backgroundColor:C.s2, borderRadius:12, padding:12, alignItems:'center', gap:4 },
  planVal:      { color:C.text, fontSize:15, fontWeight:'900', textAlign:'center' },
  planLbl:      { color:C.muted, fontSize:11, fontWeight:'600', textAlign:'center' },
  planBmi:      { flexDirection:'row', alignItems:'center', gap:12, borderRadius:12, padding:12, borderWidth:1 },
  planBmiVal:   { fontSize:28, fontWeight:'900' },
  planBmiLbl:   { fontSize:14, fontWeight:'800' },
  planBmiDesc:  { color:C.muted, fontSize:12, marginTop:2 },
  planExtras:   { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 },
  planExtraChip:{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:6, borderRadius:10, borderWidth:1, borderColor:C.lime+'44', backgroundColor:C.lime+'0D' },
  planExtraTxt: { color:C.text, fontSize:12, fontWeight:'600' },

  // Prefs (ısınma/soğuma) toggle kartları
  prefCard:  { flexDirection:'row', alignItems:'center', gap:14, borderRadius:18, borderWidth:1.5, borderColor:C.border, backgroundColor:C.s1, padding:18, marginBottom:12 },
  prefIcon:  { width:48, height:48, borderRadius:14, alignItems:'center', justifyContent:'center' },
  prefLbl:   { color:C.text, fontSize:16, fontWeight:'800' },
  prefSub:   { color:C.muted, fontSize:12, marginTop:3, lineHeight:17 },
  prefTrack: { width:46, height:26, borderRadius:13, backgroundColor:C.s3, padding:3, justifyContent:'center' },
  prefThumb: { width:20, height:20, borderRadius:10, backgroundColor:'#fff', alignSelf:'flex-start' },

  // Level gauge
  gaugeDots: { flexDirection:'row', gap:10, marginTop:12 },
  gaugeDot:  { width:26, height:8, borderRadius:4, backgroundColor:C.s3 },
  gaugeLbls: { flexDirection:'row', justifyContent:'space-between', alignSelf:'stretch', paddingHorizontal:60, marginTop:6 },

  // Strength projection
  strengthRow:  { flexDirection:'row', alignItems:'center', gap:18, marginTop:4 },
  strengthBars: { flexDirection:'row', alignItems:'flex-end', gap:5, flex:1, height:60 },
  strengthBar:  { flex:1, borderRadius:4 },
  strengthInfo: { alignItems:'flex-end' },
  strengthPct:  { color:C.lime, fontSize:30, fontWeight:'900' },
  strengthLbl:  { color:C.muted, fontSize:11, textAlign:'right', lineHeight:15, marginTop:2 },

  // Nutrition
  nutriNote: { color:C.dim, fontSize:11, marginTop:10, textAlign:'center' },

  // Result
  restartBtn:   { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, padding:12, backgroundColor:C.s1, borderRadius:12, borderWidth:1, borderColor:C.border },
  restartTxt:   { color:C.muted, fontSize:13, fontWeight:'600' },
});
