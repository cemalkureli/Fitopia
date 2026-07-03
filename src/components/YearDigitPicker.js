/**
 * YearDigitPicker — 4 haneli "kilit" tarzı yıl girişi.
 * Her hanenin üstünde yukarı, altında aşağı tuşu (0-9, döngüsel).
 * `value` (ör. 1995) dışarıdan gelir; hane değişince onChange(newYear).
 * Yukarıdaki wheel değişince buradaki haneler otomatik güncellenir (controlled).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../utils/theme';

export default function YearDigitPicker({ value, onChange, color = C.lime, invalid = false }) {
  // 4 haneye böl (0-9999 arası varsayılır)
  const digits = String(Math.max(0, Math.min(9999, value || 0))).padStart(4, '0').split('').map(Number);

  const bump = (i, delta) => {
    const next = [...digits];
    next[i] = (next[i] + delta + 10) % 10; // döngüsel 0-9
    onChange(Number(next.join('')));
  };

  const borderCol = invalid ? C.red : color;

  return (
    <View style={s.row}>
      {digits.map((d, i) => (
        <View key={i} style={s.col}>
          <TouchableOpacity onPress={() => bump(i, +1)} hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }} style={s.chevBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-up" size={22} color={C.muted} />
          </TouchableOpacity>
          <View style={[s.box, { borderColor: borderCol + '66' }]}>
            <Text style={[s.digit, { color: invalid ? C.red : C.text }]}>{d}</Text>
          </View>
          <TouchableOpacity onPress={() => bump(i, -1)} hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }} style={s.chevBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={22} color={C.muted} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
  col:     { alignItems: 'center', gap: 4 },
  chevBtn: { padding: 2 },
  box: {
    width: 54, height: 66, borderRadius: 14, borderWidth: 1.5,
    backgroundColor: C.s1, alignItems: 'center', justifyContent: 'center',
  },
  digit:   { fontSize: 34, fontFamily: F.extrabold },
});
