import React from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { C } from '../utils/theme';

// URL (string) veya local require() kabul eder
export default function ExerciseMedia({ source, style }) {
  const src = typeof source === 'string' ? { uri: source } : source;

  const player = useVideoPlayer(src, p => {
    p.loop  = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={[s.video, style]}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
}

const s = StyleSheet.create({
  video: { flex: 1, backgroundColor: C.s2 },
});
