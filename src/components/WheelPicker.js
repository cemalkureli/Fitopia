/**
 * WheelPicker — dikey scroll wheel seçici
 * Doğum yılı ve benzeri değerler için.
 * Ortadaki öğe seçili, üst/alt kademeli soluklaşır.
 */
import React, { useRef, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { C } from '../utils/theme';

const ITEM_H = 60;
const VISIBLE = 5; // görünür öğe sayısı

export default function WheelPicker({ values, value, onChange, color = C.lime }) {
  const listRef = useRef(null);
  const items   = values;
  const centerIdx = items.indexOf(value);

  const handleScrollEnd = useCallback((e) => {
    const offset = e.nativeEvent.contentOffset.y;
    const idx    = Math.round(offset / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    onChange(items[clamped]);
  }, [items]);

  const renderItem = ({ item, index }) => {
    const dist = Math.abs(index - (items.indexOf(value)));
    const opacity = dist === 0 ? 1 : dist === 1 ? 0.5 : dist === 2 ? 0.25 : 0.08;
    const scale   = dist === 0 ? 1 : dist === 1 ? 0.85 : 0.7;
    const isActive = item === value;
    return (
      <View style={[wp.item, isActive && wp.itemActive]}>
        <Text style={[wp.itemTxt, { opacity, transform: [{ scale }] }, isActive && { color, fontWeight: '900' }]}>
          {item}
        </Text>
      </View>
    );
  };

  return (
    <View style={wp.wrap}>
      {/* Seçim highlight */}
      <View style={[wp.highlight, { borderColor: color + '44' }]} pointerEvents="none" />

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(v) => String(v)}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        initialScrollIndex={Math.max(0, centerIdx)}
        style={{ height: ITEM_H * VISIBLE }}
      />
    </View>
  );
}

const wp = StyleSheet.create({
  wrap:       { position: 'relative', alignItems: 'center' },
  highlight:  { position: 'absolute', top: '50%', left: 0, right: 0, height: ITEM_H,
                marginTop: -ITEM_H / 2, borderTopWidth: 1, borderBottomWidth: 1,
                borderColor: C.lime, zIndex: 1 },
  item:       { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemActive: {},
  itemTxt:    { color: C.text, fontSize: 32, fontWeight: '700' },
});
