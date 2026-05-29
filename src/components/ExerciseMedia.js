import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { C } from '../utils/theme';

export default function ExerciseMedia({ source, style }) {
  const player = useVideoPlayer(source, p => {
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
