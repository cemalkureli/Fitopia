/**
 * RulerPicker — yatay cetvel kaydırıcı
 * Kilo / Boy seçimi için. Merkezdeki çizgi seçili değeri gösterir.
 */
import React, { useRef, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Dimensions } from 'react-native';
import { C } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const ITEM_W  = 8;   // her tick arası piksel
const CENTER  = Math.floor(SCREEN_W / 2);

export default function RulerPicker({
  value,
  onChange,
  min = 30,
  max = 250,
  step = 1,
  unit = '',
  color = C.lime,
}) {
  const listRef  = useRef(null);
  const isScrolling = useRef(false);

  // Veriden offset hesapla
  const valueToOffset = (v) => ((v - min) / step) * ITEM_W;

  // Offset'ten değer hesapla
  const offsetToValue = (offset) => {
    const raw = Math.round(offset / ITEM_W) * step + min;
    return Math.max(min, Math.min(max, raw));
  };

  const ticks = [];
  for (let v = min; v <= max; v += step) ticks.push(v);

  const handleScrollEnd = useCallback((e) => {
    const offset = e.nativeEvent.contentOffset.x;
    const newVal = offsetToValue(offset);
    onChange(newVal);
    isScrolling.current = false;
  }, [min, max, step]);

  const renderTick = ({ item: v, index }) => {
    const isMajor  = index % 5 === 0;
    const isCenter = v === value;
    return (
      <View style={[r.tick, isMajor ? r.tickMajor : r.tickMinor]}>
        {isMajor && (
          <Text style={[r.tickLabel, isCenter && { color }]}>{v}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={r.wrap}>
      {/* Üst değer göstergesi */}
      <View style={r.valueRow}>
        <Text style={[r.value, { color }]}>{value}</Text>
        <Text style={r.unit}> {unit}</Text>
      </View>

      {/* Cetvel */}
      <View style={r.rulerWrap}>
        {/* Merkez çizgisi */}
        <View style={[r.centerLine, { backgroundColor: color }]} pointerEvents="none" />

        <FlatList
          ref={listRef}
          data={ticks}
          keyExtractor={(v) => String(v)}
          renderItem={renderTick}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_W}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: CENTER - ITEM_W / 2 }}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          getItemLayout={(_, i) => ({ length: ITEM_W, offset: ITEM_W * i, index: i })}
          initialScrollIndex={Math.floor((value - min) / step)}
        />
      </View>
    </View>
  );
}

const r = StyleSheet.create({
  wrap:       { marginVertical: 8 },
  valueRow:   { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 12 },
  value:      { fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  unit:       { color: C.muted, fontSize: 18, fontWeight: '700' },
  rulerWrap:  { height: 70, position: 'relative' },
  centerLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, zIndex: 1 },
  tick:       { width: ITEM_W, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 },
  tickMajor:  { height: 40, borderLeftWidth: 1.5, borderLeftColor: C.muted + '88' },
  tickMinor:  { height: 22, borderLeftWidth: 1, borderLeftColor: C.s3 },
  tickLabel:  { color: C.dim, fontSize: 10, fontWeight: '600', marginTop: 4, transform: [{ translateX: -8 }] },
});
