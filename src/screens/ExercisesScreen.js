import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Dimensions, Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import ExerciseMedia from '../components/ExerciseMedia';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../utils/theme';
import { EXERCISE_URLS } from '../utils/exerciseUrls';

const { width } = Dimensions.get('window');

const EXERCISES = [
  { name:'Barbell Bench Press',             muscle:'Göğüs',      cat:'Göğüs'  },
  { name:'Dumbbell Bench Press',            muscle:'Göğüs',      cat:'Göğüs'  },
  { name:'Incline Dumbbell Bench Press',    muscle:'Üst Göğüs',  cat:'Göğüs'  },
  { name:'Pec Deck Fly Machine',            muscle:'Göğüs',      cat:'Göğüs'  },
  { name:'Chest Press Machine',             muscle:'Göğüs',      cat:'Göğüs'  },
  { name:'Dumbbell Fly',                    muscle:'Göğüs',      cat:'Göğüs'  },
  { name:'Push Up',                         muscle:'Göğüs',      cat:'Göğüs'  },
  { name:'Close Grip Bench Press',          muscle:'Göğüs/Tris', cat:'Göğüs'  },
  { name:'Lat Pull Down',                   muscle:'Sırt',       cat:'Sırt'   },
  { name:'Seated Cable Row',                muscle:'Sırt',       cat:'Sırt'   },
  { name:'Pull Up',                         muscle:'Sırt',       cat:'Sırt'   },
  { name:'Dumbbell Row',                    muscle:'Sırt',       cat:'Sırt'   },
  { name:'High Row Machine',                muscle:'Sırt',       cat:'Sırt'   },
  { name:'Romanian Deadlift',               muscle:'Sırt/Bacak', cat:'Sırt'   },
  { name:'Conventional Deadlift',           muscle:'Sırt',       cat:'Sırt'   },
  { name:'Cable Straight Arm Pulldown',     muscle:'Sırt',       cat:'Sırt'   },
  { name:'Shoulder Press Machine',          muscle:'Omuz',       cat:'Omuz'   },
  { name:'Dumbbell Lateral Raise',          muscle:'Omuz',       cat:'Omuz'   },
  { name:'Dumbbell Shoulder Press',         muscle:'Omuz',       cat:'Omuz'   },
  { name:'Cable Lateral Raise',             muscle:'Omuz',       cat:'Omuz'   },
  { name:'Face Pull',                       muscle:'Arka Omuz',  cat:'Omuz'   },
  { name:'Cable Reverse Fly',               muscle:'Arka Omuz',  cat:'Omuz'   },
  { name:'Overhead Press',                  muscle:'Omuz',       cat:'Omuz'   },
  { name:'Cable Curl',                      muscle:'Biceps',     cat:'Kol'    },
  { name:'Dumbbell Bicep Curl',             muscle:'Biceps',     cat:'Kol'    },
  { name:'Incline Dumbbell Curl',           muscle:'Biceps',     cat:'Kol'    },
  { name:'Dumbbell Hammer Curl',            muscle:'Biceps',     cat:'Kol'    },
  { name:'Cable Push Down',                 muscle:'Triceps',    cat:'Kol'    },
  { name:'Cable Overhead Tricep Extension', muscle:'Triceps',    cat:'Kol'    },
  { name:'Skull Crusher',                   muscle:'Triceps',    cat:'Kol'    },
  { name:'Dips',                            muscle:'Triceps',    cat:'Kol'    },
  { name:'Back Squat',                      muscle:'Bacak',      cat:'Bacak'  },
  { name:'Leg Press',                       muscle:'Bacak',      cat:'Bacak'  },
  { name:'Smith Machine Squat',             muscle:'Bacak',      cat:'Bacak'  },
  { name:'Leg Extension',                   muscle:'Quadriceps', cat:'Bacak'  },
  { name:'Seated Leg Curl',                 muscle:'Hamstring',  cat:'Bacak'  },
  { name:'Barbell Hip Thrust',              muscle:'Glute',      cat:'Bacak'  },
  { name:'Bulgarian Split Squat',           muscle:'Bacak',      cat:'Bacak'  },
  { name:'Hack Squat Machine',              muscle:'Bacak',      cat:'Bacak'  },
  { name:'Seated Calf Raise',               muscle:'Baldır',     cat:'Bacak'  },
  { name:'Crunch',                          muscle:'Core',       cat:'Core'   },
  { name:'Leg Raise',                       muscle:'Core',       cat:'Core'   },
  { name:'Hanging Knee Raise',              muscle:'Core',       cat:'Core'   },
  { name:'Plank',                           muscle:'Core',       cat:'Core'   },
  { name:'Reverse Crunch',                  muscle:'Core',       cat:'Core'   },
  { name:'Running',                         muscle:'Kardio',     cat:'Kardio' },
  { name:'Jump Squat',                      muscle:'Tüm vücut',  cat:'Kardio' },
  { name:'Burpee',                          muscle:'Tüm vücut',  cat:'Kardio' },
  { name:'Mountain Climber',                muscle:'Core/Kardio',cat:'Kardio' },
].map(ex => ({ ...ex, url: EXERCISE_URLS[ex.name] ?? null }));

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

  const openExercise   = useCallback((ex) => setSelected(ex), []);
  const renderItem     = useCallback(({ item }) => <ExerciseRow ex={item} onPress={openExercise} />, [openExercise]);
  const renderCatItem  = useCallback(({ item: c }) => (
    <TouchableOpacity
      style={[s.catBtn, cat === c && { backgroundColor: (CAT_COLOR[c] ?? C.lime) + '20', borderColor: CAT_COLOR[c] ?? C.lime }]}
      onPress={() => setCat(c)}
    >
      <Text style={[s.catText, cat === c && { color: CAT_COLOR[c] ?? C.lime, fontWeight: '700' }]}>{c}</Text>
    </TouchableOpacity>
  ), [cat]);

  const color = selected ? (CAT_COLOR[selected.cat] ?? C.lime) : C.lime;

  return (
    <View style={s.fill}>
      {/* Arama */}
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

      {/* Kategori filtresi — FlatList horizontal (ScrollView kullanmıyoruz) */}
      <FlatList
        data={CATS}
        keyExtractor={c => c}
        renderItem={renderCatItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.catList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      />

      {/* Sayaç */}
      <Text style={s.countText}>{filtered.length} egzersiz</Text>

      {/* Ana liste */}
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
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Detay Modal */}
      {selected && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelected(null)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSelected(null)}>
            <Animated.View entering={FadeIn.duration(200)} style={s.detailModal}>
              {/* GIF büyük */}
              <View style={[s.gifContainer, { borderColor: color + '40' }]}>
                <ExerciseMedia source={selected.url} style={{ width: '100%', height: '100%' }} />
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
  fill:       { flex: 1, backgroundColor: C.bg },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.s1, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 46, margin: 16, marginBottom: 10 },
  searchInput:{ flex: 1, color: C.text, fontSize: 14 },
  catList:    { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  catBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.s1 },
  catText:    { color: C.muted, fontSize: 12, fontWeight: '600' },
  countText:  { color: C.dim, fontSize: 11, fontWeight: '600', paddingHorizontal: 16, marginBottom: 4 },

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
