/**
 * ExerciseMedia — animasyonlu egzersiz GIF oynatıcı.
 * (Eski expo-video/webm oynatıcının yerini aldı; artık Gym Visual GIF'leri
 * expo-image ile döngüde oynatılır — animated GIF desteği yerleşiktir.)
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { C } from '../utils/theme';

export default function ExerciseMedia({ source, style, contentFit = 'contain' }) {
  const uri = source ? (typeof source === 'string' ? source : source.uri) : null;
  if (!uri) return <View style={[s.media, style]} />;
  return (
    <ExpoImage
      source={{ uri }}
      style={[s.media, style]}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={150}
      // GIF'ler expo-image'da otomatik oynar; sabit kalırsa döngüyü garantiler
    />
  );
}

const s = StyleSheet.create({
  media: { flex: 1, backgroundColor: C.s2 },
});
