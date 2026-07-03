import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { C, F } from '../utils/theme';
import { useLang } from '../context/LanguageContext';
import { useLanguageSheet } from '../context/LanguageSheetContext';

export default function LangToggle({ style }) {
  const { lang } = useLang();
  const { openLanguageSheet } = useLanguageSheet();

  // breathing glow behind the trigger icon
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + glow.value * 0.16,
    transform: [{ scale: 1 + glow.value * 0.12 }],
  }));

  return (
    <TouchableOpacity onPress={openLanguageSheet} activeOpacity={0.8} style={style}>
      <View style={s.trigger}>
        <Animated.View pointerEvents="none" style={[s.triggerGlow, glowStyle]} />
        <Ionicons name="language" size={15} color={C.lime} />
        <Text style={s.triggerText}>{lang.toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(30,41,59,0.65)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(232,244,74,0.28)',
    paddingHorizontal: 12, paddingVertical: 7,
  },
  triggerGlow: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 16, backgroundColor: C.lime,
  },
  triggerText: { color: C.lime, fontSize: 11, fontFamily: F.bold, letterSpacing: 1 },
});
