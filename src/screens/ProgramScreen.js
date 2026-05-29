import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Dimensions, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import ExerciseMedia from '../components/ExerciseMedia';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { C } from '../utils/theme';
import { getBarfiksReps, saveWorkoutSession, getAllWorkoutLogs } from '../utils/storage';

const { width } = Dimensions.get('window');

const TERIMLER = {
  'RIR1':     'RIR = Reps In Reserve (Kasada Kalan Tekrar)\nRIR1 → Sete biterken hâlâ 1 tekrar yapabileceksin. Kontrollü yorgunluk. Kas büyümesi için ideal.',
  'RIR2':     'RIR2 → Sete biterken 2 tekrar yapabileceksin. Daha hafif, form öğrenmek için.',
  'Failure':  'Failure (Kas Yetmezliği) → 1 tekrar daha fiziksel olarak imkânsız olana kadar sürdür. Maksimum kas stimülasyonu.',
  'Süperset': 'Süperset → İki hareketi dinlenmeksizin arka arkaya yap. Antrenman süresini kısaltır.',
  'Finisher': 'Finisher → Antrenman sonunda yapılan tamamlayıcı set. Kası tamamen tüketmek için.',
};

const MEDIA_MAP = {
  'Plate Loaded Chest Press':        require('../../assets/exercises/chest-press-machine.webm'),
  'Smith Machine Low Incline Press': require('../../assets/exercises/smith-machine-incline-bench-press.webm'),
  'Chest Fly Machine':               require('../../assets/exercises/pec-deck-fly-machine.webm'),
  'Shoulder Press Machine':          require('../../assets/exercises/shoulder-press-machine.webm'),
  'Lateral Raise':                   require('../../assets/exercises/dumbbell-lateral-raise.webm'),
  'Triceps Pushdown':                require('../../assets/exercises/cable-push-down.webm'),
  'Overhead Rope Extension':         require('../../assets/exercises/cable-overhead-tricep-extension.webm'),
  'Cable Crunch':                    require('../../assets/exercises/crunch.webm'),
  '*Finisher: Cable Crunch':         require('../../assets/exercises/crunch.webm'),
  'Lat Pulldown':                    require('../../assets/exercises/lat-pull-down.webm'),
  'Plate Loaded Wide Grip Row':      require('../../assets/exercises/high-row-machine.webm'),
  'Cable Row':                       require('../../assets/exercises/seated-cable-row.webm'),
  'Incline Dumbbell Curl':           require('../../assets/exercises/incline-dumbbell-curl.webm'),
  'Cable Curl':                      require('../../assets/exercises/cable-curl.webm'),
  'Hammer Curl':                     require('../../assets/exercises/dumbbell-hammer-curl.webm'),
  'Leg Press':                       require('../../assets/exercises/leg-press.webm'),
  'Smith Machine Squat':             require('../../assets/exercises/smith-machine-squat.webm'),
  'Leg Extension':                   require('../../assets/exercises/leg-extension.webm'),
  'Seated Leg Curl':                 require('../../assets/exercises/seated-leg-curl.webm'),
  'Wrist Curl':                      require('../../assets/exercises/barbell-wrist-curl.webm'),
  'Reverse Wrist Curl':              require('../../assets/exercises/reverse-barbell-wrist-curl.webm'),
  'Romanian Deadlift':               require('../../assets/exercises/romanian-deadlift.webm'),
  'Cable Rear Delt Fly':             require('../../assets/exercises/cable-reverse-fly.webm'),
};

const GUNLER = [
  { gun:'Pazartesi', tip:'DİNLENME',    renk:C.muted,   emoji:'🛌', hareketler:['Vakum hareketi 3×15 sn','Ev içi yürüyüş (öğünler sonrası 1000 adım × 3)'] },
  { gun:'Salı',      tip:'PUSH',        renk:C.lime,    emoji:'💪', hareketler:['Plate Loaded Chest Press 2×5-6 RIR1','Smith Machine Low Incline Press 2×5-6 RIR1','Chest Fly Machine 1×6-8 Failure','Shoulder Press Machine 2×6-8 RIR1','Lateral Raise 3×8-10 Failure','Triceps Pushdown 2×6-8 Failure','Overhead Rope Extension 2×8-10 Failure','*Finisher: Cable Crunch 3×10'] },
  { gun:'Çarşamba',  tip:'PULL',        renk:C.blue,    emoji:'🔵', hareketler:['Lat Pulldown 2×6-8 RIR1-Failure','Plate Loaded Wide Grip Row 3×6-8 RIR1-Failure','Cable Row 1×8-10 Failure','Incline Dumbbell Curl 2×6-8 Failure','Cable Curl 2×6-8 Failure','Hammer Curl + Reverse Barbell Curl 2×8-10 (Süperset)'] },
  { gun:'Perşembe',  tip:'LEG + ÖN KOL', renk:C.orange, emoji:'🦵', hareketler:['Leg Press 2×6-8 RIR1-2','Smith Machine Squat 2×6-8 RIR1-2','Leg Extension 2×8-10 Failure','Seated Leg Curl 3×8-10 RIR1','Wrist Curl 3×12-15 Failure','Reverse Wrist Curl 3×12-15 Failure','Cable Crunch 3×12-15'] },
  { gun:'Cuma',      tip:'DİNLENME',    renk:C.muted,   emoji:'🛌', hareketler:['Vakum hareketi 3×15 sn','Ev içi yürüyüş (öğünler sonrası 1000 adım × 3)'] },
  { gun:'Cumartesi', tip:'PUSH',        renk:C.lime,    emoji:'💪', hareketler:['Shoulder Press Machine 2×6-8 RIR1','Lateral Raise 3×8-10 Failure','Smith Machine Low Incline Press 2×5-6 RIR1','Chest Fly Machine 2×6-8 Failure','Cable Rear Delt Fly 2×8-10 Failure','Triceps Pushdown 2×6-8 Failure','Overhead Rope Extension 2×8-10 Failure'] },
  { gun:'Pazar',     tip:'PULL+',       renk:C.blue,    emoji:'🔵', hareketler:['Plate Loaded Wide Grip Row 3×6-8 RIR1-Failure','Lat Pulldown 3×6-8 RIR1-Failure','Romanian Deadlift 2×5-6 RIR1-2','Cable Curl 2×6-8 Failure','Hammer Curl + Reverse Curl 2×8-10 (Süperset)','Leg Extension 2×6-8 Failure','Seated Leg Curl 1×8-10 Failure'] },
];

function extractExName(hareket) {
  let h = hareket.replace(/^\*Finisher:\s*/i, '');
  const m = h.match(/^(.*?)\s+\d+[×x]/);
  return m ? m[1].trim() : null;
}

function getMedia(h) {
  for (const k of Object.keys(MEDIA_MAP)) {
    if (h.startsWith(k)) return MEDIA_MAP[k];
  }
  return null;
}

function fmtDate(iso) {
  const d = new Date(iso), now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Dün';
  if (diff < 7)  return `${diff}g önce`;
  const M = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  return `${d.getDate()} ${M[d.getMonth()]}`;
}

function fmtSets(sets) {
  if (!sets?.length) return '';
  const kgs = [...new Set(sets.map(s => s.kg))];
  const kg  = kgs.length === 1 ? `${kgs[0]}kg` : `${sets[0].kg}-${sets[sets.length-1].kg}kg`;
  return `${sets.length}×${sets[0].reps} @${kg}`;
}

// ─── TerimPill ────────────────────────────────────────────────────────────────
function TerimPill({ terim }) {
  const [open, setOpen] = useState(false);
  const aciklama = TERIMLER[terim];
  if (!aciklama) return <Text style={s.terimPlain}>{terim}</Text>;
  return (
    <>
      <TouchableOpacity style={s.terimPill} onPress={() => setOpen(true)}>
        <Text style={s.terimPillText}>{terim}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <Animated.View entering={FadeIn.duration(200)} style={s.terimModal}>
            <Text style={s.terimModalTitle}>{terim}</Text>
            <Text style={s.terimModalBody}>{aciklama}</Text>
            <TouchableOpacity style={s.terimModalClose} onPress={() => setOpen(false)}>
              <Text style={{ color: C.bg, fontWeight: '700' }}>Tamam</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── HareketRow ───────────────────────────────────────────────────────────────
function HareketRow({ hareket, onPressGif, onPressLog, lastSet }) {
  const terimler = Object.keys(TERIMLER);
  const gif      = getMedia(hareket);
  const exName   = extractExName(hareket);
  const parts    = [];
  let remaining  = hareket;
  let safe = 0;
  while (remaining.length > 0 && safe++ < 50) {
    let pos = Infinity, found = null;
    for (const t of terimler) {
      const i = remaining.indexOf(t);
      if (i !== -1 && i < pos) { pos = i; found = t; }
    }
    if (!found) { parts.push({ type: 'text', val: remaining }); break; }
    if (pos > 0) parts.push({ type: 'text', val: remaining.slice(0, pos) });
    parts.push({ type: 'terim', val: found });
    remaining = remaining.slice(pos + found.length);
  }

  return (
    <View style={s.hareketRow}>
      <View style={s.hareketBulletWrap}><View style={s.hareketBullet} /></View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          {parts.map((p, i) => p.type === 'terim'
            ? <TerimPill key={i} terim={p.val} />
            : <Text key={i} style={s.hareketText}>{p.val}</Text>
          )}
        </View>
        {lastSet && <Text style={s.lastSetText}>↩ {lastSet}</Text>}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
        {gif && (
          <TouchableOpacity onPress={() => onPressGif(hareket, gif)} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="play-circle-outline" size={18} color={C.lime} />
          </TouchableOpacity>
        )}
        {exName && (
          <TouchableOpacity onPress={() => onPressLog(exName)} style={s.logBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="add" size={16} color={C.teal} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── GUN KARTI ────────────────────────────────────────────────────────────────
function GunKarti({ g, index, workoutLogs, onPressGif, onPressLog }) {
  const [open, setOpen] = useState(false);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(380)}>
      <TouchableOpacity
        style={[s.card, open && { borderColor: g.renk + '66' }]}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.85}
      >
        <View style={[s.cardBar, { backgroundColor: g.renk }]} />
        <View style={s.cardHeader}>
          <Text style={s.cardEmoji}>{g.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.cardDay}>{g.gun}</Text>
            <View style={[s.tipBadge, { backgroundColor: g.renk + '20' }]}>
              <Text style={[s.tipText, { color: g.renk }]}>{g.tip}</Text>
            </View>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.dim} />
        </View>

        {open && (
          <View style={s.hareketList}>
            {g.hareketler.map((h, j) => {
              const exName  = extractExName(h);
              const hist    = exName ? (workoutLogs[exName] || []) : [];
              const lastSet = hist[0] ? `${fmtSets(hist[0].sets)} · ${fmtDate(hist[0].date)}` : null;
              return (
                <HareketRow
                  key={j}
                  hareket={h}
                  onPressGif={onPressGif}
                  onPressLog={onPressLog}
                  lastSet={lastSet}
                />
              );
            })}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
export default function ProgramScreen() {
  const reps  = getBarfiksReps();
  const [workoutLogs, setWorkoutLogs] = useState({});
  const [gifModal,    setGifModal]    = useState(null); // {name, source}
  const [logModal,    setLogModal]    = useState(null);
  const [logSets,     setLogSets]     = useState([{ reps: '', kg: '' }, { reps: '', kg: '' }, { reps: '', kg: '' }]);

  useFocusEffect(useCallback(() => {
    getAllWorkoutLogs().then(setWorkoutLogs);
  }, []));

  const openGif = (name, source) => setGifModal({ name, source });

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
    const valid = logSets
      .filter(s => s.reps || s.kg)
      .map(s => ({ reps: parseInt(s.reps) || 0, kg: parseFloat(s.kg) || 0 }));
    if (valid.length > 0) {
      await saveWorkoutSession(logModal.name, valid);
      setWorkoutLogs(await getAllWorkoutLogs());
    }
    setLogModal(null);
  };

  const updateSet = (i, field, val) =>
    setLogSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  return (
    <View style={s.fill}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Barfiks bilgi kartı */}
        <Animated.View entering={FadeInDown.duration(350)} style={s.infoCard}>
          <Ionicons name="barbell-outline" size={16} color={C.lime} style={{ marginBottom: 4 }} />
          <Text style={s.infoTitle}>Barfiks: {reps.label} — Günde 8 Seans</Text>
          <Text style={s.infoText}>
            Her seans {reps.sets} set × {reps.reps} tekrar · Toplam: {reps.total}{'\n'}
            Hf1: 3×3 · Hf2: 3×4 · Hf3: 3×5 · Hf4: 3×6
          </Text>
        </Animated.View>

        {/* Terimler bilgi kartı */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} style={[s.infoCard, s.infoCardBlue]}>
          <Text style={[s.infoTitle, { color: C.blue }]}>▶ Video  +  Kayıt  · Terime tıkla</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {Object.keys(TERIMLER).map(t => <TerimPill key={t} terim={t} />)}
          </View>
        </Animated.View>

        {/* Günler */}
        {GUNLER.map((g, i) => (
          <GunKarti
            key={i}
            g={g}
            index={i}
            workoutLogs={workoutLogs}
            onPressGif={openGif}
            onPressLog={openLog}
          />
        ))}
      </ScrollView>

      {/* GIF Modal */}
      {gifModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setGifModal(null)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setGifModal(null)}>
            <Animated.View entering={FadeIn.duration(200)} style={s.gifModal}>
              <Text style={s.gifModalTitle} numberOfLines={2}>{gifModal.name}</Text>
              <View style={s.gifContainer}>
                <ExerciseMedia source={gifModal.source} style={{ width: '100%', height: '100%' }} />
              </View>
              <Text style={s.gifClose}>Kapatmak için dokunun</Text>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Antrenman Kayıt Modalı */}
      {logModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setLogModal(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setLogModal(null)}>
              <TouchableOpacity activeOpacity={1} style={s.logModalBox} onPress={() => {}}>
                <Text style={s.logModalTitle}>{logModal.name}</Text>

                {logModal.lastSession && (
                  <View style={s.prevSessionBox}>
                    <Text style={s.prevLabel}>Önceki oturum</Text>
                    <Text style={s.prevVal}>
                      {fmtDate(logModal.lastSession.date)} — {fmtSets(logModal.lastSession.sets)}
                    </Text>
                  </View>
                )}

                <View style={s.logHeader}>
                  <Text style={[s.logHeaderText, { width: 36 }]}>Set</Text>
                  <Text style={[s.logHeaderText, { flex: 1 }]}>Tekrar</Text>
                  <Text style={[s.logHeaderText, { flex: 1 }]}>Ağırlık (kg)</Text>
                </View>

                {logSets.map((set, i) => (
                  <View key={i} style={s.logRow}>
                    <View style={s.setNumBox}>
                      <Text style={s.setNumText}>{i + 1}</Text>
                    </View>
                    <TextInput
                      style={s.logInput}
                      value={set.reps}
                      onChangeText={v => updateSet(i, 'reps', v)}
                      keyboardType="numeric"
                      placeholder="—"
                      placeholderTextColor={C.dim}
                      maxLength={3}
                    />
                    <TextInput
                      style={s.logInput}
                      value={set.kg}
                      onChangeText={v => updateSet(i, 'kg', v)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={C.dim}
                      maxLength={6}
                    />
                  </View>
                ))}

                <TouchableOpacity style={s.addSetBtn}
                  onPress={() => setLogSets(p => [...p, { reps: '', kg: '' }])}>
                  <Ionicons name="add-circle-outline" size={16} color={C.teal} />
                  <Text style={{ color: C.teal, fontSize: 13, fontWeight: '700', marginLeft: 4 }}>Set Ekle</Text>
                </TouchableOpacity>

                <View style={s.logActions}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setLogModal(null)}>
                    <Text style={{ color: C.muted, fontWeight: '700' }}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.saveBtn} onPress={saveLog}>
                    <LinearGradient colors={['#e8f44a', '#a3c200']} style={s.saveGrad}>
                      <Text style={{ color: C.bg, fontWeight: '900' }}>Kaydet ✓</Text>
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
  fill:       { flex: 1, backgroundColor: C.bg },
  content:    { padding: 16, paddingBottom: 32 },

  infoCard:   { backgroundColor: 'rgba(232,244,74,0.06)', borderWidth: 1, borderColor: 'rgba(232,244,74,0.2)', borderRadius: 16, padding: 14, marginBottom: 12 },
  infoCardBlue: { backgroundColor: 'rgba(56,189,248,0.06)', borderColor: 'rgba(56,189,248,0.2)' },
  infoTitle:  { color: C.lime, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  infoText:   { color: C.muted, fontSize: 12, lineHeight: 18 },

  card:       { backgroundColor: C.s1, borderWidth: 1, borderColor: C.border, borderRadius: 16, marginBottom: 10, overflow: 'hidden' },
  cardBar:    { height: 3, width: '100%' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  cardEmoji:  { fontSize: 20 },
  cardDay:    { color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  tipBadge:   { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tipText:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  hareketList:     { paddingHorizontal: 14, paddingBottom: 14 },
  hareketRow:      { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  hareketBulletWrap: { paddingTop: 6 },
  hareketBullet:   { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.dim },
  hareketText:     { color: '#b0bec5', fontSize: 13, lineHeight: 20 },
  lastSetText:     { color: C.dim, fontSize: 10, marginTop: 2 },
  iconBtn:         { padding: 2 },
  logBtn:          { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(20,184,166,0.15)', borderWidth: 1, borderColor: C.teal, alignItems: 'center', justifyContent: 'center' },

  terimPill:       { backgroundColor: 'rgba(56,189,248,0.15)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.35)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  terimPillText:   { color: C.blue, fontSize: 12, fontWeight: '700' },
  terimPlain:      { color: '#b0bec5', fontSize: 13 },
  terimModal:      { backgroundColor: C.s1, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border, maxWidth: 340, width: '100%' },
  terimModalTitle: { color: C.blue, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  terimModalBody:  { color: C.text, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  terimModalClose: { backgroundColor: C.blue, borderRadius: 10, padding: 12, alignItems: 'center' },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  gifModal:   { backgroundColor: C.s1, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center', width: '100%', maxWidth: 400 },
  gifModalTitle: { color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  gifContainer:  { width: width - 80, height: width - 80, borderRadius: 12, overflow: 'hidden', backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center' },
  gifClose:   { color: C.dim, fontSize: 12, marginTop: 10 },

  logModalBox:  { backgroundColor: C.s1, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: C.border, width: '100%', maxWidth: 400 },
  logModalTitle: { color: C.text, fontSize: 16, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  prevSessionBox: { backgroundColor: 'rgba(232,244,74,0.06)', borderRadius: 12, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(232,244,74,0.2)' },
  prevLabel:  { color: C.muted, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  prevVal:    { color: C.lime,  fontSize: 12, fontWeight: '700' },
  logHeader:  { flexDirection: 'row', gap: 8, marginBottom: 8 },
  logHeaderText: { color: C.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  logRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setNumBox:  { width: 36, height: 36, borderRadius: 18, backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  setNumText: { color: C.lime, fontWeight: '800', fontSize: 12 },
  logInput:   { flex: 1, height: 36, backgroundColor: C.s2, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: C.text, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  addSetBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  logActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn:  { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  saveBtn:    { flex: 2, borderRadius: 12, overflow: 'hidden' },
  saveGrad:   { height: 46, alignItems: 'center', justifyContent: 'center' },
});
