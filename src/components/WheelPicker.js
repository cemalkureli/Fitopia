/**
 * WheelPicker — dikey scroll wheel seçici (ScrollView tabanlı).
 * FlatList YERİNE ScrollView kullanır → "VirtualizedLists should never be
 * nested inside plain ScrollViews" hatasını tamamen ortadan kaldırır.
 * Dışarıdan `value` değişince (ör. altındaki digit spinner ile senkron)
 * otomatik olarak o değere kayar.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { C } from '../utils/theme';

const ITEM_H = 60;
const VISIBLE = 5;

export default function WheelPicker({ values, value, onChange, color = C.lime }) {
  const scrollRef = useRef(null);
  const items = values;
  const idx = Math.max(0, items.indexOf(value));
  const lastEmitted = useRef(value);
  const isDragging = useRef(false);

  // Dışarıdan value değişince (kendi scroll'umuz değilse) o konuma kay
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const i = items.indexOf(value);
    if (i < 0) return;
    scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
    lastEmitted.current = value;
  }, [value, items]);

  // İlk mount'ta doğru konuma
  useEffect(() => {
    const i = items.indexOf(value);
    if (i >= 0) scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: false });
  }, []);

  const handleEnd = useCallback((e) => {
    const offset = e.nativeEvent.contentOffset.y;
    const i = Math.round(offset / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    const v = items[clamped];
    lastEmitted.current = v;
    isDragging.current = false;
    if (v !== value) onChange(v);
  }, [items, value, onChange]);

  return (
    <View style={wp.wrap}>
      <View style={[wp.highlight, { borderColor: color + '55' }]} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        onScrollBeginDrag={() => { isDragging.current = true; }}
        onMomentumScrollEnd={handleEnd}
        onScrollEndDrag={handleEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
        style={{ height: ITEM_H * VISIBLE }}
      >
        {items.map((item) => {
          const dist = Math.abs(items.indexOf(item) - idx);
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.25 : 0.08;
          const scale = dist === 0 ? 1 : dist === 1 ? 0.85 : 0.7;
          const isActive = item === value;
          return (
            <View key={String(item)} style={wp.item}>
              <Text style={[wp.itemTxt, { opacity, transform: [{ scale }] }, isActive && { color, fontWeight: '900' }]}>
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const wp = StyleSheet.create({
  wrap:      { position: 'relative', alignItems: 'center' },
  highlight: { position: 'absolute', top: '50%', left: 0, right: 0, height: ITEM_H,
               marginTop: -ITEM_H / 2, borderTopWidth: 1, borderBottomWidth: 1, zIndex: 1 },
  item:      { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemTxt:   { color: C.text, fontSize: 32, fontWeight: '700' },
});
