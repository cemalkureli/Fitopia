/**
 * RulerPicker — yatay cetvel kaydırıcı (ScrollView tabanlı).
 * Merkezdeki çizgi seçili değeri gösterir. Dışarıdan `value` değişince
 * (ör. altındaki cm/ft veya kg/lb metin girişi ile senkron) otomatik olarak
 * o değere kayar.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { C } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const ITEM_W = 8;
const CENTER = Math.floor(SCREEN_W / 2);

export default function RulerPicker({
  value, onChange, min = 30, max = 250, step = 1, unit = '', color = C.lime,
}) {
  const scrollRef = useRef(null);
  const lastEmitted = useRef(value);

  const ticks = [];
  for (let v = min; v <= max; v += step) ticks.push(Math.round(v / step) * step);

  const valueToOffset = (v) => ((v - min) / step) * ITEM_W;
  const offsetToValue = (offset) => {
    const raw = Math.round(offset / ITEM_W) * step + min;
    return Math.max(min, Math.min(max, Math.round(raw / step) * step));
  };

  // Dışarıdan value değişince o konuma kay
  useEffect(() => {
    if (value === lastEmitted.current) return;
    scrollRef.current?.scrollTo({ x: valueToOffset(value), animated: true });
    lastEmitted.current = value;
  }, [value]);

  // İlk mount
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: valueToOffset(value), animated: false });
  }, []);

  const handleEnd = useCallback((e) => {
    const v = offsetToValue(e.nativeEvent.contentOffset.x);
    lastEmitted.current = v;
    if (v !== value) onChange(v);
  }, [value, onChange, min, max, step]);

  return (
    <View style={r.wrap}>
      <View style={r.valueRow}>
        <Text style={[r.value, { color }]}>{value}</Text>
        <Text style={r.unit}> {unit}</Text>
      </View>

      <View style={r.rulerWrap}>
        <View style={[r.centerLine, { backgroundColor: color }]} pointerEvents="none" />
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_W}
          decelerationRate="fast"
          nestedScrollEnabled
          onMomentumScrollEnd={handleEnd}
          onScrollEndDrag={handleEnd}
          contentContainerStyle={{ paddingHorizontal: CENTER - ITEM_W / 2 }}
        >
          {ticks.map((v, index) => {
            const isMajor = index % 5 === 0;
            const isCenter = v === value;
            return (
              <View key={String(v)} style={[r.tick, isMajor ? r.tickMajor : r.tickMinor]}>
                {isMajor && <Text style={[r.tickLabel, isCenter && { color }]}>{v}</Text>}
              </View>
            );
          })}
        </ScrollView>
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
