/**
 * ConfirmDialog — themed confirmation dialog.
 * In-tree absolute overlay (NOT a native Modal → avoids the Android
 * second-window compositing glitch we hit with <Modal>). Render it once
 * near the root of a screen; it returns null while hidden.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../utils/theme';

export default function ConfirmDialog({
  visible,
  title,
  message,
  icon = 'alert-circle-outline',
  confirmLabel,
  cancelLabel,
  danger = false,
  singleAction = false,
  onConfirm,
  onCancel,
}) {
  if (!visible) return null;
  const accent = danger ? C.red : C.lime;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={s.backdrop} onPress={onCancel} />
      <View style={s.wrap} pointerEvents="box-none">
        <View style={s.card}>
          <View style={[s.iconWrap, { backgroundColor: accent + '1A', borderColor: accent + '40' }]}>
            <Ionicons name={icon} size={26} color={accent} />
          </View>
          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}
          <View style={s.actions}>
            {!singleAction && (
              <TouchableOpacity onPress={onCancel} style={s.cancelBtn} activeOpacity={0.8}>
                <Text style={s.cancelTxt}>{cancelLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onConfirm} style={[s.confirmBtn, { backgroundColor: accent }]} activeOpacity={0.85}>
              <Text style={[s.confirmTxt, danger && { color: '#fff' }]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.80)' },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 360, alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.98)', borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', padding: 24,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { color: C.text, fontSize: 18, fontFamily: F.extrabold, textAlign: 'center', marginBottom: 8 },
  message: { color: C.muted, fontSize: 13.5, fontFamily: F.regular, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.10)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)',
  },
  cancelTxt: { color: C.muted, fontSize: 14, fontFamily: F.semibold },
  confirmBtn: { flex: 1.2, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  confirmTxt: { color: C.bg, fontSize: 14, fontFamily: F.extrabold, letterSpacing: 0.3 },
});
