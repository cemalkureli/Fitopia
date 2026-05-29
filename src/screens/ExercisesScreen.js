import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Dimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import ExerciseMedia from '../components/ExerciseMedia';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../utils/theme';

const { width } = Dimensions.get('window');

// Egzersiz kataloğu — kas grubu + kategori etiketleri
const EXERCISES = [
  // Göğüs
  { name:'Barbell Bench Press',          muscle:'Göğüs',   cat:'Göğüs',   gif: require('../../assets/exercises/barbell-bench-press.webm') },
  { name:'Dumbbell Bench Press',         muscle:'Göğüs',   cat:'Göğüs',   gif: require('../../assets/exercises/dumbbell-bench-press.webm') },
  { name:'Incline Dumbbell Bench Press', muscle:'Üst Göğüs', cat:'Göğüs', gif: require('../../assets/exercises/incline-dumbbell-bench-press.webm') },
  { name:'Pec Deck Fly Machine',         muscle:'Göğüs',   cat:'Göğüs',   gif: require('../../assets/exercises/pec-deck-fly-machine.webm') },
  { name:'Chest Press Machine',          muscle:'Göğüs',   cat:'Göğüs',   gif: require('../../assets/exercises/chest-press-machine.webm') },
  { name:'Dumbbell Fly',                 muscle:'Göğüs',   cat:'Göğüs',   gif: require('../../assets/exercises/dumbbell-fly.webm') },
  { name:'Push Up',                      muscle:'Göğüs',   cat:'Göğüs',   gif: require('../../assets/exercises/push-up.webm') },
  { name:'Close Grip Bench Press',       muscle:'Göğüs/Tris', cat:'Göğüs', gif: require('../../assets/exercises/close-grip-bench-press.webm') },
  // Sırt
  { name:'Lat Pull Down',                muscle:'Sırt',    cat:'Sırt',    gif: require('../../assets/exercises/lat-pull-down.webm') },
  { name:'Seated Cable Row',             muscle:'Sırt',    cat:'Sırt',    gif: require('../../assets/exercises/seated-cable-row.webm') },
  { name:'Pull Up',                      muscle:'Sırt',    cat:'Sırt',    gif: require('../../assets/exercises/pull-up.webm') },
  { name:'Dumbbell Row',                 muscle:'Sırt',    cat:'Sırt',    gif: require('../../assets/exercises/dumbbell-row.webm') },
  { name:'High Row Machine',             muscle:'Sırt',    cat:'Sırt',    gif: require('../../assets/exercises/high-row-machine.webm') },
  { name:'Romanian Deadlift',            muscle:'Sırt/Bacak', cat:'Sırt', gif: require('../../assets/exercises/romanian-deadlift.webm') },
  { name:'Conventional Deadlift',        muscle:'Sırt',    cat:'Sırt',    gif: require('../../assets/exercises/conventional-deadlift.webm') },
  { name:'Cable Straight Arm Pulldown',  muscle:'Sırt',    cat:'Sırt',    gif: require('../../assets/exercises/cable-straight-arm-pulldown.webm') },
  // Omuz
  { name:'Shoulder Press Machine',       muscle:'Omuz',    cat:'Omuz',    gif: require('../../assets/exercises/shoulder-press-machine.webm') },
  { name:'Dumbbell Lateral Raise',       muscle:'Omuz',    cat:'Omuz',    gif: require('../../assets/exercises/dumbbell-lateral-raise.webm') },
  { name:'Dumbbell Shoulder Press',      muscle:'Omuz',    cat:'Omuz',    gif: require('../../assets/exercises/dumbbell-shoulder-press.webm') },
  { name:'Cable Lateral Raise',          muscle:'Omuz',    cat:'Omuz',    gif: require('../../assets/exercises/cable-lateral-raise.webm') },
  { name:'Face Pull',                    muscle:'Arka Omuz', cat:'Omuz',  gif: require('../../assets/exercises/face-pull.webm') },
  { name:'Cable Reverse Fly',            muscle:'Arka Omuz', cat:'Omuz',  gif: require('../../assets/exercises/cable-reverse-fly.webm') },
  { name:'Overhead Press',               muscle:'Omuz',    cat:'Omuz',    gif: require('../../assets/exercises/overhead-press.webm') },
  // Kol
  { name:'Cable Curl',                   muscle:'Biceps',  cat:'Kol',     gif: require('../../assets/exercises/cable-curl.webm') },
  { name:'Dumbbell Bicep Curl',          muscle:'Biceps',  cat:'Kol',     gif: require('../../assets/exercises/dumbbell-bicep-curl.webm') },
  { name:'Incline Dumbbell Curl',        muscle:'Biceps',  cat:'Kol',     gif: require('../../assets/exercises/incline-dumbbell-curl.webm') },
  { name:'Dumbbell Hammer Curl',         muscle:'Biceps',  cat:'Kol',     gif: require('../../assets/exercises/dumbbell-hammer-curl.webm') },
  { name:'Cable Push Down',              muscle:'Triceps', cat:'Kol',     gif: require('../../assets/exercises/cable-push-down.webm') },
  { name:'Cable Overhead Tricep Extension', muscle:'Triceps', cat:'Kol',  gif: require('../../assets/exercises/cable-overhead-tricep-extension.webm') },
  { name:'Skull Crusher',                muscle:'Triceps', cat:'Kol',     gif: require('../../assets/exercises/skull-crusher.webm') },
  { name:'Dips',                         muscle:'Triceps', cat:'Kol',     gif: require('../../assets/exercises/dips.webm') },
  // Bacak
  { name:'Back Squat',                   muscle:'Bacak',   cat:'Bacak',   gif: require('../../assets/exercises/back-squat.webm') },
  { name:'Leg Press',                    muscle:'Bacak',   cat:'Bacak',   gif: require('../../assets/exercises/leg-press.webm') },
  { name:'Smith Machine Squat',          muscle:'Bacak',   cat:'Bacak',   gif: require('../../assets/exercises/smith-machine-squat.webm') },
  { name:'Leg Extension',                muscle:'Quadriceps', cat:'Bacak', gif: require('../../assets/exercises/leg-extension.webm') },
  { name:'Seated Leg Curl',              muscle:'Hamstring', cat:'Bacak',  gif: require('../../assets/exercises/seated-leg-curl.webm') },
  { name:'Barbell Hip Thrust',           muscle:'Glute',   cat:'Bacak',   gif: require('../../assets/exercises/barbell-hip-thrust.webm') },
  { name:'Bulgarian Split Squat',        muscle:'Bacak',   cat:'Bacak',   gif: require('../../assets/exercises/barbell-bulgarian-split-squat.webm') },
  { name:'Hack Squat Machine',           muscle:'Bacak',   cat:'Bacak',   gif: require('../../assets/exercises/hack-squat-machine.webm') },
  { name:'Seated Calf Raise',            muscle:'Baldır',  cat:'Bacak',   gif: require('../../assets/exercises/seated-calf-raise.webm') },
  // Core
  { name:'Crunch',                       muscle:'Core',    cat:'Core',    gif: require('../../assets/exercises/crunch.webm') },
  { name:'Leg Raise',                    muscle:'Core',    cat:'Core',    gif: require('../../assets/exercises/leg-raise.webm') },
  { name:'Hanging Knee Raise',           muscle:'Core',    cat:'Core',    gif: require('../../assets/exercises/hanging-knee-raise.webm') },
  { name:'Plank',                        muscle:'Core',    cat:'Core',    gif: require('../../assets/exercises/plank.webm') },
  { name:'Reverse Crunch',               muscle:'Core',    cat:'Core',    gif: require('../../assets/exercises/reverse-crunch.webm') },
  // Cardio
  { name:'Running',                      muscle:'Kardio',  cat:'Kardio',  gif: require('../../assets/exercises/running.webm') },
  { name:'Jump Squat',                   muscle:'Tüm vücut', cat:'Kardio', gif: require('../../assets/exercises/jump-squat.webm') },
  { name:'Burpee',                       muscle:'Tüm vücut', cat:'Kardio', gif: require('../../assets/exercises/burpee.webm') },
  { name:'Mountain Climber',             muscle:'Core/Kardio', cat:'Kardio', gif: require('../../assets/exercises/mountain-climber.webm') },
];

const CATS = ['Tümü', 'Göğüs', 'Sırt', 'Omuz', 'Kol', 'Bacak', 'Core', 'Kardio'];

const CAT_COLOR = {
  'Göğüs':  C.orange,
  'Sırt':   C.blue,
  'Omuz':   C.purple,
  'Kol':    C.teal,
  'Bacak':  C.green,
  'Core':   C.lime,
  'Kardio': C.red,
};

// Satır bileşeni memo ile sarılı — FlatList yeniden render optimizasyonu
const ExerciseRow = memo(({ ex, onPress }) => {
  const color = CAT_COLOR[ex.cat] ?? C.lime;
  return (
    <TouchableOpacity style={s.exRow} onPress={() => onPress(ex)} activeOpacity={0.8}>
      <LinearGradient colors={[color + '33', color + '11']} style={s.thumb}>
        <Text style={[s.thumbLetter, { color }]}>{ex.name[0]}</Text>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={s.exName}>{ex.name}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
          <View style={[s.muscleBadge, { backgroundColor: color + '15' }]}>
            <Text style={[s.muscleText, { color }]}>{ex.muscle}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.dim} />
    </TouchableOpacity>
  );
});

export default function ExercisesScreen() {
  const [search,   setSearch]   = useState('');
  const [cat,      setCat]      = useState('Tümü');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => EXERCISES.filter(ex => {
    const matchCat    = cat === 'Tümü' || ex.cat === cat;
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase()) ||
                        ex.muscle.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [search, cat]);

  const openExercise = useCallback((ex) => setSelected(ex), []);
  const renderItem   = useCallback(({ item }) => <ExerciseRow ex={item} onPress={openExercise} />, [openExercise]);

  const color = selected ? (CAT_COLOR[selected.cat] ?? C.lime) : C.lime;

  return (
    <View style={s.fill}>
      {/* Arama + filtre */}
      <View style={s.header}>
        <Animated.View entering={FadeInDown.duration(300)} style={s.searchWrap}>
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
        </Animated.View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={{ gap: 8 }} nestedScrollEnabled={false}>
          {CATS.map(c => (
            <TouchableOpacity
              key={c}
              style={[s.catBtn, cat === c && { backgroundColor: (CAT_COLOR[c] ?? C.lime) + '20', borderColor: CAT_COLOR[c] ?? C.lime }]}
              onPress={() => setCat(c)}
            >
              <Text style={[s.catText, cat === c && { color: CAT_COLOR[c] ?? C.lime, fontWeight: '700' }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.countText}>{filtered.length} egzersiz</Text>
      </View>

      {/* Liste — FlatList: sadece görünen item'lar render edilir */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.name}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(_, i) => ({ length: 78, offset: 78 * i, index: i })}
      />

      {/* Detay Modal */}
      {selected && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelected(null)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSelected(null)}>
            <Animated.View entering={FadeIn.duration(200)} style={s.detailModal}>
              {/* GIF büyük */}
              <View style={[s.gifContainer, { borderColor: color + '40' }]}>
                <ExerciseMedia source={selected.gif} style={{ width: '100%', height: '100%' }} />
              </View>
              <Text style={s.detailName}>{selected.name}</Text>
              <View style={[s.muscleBadge, { backgroundColor: color + '15', alignSelf: 'center', marginBottom: 16 }]}>
                <Text style={[s.muscleText, { color }]}>{selected.muscle}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={[s.closeBtn, { borderColor: color + '50' }]}>
                <Text style={{ color, fontWeight: '700' }}>Kapat</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fill:    { flex: 1, backgroundColor: C.bg },

  header:  { padding: 16, paddingBottom: 8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.s1, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, marginBottom: 12 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  catScroll:  { marginBottom: 10 },
  catBtn:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1 },
  catText:  { color: C.muted, fontSize: 12, fontWeight: '600' },
  countText: { color: C.dim, fontSize: 11, fontWeight: '600', marginBottom: 4 },

  list:    { paddingHorizontal: 16, paddingBottom: 32 },
  exRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.s1, borderRadius: 14, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  thumb:       { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbLetter: { fontSize: 22, fontWeight: '900' },
  exName:  { color: C.text, fontSize: 13, fontWeight: '700' },
  muscleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  muscleText:  { fontSize: 11, fontWeight: '600' },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  detailModal: { backgroundColor: C.s1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  gifContainer: { width: width - 80, height: width - 80, borderRadius: 16, overflow: 'hidden', backgroundColor: C.s2, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1 },
  detailName:  { color: C.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  closeBtn:    { borderWidth: 1, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12 },
});
