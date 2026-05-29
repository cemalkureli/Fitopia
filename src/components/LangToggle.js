import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { C } from '../utils/theme';
import { useLang } from '../context/LanguageContext';

export default function LangToggle({ style }) {
  const { lang, setLang } = useLang();
  return (
    <TouchableOpacity
      style={[s.wrap, style]}
      onPress={() => setLang(lang === 'tr' ? 'en' : 'tr')}
      activeOpacity={0.7}
    >
      <View style={[s.pill, lang === 'tr' && s.pillActive]}>
        <Text style={[s.text, lang === 'tr' && s.textActive]}>TR</Text>
      </View>
      <View style={s.divider} />
      <View style={[s.pill, lang === 'en' && s.pillActive]}>
        <Text style={[s.text, lang === 'en' && s.textActive]}>EN</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.s2, borderRadius: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  pill:      { paddingHorizontal: 10, paddingVertical: 5 },
  pillActive:{ backgroundColor: C.lime + '22' },
  text:      { color: C.dim, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  textActive:{ color: C.lime },
  divider:   { width: 1, height: '60%', backgroundColor: C.border },
});
