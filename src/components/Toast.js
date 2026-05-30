import React, { useRef, useState, useCallback } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../utils/theme';

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useToast() {
  const [msg,  setMsg]  = useState(null);
  const [type, setType] = useState('success'); // 'success' | 'error' | 'warn'
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY= useRef(new Animated.Value(40)).current;
  const timerRef  = useRef(null);

  const show = useCallback((message, t = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMsg(message); setType(t);
    opacity.setValue(0); translateY.setValue(40);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 40, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,  duration: 250, useNativeDriver: true }),
      ]).start(() => setMsg(null));
    }, 2400);
  }, []);

  return { show, ToastNode: msg ? <ToastBanner msg={msg} type={type} opacity={opacity} translateY={translateY} /> : null };
}

// ─── Banner component ──────────────────────────────────────────────────────────
const COLORS = {
  success: { bg: 'rgba(20,35,12,0.97)', border: '#4ade80', icon: 'checkmark-circle', iconColor: '#4ade80' },
  error:   { bg: 'rgba(35,8,8,0.97)',   border: '#f87171', icon: 'close-circle',     iconColor: '#f87171' },
  warn:    { bg: 'rgba(35,25,5,0.97)',  border: '#fb923c', icon: 'warning',           iconColor: '#fb923c' },
};

function ToastBanner({ msg, type, opacity, translateY }) {
  const col = COLORS[type] ?? COLORS.success;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        ts.wrap,
        { backgroundColor: col.bg, borderColor: col.border, opacity, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name={col.icon} size={18} color={col.iconColor} />
      <Text style={[ts.txt, { color: col.iconColor }]}>{msg}</Text>
    </Animated.View>
  );
}

const ts = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 28, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, borderWidth: 1, maxWidth: 320, zIndex: 9999 },
  txt:  { fontSize: 13, fontWeight: '700', flex: 1 },
});

// ─── Themed confirm modal ──────────────────────────────────────────────────────
import { Modal, TouchableOpacity } from 'react-native';
import AnimatedRN, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export function ConfirmModal({ visible, title, message, confirmLabel, confirmColor = '#dc2626', onConfirm, onCancel, lang }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <AnimatedRN.View entering={FadeIn.duration(200)} style={cm.box}>
          <View style={[cm.iconWrap, { backgroundColor: confirmColor + '18', borderColor: confirmColor + '44' }]}>
            <Ionicons name="warning-outline" size={28} color={confirmColor} />
          </View>
          <Text style={cm.title}>{title}</Text>
          {message ? <Text style={cm.message}>{message}</Text> : null}
          <View style={cm.btnRow}>
            <TouchableOpacity style={cm.cancelBtn} onPress={onCancel}>
              <Text style={cm.cancelTxt}>{lang === 'tr' ? 'İptal' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cm.confirmBtn, { borderColor: confirmColor + '50' }]} onPress={onConfirm}>
              <LinearGradient colors={[confirmColor, confirmColor + 'bb']} style={cm.confirmGrad}>
                <Text style={cm.confirmTxt}>{confirmLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </AnimatedRN.View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box:        { backgroundColor: C.s1, borderRadius: 24, padding: 24, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  iconWrap:   { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1 },
  title:      { color: C.text, fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  message:    { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btnRow:     { flexDirection: 'row', gap: 10, width: '100%' },
  cancelBtn:  { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  cancelTxt:  { color: C.muted, fontWeight: '700' },
  confirmBtn: { flex: 1.5, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  confirmGrad:{ height: 46, alignItems: 'center', justifyContent: 'center' },
  confirmTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
