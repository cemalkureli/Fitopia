/**
 * HeightField — boy girişi, cetvel (slider) ile senkron.
 * cm modunda tek kutu; ft modunda feet ' ve inch " olarak İKİ parça.
 * Geçerli (min–max cm) değer girilince base güncellenir → slider oynar.
 * Aralık dışında slider değişmez, hata gösterilir, onValidityChange(true).
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../utils/theme';
import { cmToFeetInches } from '../context/UnitsContext';

export default function HeightField({
  baseCm, onBase, min, max, activeUnit, onUnitChange,
  color = C.lime, invalidMsg, prefUnitLabel, onValidityChange,
}) {
  const [cmText, setCmText] = useState(String(baseCm));
  const [ftText, setFtText] = useState('');
  const [inText, setInText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const selfUpdate = useRef(false);

  const syncFromBase = () => {
    setCmText(String(Math.round(baseCm)));
    const { ft, inch } = cmToFeetInches(baseCm);
    setFtText(String(ft));
    setInText(String(inch));
  };

  // Slider (base) dışarıdan değişince kutuları yenile (kendi yazımımız değilse)
  useEffect(() => {
    if (selfUpdate.current) { selfUpdate.current = false; setInvalid(false); onValidityChange?.(false); return; }
    syncFromBase(); setInvalid(false); onValidityChange?.(false);
  }, [baseCm]);

  useEffect(() => { syncFromBase(); setInvalid(false); onValidityChange?.(false); }, [activeUnit]);

  const commit = (cm) => {
    if (isNaN(cm) || cm < min || cm > max) { setInvalid(true); onValidityChange?.(true); return; }
    setInvalid(false); onValidityChange?.(false);
    if (cm !== baseCm) { selfUpdate.current = true; onBase(cm); }
  };

  const handleCm = (raw) => {
    const c = raw.replace(/[^0-9]/g, ''); setCmText(c);
    if (c === '') { setInvalid(false); onValidityChange?.(false); return; }
    commit(parseInt(c, 10));
  };
  const handleFt = (raw, which) => {
    const v = raw.replace(/[^0-9]/g, '');
    const ft = which === 'ft' ? v : ftText;
    const inch = which === 'in' ? v : inText;
    if (which === 'ft') setFtText(v); else setInText(v);
    if (ft === '' && inch === '') { setInvalid(false); onValidityChange?.(false); return; }
    const cm = Math.round(((parseInt(ft || '0', 10) * 12) + parseInt(inch || '0', 10)) * 2.54);
    commit(cm);
  };

  const { ft: dispFt, inch: dispIn } = cmToFeetInches(baseCm);

  return (
    <View style={s.wrap}>
      {/* çift-birim canlı okuma */}
      <View style={s.readRow}>
        <Text style={[s.readVal, activeUnit === 'cm' && { color }]}>{Math.round(baseCm)} cm</Text>
        <Text style={s.readDot}>·</Text>
        <Text style={[s.readVal, activeUnit === 'ft' && { color }]}>{dispFt}'{dispIn}"</Text>
      </View>

      {activeUnit === 'cm' ? (
        <View style={[s.inputRow, { borderColor: invalid ? C.red : color + '55' }]}>
          <Ionicons name="create-outline" size={18} color={invalid ? C.red : C.muted} />
          <TextInput style={s.input} value={cmText} onChangeText={handleCm} keyboardType="number-pad" placeholder={String(Math.round(baseCm))} placeholderTextColor={C.dim} />
          <Text style={[s.inputUnit, { color: invalid ? C.red : color }]}>cm</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[s.inputRow, { flex: 1, borderColor: invalid ? C.red : color + '55' }]}>
            <TextInput style={s.input} value={ftText} onChangeText={v => handleFt(v, 'ft')} keyboardType="number-pad" placeholder={String(dispFt)} placeholderTextColor={C.dim} maxLength={1} />
            <Text style={[s.inputUnit, { color: invalid ? C.red : color }]}>′ ft</Text>
          </View>
          <View style={[s.inputRow, { flex: 1, borderColor: invalid ? C.red : color + '55' }]}>
            <TextInput style={s.input} value={inText} onChangeText={v => handleFt(v, 'in')} keyboardType="number-pad" placeholder={String(dispIn)} placeholderTextColor={C.dim} maxLength={2} />
            <Text style={[s.inputUnit, { color: invalid ? C.red : color }]}>″ in</Text>
          </View>
        </View>
      )}

      <View style={s.toggleRow}>
        {[{ k: 'cm', l: 'CM' }, { k: 'ft', l: 'FEET' }].map(u => {
          const on = u.k === activeUnit;
          return (
            <TouchableOpacity key={u.k} onPress={() => onUnitChange(u.k)} activeOpacity={0.85} style={[s.toggleBtn, on && { backgroundColor: color, borderColor: color }]}>
              <Text style={[s.toggleTxt, on && { color: C.bg, fontFamily: F.extrabold }]}>{u.l}</Text>
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
  inputUnit: { fontSize: 14, fontFamily: F.extrabold },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  toggleBtn: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.s1, alignItems: 'center', justifyContent: 'center' },
  toggleTxt: { color: C.muted, fontSize: 13, fontFamily: F.bold, letterSpacing: 1 },
  err:       { color: C.red, fontSize: 12.5, fontFamily: F.medium, textAlign: 'center', marginTop: 10 },
  hintRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
  hint:      { color: C.dim, fontSize: 11.5, fontFamily: F.medium },
});
