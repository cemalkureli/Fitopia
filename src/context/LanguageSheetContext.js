import React, { createContext, useContext, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../utils/theme';
import { useLang } from './LanguageContext';
import { t } from '../utils/i18n';

const LangSheetContext = createContext({ openLanguageSheet: () => {} });

const LANGS = [
  { code: 'tr', label: 'Türkçe', native: 'TR' },
  { code: 'en', label: 'English', native: 'EN' },
];

// Renders in-tree (no native Modal / second window) so it always sits above
// everything as a plain absolutely-positioned overlay at the true app root —
// avoids the separate-window creation that native <Modal> requires on Android.
export function LanguageSheetProvider({ children }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(lang);

  const openLanguageSheet = () => {
    setPending(lang);
    setOpen(true);
  };

  const handleSave = () => {
    setLang(pending);
    setOpen(false);
  };

  return (
    <LangSheetContext.Provider value={{ openLanguageSheet }}>
      {children}

      {open && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={s.backdropTouch} onPress={() => setOpen(false)}>
            <View style={s.backdrop} />
          </Pressable>
          <View style={s.sheetWrap} pointerEvents="box-none">
            <View style={s.sheet}>
              <View style={s.sheetHeader}>
                <View style={s.sheetIconWrap}>
                  <Ionicons name="language" size={20} color={C.lime} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sheetTitle}>{t('selectLanguage', lang)}</Text>
                  <Text style={s.sheetSub}>{t('selectLanguageSub', lang)}</Text>
                </View>
              </View>

              <View style={s.options}>
                {LANGS.map((l) => {
                  const active = pending === l.code;
                  return (
                    <TouchableOpacity
                      key={l.code}
                      activeOpacity={0.85}
                      onPress={() => setPending(l.code)}
                      style={[s.option, active && s.optionActive]}
                    >
                      <View style={[s.badge, active && s.badgeActive]}>
                        <Text style={[s.badgeText, active && s.badgeTextActive]}>{l.native}</Text>
                      </View>
                      <Text style={[s.optionLabel, active && s.optionLabelActive]}>{l.label}</Text>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color={C.lime} />
                      ) : (
                        <View style={s.checkPlaceholder} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.actions}>
                <TouchableOpacity onPress={() => setOpen(false)} style={s.cancelBtn} activeOpacity={0.8}>
                  <Text style={s.cancelText}>{t('cancel', lang)}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={s.saveBtn} activeOpacity={0.85}>
                  <Text style={s.saveText}>{t('save', lang)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
    </LangSheetContext.Provider>
  );
}

export function useLanguageSheet() {
  return useContext(LangSheetContext);
}

const s = StyleSheet.create({
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.78)' },

  sheetWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  sheet: {
    width: '100%', maxWidth: 380,
    backgroundColor: 'rgba(15,23,42,0.97)', borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)',
    padding: 22,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  sheetIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(232,244,74,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: { color: C.text, fontSize: 17, fontFamily: F.extrabold, marginBottom: 2 },
  sheetSub:   { color: C.muted, fontSize: 12.5, fontFamily: F.regular },

  options: { gap: 10, marginBottom: 20 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(30,41,59,0.55)', borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(148,163,184,0.14)',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  optionActive: { borderColor: C.lime, backgroundColor: 'rgba(232,244,74,0.09)' },
  badge: {
    width: 36, height: 28, borderRadius: 8, backgroundColor: 'rgba(148,163,184,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeActive: { backgroundColor: C.lime },
  badgeText: { color: C.muted, fontSize: 11, fontFamily: F.extrabold, letterSpacing: 0.5 },
  badgeTextActive: { color: C.bg },
  optionLabel: { flex: 1, color: C.muted, fontSize: 15, fontFamily: F.semibold },
  optionLabelActive: { color: C.text },
  checkPlaceholder: { width: 20, height: 20 },

  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.10)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)',
  },
  cancelText: { color: C.muted, fontSize: 14, fontFamily: F.semibold },
  saveBtn: {
    flex: 1.4, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.lime,
  },
  saveText: { color: C.bg, fontSize: 14, fontFamily: F.extrabold, letterSpacing: 0.5 },
});
