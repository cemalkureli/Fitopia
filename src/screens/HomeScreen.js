import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { C } from '../utils/theme';
import { getAllWorkoutLogs, getActiveProgram } from '../utils/storage';
import { supabase } from '../lib/supabase';
import { useLang } from '../context/LanguageContext';
import { t, DAYS_SHORT, MONTHS_SHORT } from '../utils/i18n';

function greeting(lang) {
  const h = new Date().getHours();
  if (h < 6)  return t('greeting_night', lang);
  if (h < 12) return t('greeting_morning', lang);
  if (h < 17) return t('greeting_noon', lang);
  if (h < 21) return t('greeting_evening', lang);
  return t('greeting_late', lang);
}

// Bir program için belirli bir günün antrenmanını döndür
function getWorkoutForDay(d, program) {
  if (!program?.workouts?.length) return null;
  const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // dayOfWeek belirtilmişse (Guray gibi programlar)
  const hasDayOfWeek = program.workouts.some(w => w.dayOfWeek !== undefined && w.dayOfWeek !== null);
  if (hasDayOfWeek) {
    return program.workouts.find(w => w.dayOfWeek === dow) ?? null;
  }

  // dayOfWeek yok → sıralı: Pazartesi=0, Salı=1, ...
  const mondayIdx = (dow + 6) % 7; // Mon=0 ... Sun=6
  return mondayIdx < program.workouts.length ? program.workouts[mondayIdx] : null;
}

// Workout tipine göre icon & renk
function workoutMeta(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('push'))   return { icon: 'barbell-outline',   color: C.lime   };
  if (n.includes('pull'))   return { icon: 'fitness-outline',   color: C.blue   };
  if (n.includes('leg') || n.includes('bacak')) return { icon: 'walk-outline', color: C.orange };
  if (n.includes('upper'))  return { icon: 'arrow-up-outline',  color: C.purple };
  if (n.includes('lower'))  return { icon: 'arrow-down-outline',color: C.teal   };
  if (n.includes('full') || n.includes('total')) return { icon: 'body-outline', color: C.lime };
  if (n.includes('cardio') || n.includes('kardio')) return { icon: 'heart-outline', color: C.red };
  return { icon: 'barbell-outline', color: C.lime };
}

function StatCard({ icon, value, label, color, delay }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// Haftanın günleri — log + program bilgisiyle zenginleştirilmiş
function ActivityWeek({ logs, program, lang, navigation }) {
  const days  = DAYS_SHORT[lang] ?? DAYS_SHORT.tr;
  const today = new Date();
  const week  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);
    return d;
  });

  const logDates = new Set();
  Object.values(logs).forEach(sessions =>
    sessions.forEach(s => logDates.add(new Date(s.date).toDateString()))
  );

  function dayMeta(d) {
    return getWorkoutForDay(d, program);
  }

  return (
    <View style={s.activityRow}>
      {week.map((d, i) => {
        const active   = logDates.has(d.toDateString());
        const isToday  = d.toDateString() === today.toDateString();
        const workout  = dayMeta(d);
        const meta     = workout ? workoutMeta(workout.name_en || workout.name) : null;

        const hasTap = !!workout || active;
        return (
          <TouchableOpacity
            key={i}
            style={s.activityDay}
            activeOpacity={hasTap ? 0.7 : 1}
            onPress={() => {
              if (!hasTap) return;
              navigation.navigate('Program', { focusDay: d.getDay() });
            }}
          >
            <View style={[
              s.activityDot,
              active && { backgroundColor: C.lime },
              !active && meta && { backgroundColor: meta.color + '28', borderColor: meta.color + '55', borderWidth: 1 },
              !active && !meta && { backgroundColor: C.s3 },
              isToday && !active && { borderColor: C.lime, borderWidth: 1.5 },
            ]}>
              {active ? (
                <Ionicons name="checkmark" size={14} color={C.bg} />
              ) : meta ? (
                <Ionicons name={meta.icon} size={12} color={meta.color} />
              ) : (
                <Ionicons name="moon-outline" size={11} color={C.dim} />
              )}
            </View>
            <Text style={[s.activityDayLabel, isToday && { color: C.lime }]}>
              {days[d.getDay()]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const { lang }       = useLang();
  const navigation     = useNavigation();
  const [logs,    setLogs]    = useState({});
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);   // active program or null

  useFocusEffect(useCallback(() => {
    getAllWorkoutLogs().then(setLogs);
    getActiveProgram().then(setProgram);
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const meta = data.user.user_metadata;
        setProfile({ name: meta?.full_name || data.user.email?.split('@')[0] || t('athlete', lang) });
      }
    });
  }, [lang]));

  const months    = MONTHS_SHORT[lang] ?? MONTHS_SHORT.tr;
  const days      = DAYS_SHORT[lang]   ?? DAYS_SHORT.tr;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  let weekSessions = 0, weekSets = 0, exerciseSet = new Set();
  Object.entries(logs).forEach(([exName, sessions]) => {
    sessions.forEach(s => {
      const d = new Date(s.date);
      if (d >= weekStart) { weekSessions++; weekSets += s.sets?.length ?? 0; exerciseSet.add(exName); }
    });
  });

  const totalLogs = Object.values(logs).reduce((acc, arr) => acc + arr.length, 0);
  const dayName   = days[new Date().getDay()];
  const dateStr   = `${new Date().getDate()} ${months[new Date().getMonth()]}`;

  // Bugünkü antrenman — aktif programa göre
  const todayWorkout = getWorkoutForDay(new Date(), program);
  const todayMeta    = todayWorkout ? workoutMeta(todayWorkout.name_en || todayWorkout.name) : null;

  function fmtWhen(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (diff === 0) return t('today', lang);
    if (diff === 1) return t('yesterday', lang);
    return `${diff}${t('daysAgo', lang)}`;
  }

  return (
    <ScrollView style={s.fill} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Selamlama */}
      <Animated.View entering={FadeInDown.duration(450)} style={s.greetWrap}>
        <Text style={s.greetSub}>{greeting(lang)}, {dayName} · {dateStr}</Text>
        <Text style={s.greetTitle}>{profile?.name ?? t('athlete', lang)} 👋</Text>
      </Animated.View>

      {/* Bugünkü antrenman */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        {!program ? (
          /* ─ Kilit: aktif program yok ─ */
          <TouchableOpacity onPress={() => navigation.navigate('Egzersizler')} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
              style={[s.todayCard, { borderColor: C.border, borderStyle: 'dashed' }]}>
              <View style={s.todayHeader}>
                <Ionicons name="lock-closed-outline" size={22} color={C.dim} />
                <Text style={[s.todayType, { color: C.dim }]}>
                  {t('noProgramSelected', lang)}
                </Text>
              </View>
              <Text style={s.todayLabel}>{t('todayWorkout', lang)}</Text>
              <Text style={[s.todaySub, { color: C.muted }]}>
                {t('activateProgramHint', lang)}
              </Text>
              <View style={s.lockHint}>
                <Ionicons name="arrow-forward" size={13} color={C.lime} />
                <Text style={s.lockHintTxt}>{t('chooseProgram', lang)}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : todayWorkout ? (
          /* ─ Aktif program + bugün antrenman var — tap ile Program'ı aç ─ */
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Program', { focusDay: new Date().getDay() })}
          >
            <LinearGradient colors={[todayMeta.color + '22', todayMeta.color + '08']}
              style={[s.todayCard, { borderColor: todayMeta.color + '44' }]}>
              <View style={s.todayHeader}>
                <Ionicons name={todayMeta.icon} size={22} color={todayMeta.color} />
                <Text style={[s.todayType, { color: todayMeta.color }]}>
                  {lang === 'en' && todayWorkout.name_en ? todayWorkout.name_en : todayWorkout.name}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={todayMeta.color + '88'} />
              </View>
              <Text style={s.todayLabel}>{t('todayWorkout', lang)}</Text>
              {/* Egzersiz listesi — temiz isimler, alt alta */}
              {(todayWorkout.exercises || []).map((e, i) => {
                const raw = typeof e === 'string' ? e : e.name;
                // set/rep ve RIR bilgisini at, sadece hareket adı
                const name = raw.replace(/\s+\d+[×x].+/, '').replace(/\s+(RIR|Failure|Superset|Süperset|Finisher).+/i, '').trim();
                return (
                  <Text key={i} style={s.todayExLine}>• {name}</Text>
                );
              })}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          /* ─ Aktif program var ama bugün dinlenme günü ─ */
          <LinearGradient colors={[C.muted + '22', C.muted + '08']}
            style={[s.todayCard, { borderColor: C.border }]}>
            <View style={s.todayHeader}>
              <Ionicons name="moon-outline" size={22} color={C.muted} />
              <Text style={[s.todayType, { color: C.muted }]}>{t('rest', lang)}</Text>
            </View>
            <Text style={s.todayLabel}>{t('todayWorkout', lang)}</Text>
            <Text style={s.todaySub}>{t('restDay', lang)} 🛌</Text>
          </LinearGradient>
        )}
      </Animated.View>

      {/* Bu hafta aktivitesi */}
      <Animated.View entering={FadeInDown.delay(160).duration(400)} style={s.sectionCard}>
        <Text style={s.sectionTitle}>{t('thisWeek', lang)}</Text>
        <ActivityWeek logs={logs} program={program} lang={lang} navigation={navigation} />
      </Animated.View>

      {/* İstatistikler */}
      <Animated.View entering={FadeInDown.delay(220).duration(400)}>
        <Text style={s.sectionTitle}>{t('stats', lang)}</Text>
        <View style={s.statsGrid}>
          <StatCard icon="barbell-outline"  value={weekSessions}     label={t('weekSessions', lang)}   color={C.lime}   delay={240} />
          <StatCard icon="layers-outline"   value={weekSets}         label={t('weekSets', lang)}        color={C.teal}   delay={300} />
          <StatCard icon="fitness-outline"  value={exerciseSet.size} label={t('diffExercises', lang)}   color={C.blue}   delay={360} />
          <StatCard icon="trophy-outline"   value={totalLogs}        label={t('totalSessions', lang)}   color={C.orange} delay={420} />
        </View>
      </Animated.View>

      {/* Son antrenmanlar */}
      {Object.keys(logs).length > 0 && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={s.sectionCard}>
          <Text style={s.sectionTitle}>{t('recentLogs', lang)}</Text>
          {Object.entries(logs)
            .flatMap(([ex, sessions]) => sessions.slice(0, 1).map(ss => ({ ex, ...ss })))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5)
            .map((item, i) => {
              const setsStr = item.sets ? `${item.sets.length} set · ${item.sets[0]?.kg ?? 0}kg` : '';
              return (
                <Animated.View key={i} entering={FadeInRight.delay(i * 60).duration(350)} style={s.recentRow}>
                  <View style={s.recentDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentEx}>{item.ex}</Text>
                    <Text style={s.recentSets}>{setsStr}</Text>
                  </View>
                  <Text style={s.recentWhen}>{fmtWhen(item.date)}</Text>
                </Animated.View>
              );
            })}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill:       { flex: 1, backgroundColor: C.bg },
  content:    { padding: 16, paddingBottom: 32 },

  greetWrap:  { marginBottom: 20, paddingTop: 8 },
  greetSub:   { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  greetTitle: { color: C.text,  fontSize: 26, fontWeight: '900' },

  todayCard:   { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 16 },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  todayType:   { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, flex: 1 },
  todayLabel:  { color: C.muted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  todaySub:    { color: C.text, fontSize: 13, lineHeight: 20 },
  todayExLine: { color: C.text, fontSize: 12, lineHeight: 20, marginTop: 1 },
  lockHint:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  lockHintTxt: { color: C.lime, fontSize: 12, fontWeight: '700' },

  sectionCard:  { backgroundColor: C.s1, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 14 },

  activityRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  activityDay:     { alignItems: 'center', gap: 6 },
  activityDot:     { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activityDayLabel:{ color: C.dim, fontSize: 10, fontWeight: '600' },

  statsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard:   { flex: 1, minWidth: '44%', backgroundColor: C.s1, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center', gap: 6 },
  statIcon:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue:  { color: C.text,  fontSize: 24, fontWeight: '900' },
  statLabel:  { color: C.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },

  recentRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
  recentDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.lime },
  recentEx:   { color: C.text,  fontSize: 13, fontWeight: '700' },
  recentSets: { color: C.muted, fontSize: 11, marginTop: 1 },
  recentWhen: { color: C.dim,   fontSize: 11 },
});
