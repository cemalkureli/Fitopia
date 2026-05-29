import React from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { C } from '../utils/theme';

export default function ExerciseMedia({ source, style }) {
  const src = source
    ? (typeof source === 'string' ? { uri: source } : source)
    : null;

  const player = useVideoPlayer(src, p => {
    if (!src) return;
    p.loop  = true;
    p.muted = true;
    p.play();
  });

  if (!src) return <View style={[s.video, style]} />;

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
