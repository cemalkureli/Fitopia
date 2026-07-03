/**
 * SyncedUnitField — cetvel (slider) ile senkron çalışan birim girişi.
 * - Üstte iki birim (ör. cm/ft veya kg/lb) canlı okuma gösterir.
 * - Alttaki toggle ile giriş birimi seçilir, metin kutusuna yazılır.
 * - Geçerli (min–max) değer yazılınca base güncellenir → slider oynar.
 * - Aralık dışı/saçma değerde slider DEĞİŞMEZ, satır içi hata gösterilir ve
 *   onValidityChange(true) ile üst ekran "NEXT"i bloklar.
 * - Slider dışarıdan değişince metin otomatik güncellenir (senkron).
 *
 * units: [{ key, label, toBase(x)=>base, fromBase(b)=>string, keyboch }]
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../utils/theme';

export default function SyncedUnitField({
  baseValue, onBase, min, max, units, activeUnit, onUnitChange,
  color = C.lime, invalidMsg, prefUnitLabel, onValidityChange,
  roundBase = Math.round,
}) {
  const active = units.find(u => u.key === activeUnit) ?? units[0];
  const [text, setText] = useState(active.fromBase(baseValue));
  const [invalid, setInvalid] = useState(false);
  const selfUpdate = useRef(false);

  // Slider (base) dışarıdan değişince metni yeniden biçimle — ama kendi
  // yazdığımız değişiklikse dokunma (kullanıcının yazdığını ezmeyelim).
  useEffect(() => {
    if (selfUpdate.current) { selfUpdate.current = false; setInvalid(false); onValidityChange?.(false); return; }
    setText(active.fromBase(baseValue));
    setInvalid(false);
    onValidityChange?.(false);
  }, [baseValue]);

  // Birim değişince metni yeni birime göre biçimle
  useEffect(() => {
    setText(active.fromBase(baseValue));
    setInvalid(false);
    onValidityChange?.(false);
  }, [activeUnit]);

  const handleText = (raw) => {
    const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    setText(cleaned);
    if (cleaned === '' || cleaned === '.') { setInvalid(false); onValidityChange?.(false); return; }
    const n = parseFloat(cleaned);
    if (isNaN(n)) { setInvalid(true); onValidityChange?.(true); return; }
    const base = roundBase(active.toBase(n));
    if (base < min || base > max) { setInvalid(true); onValidityChange?.(true); return; }
    setInvalid(false);
    onValidityChange?.(false);
    if (base !== baseValue) { selfUpdate.current = true; onBase(base); }
  };

  return (
    <View style={s.wrap}>
      {/* Canlı çift-birim okuma */}
      <View style={s.readRow}>
        {units.map((u, i) => (
          <React.Fragment key={u.key}>
            {i > 0 && <Text style={s.readDot}>·</Text>}
            <Text style={[s.readVal, u.key === activeUnit && { color }]}>
              {u.fromBase(baseValue)} {u.label}
            </Text>
          </React.Fragment>
        ))}
      </View>

      {/* Manuel giriş kutusu */}
      <View style={[s.inputRow, { borderColor: invalid ? C.red : color + '55' }]}>
        <Ionicons name="create-outline" size={18} color={invalid ? C.red : C.muted} />
        <TextInput
          style={s.input}
          value={text}
          onChangeText={handleText}
          keyboardType="decimal-pad"
          placeholder={active.fromBase(baseValue)}
          placeholderTextColor={C.dim}
        />
        <Text style={[s.inputUnit, { color: invalid ? C.red : color }]}>{active.label}</Text>
      </View>

      {/* Birim toggle */}
      <View style={s.toggleRow}>
        {units.map(u => {
          const on = u.key === activeUnit;
          return (
            <TouchableOpacity
              key={u.key}
              onPress={() => onUnitChange(u.key)}
              activeOpacity={0.85}
              style={[s.toggleBtn, on && { backgroundColor: color, borderColor: color }]}
            >
              <Text style={[s.toggleTxt, on && { color: C.bg, fontFamily: F.extrabold }]}>{u.label.toUpperCase()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {invalid && <Text style={s.err}>{invalidMsg}</Text>}
      {prefUnitLabel ? (
        <View style={s.hintRow}>
          <Ionicons name="settings-outline" size={12} color={C.dim} />
          <Text style={s.hint}>{prefUnitLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { marginTop: 8 },
  readRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
  readVal:   { color: C.muted, fontSize: 15, fontFamily: F.bold },
  readDot:   { color: C.dim, fontSize: 15 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.s1, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, height: 54 },
  input:     { flex: 1, color: C.text, fontSize: 18, fontFamily: F.bold, letterSpacing: 0.5 },
  inputUnit: { fontSize: 15, fontFamily: F.extrabold },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  toggleBtn: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.s1, alignItems: 'center', justifyContent: 'center' },
  toggleTxt: { color: C.muted, fontSize: 13, fontFamily: F.bold, letterSpacing: 1 },
  err:       { color: C.red, fontSize: 12.5, fontFamily: F.medium, textAlign: 'center', marginTop: 10 },
  hintRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
  hint:      { color: C.dim, fontSize: 11.5, fontFamily: F.medium },
});
