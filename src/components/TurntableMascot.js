/**
 * TurntableMascot
 *
 * Interactive 360° rotating fitness mascot.
 * - Drag left/right to spin
 * - Auto-rotates when idle
 * - Crossfades between frames
 *
 * SETUP: Place 8 frames in assets/mascot_male/ and assets/mascot_female/
 *   000.png  → front (0°)
 *   045.png  → front-right (45°)
 *   090.png  → right side (90°)
 *   135.png  → back-right (135°)
 *   180.png  → back (180°)
 *   225.png  → back-left (225°)
 *   270.png  → left side (270°)
 *   315.png  → front-left (315°)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Image, Animated, PanResponder, StyleSheet, Text,
} from 'react-native';
import FitnessMascot from './FitnessMascot';

// ─── Frame definitions ────────────────────────────────────────────────────────
const MALE_FRAMES = [
  null, null, null, null, null, null, null, null,
];
const FEMALE_FRAMES = [
  null, null, null, null, null, null, null, null,
];

// Try to load each frame
const maleKeys   = ['000','045','090','135','180','225','270','315'];
const femaleKeys = ['000','045','090','135','180','225','270','315'];

maleKeys.forEach((k, i) => {
  try { MALE_FRAMES[i]   = require(`../../assets/mascot_male/${k}.png`); }   catch {}
});
femaleKeys.forEach((k, i) => {
  try { FEMALE_FRAMES[i] = require(`../../assets/mascot_female/${k}.png`); } catch {}
});

const FRAME_COUNT = 8;
const DEG_PER_FRAME = 360 / FRAME_COUNT; // 45°

// ─── Component ────────────────────────────────────────────────────────────────
export default function TurntableMascot({
  gender   = 'male',
  width    = 220,
  height   = 380,
  autoSpin = true,
  style,
}) {
  const frames = gender === 'female' ? FEMALE_FRAMES : MALE_FRAMES;
  const hasFrames = frames.some(f => f !== null);

  const [frameIdx,  setFrameIdx]  = useState(0); // 0-7
  const [nextIdx,   setNextIdx]   = useState(1);
  const [isDragging,setIsDragging]= useState(false);

  const opacity     = useRef(new Animated.Value(1)).current;  // current frame
  const crossOpacity= useRef(new Animated.Value(0)).current;  // next frame (crossfade)
  const dragOffset  = useRef(0);
  const autoTimer   = useRef(null);
  const currentIdx  = useRef(0);
  const spinning    = useRef(false);

  // Clamp index to 0-7
  const clamp = (i) => ((i % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;

  const goToFrame = (idx) => {
    const i = clamp(idx);
    const ni = clamp(idx + 1);
    currentIdx.current = i;
    setFrameIdx(i);
    setNextIdx(ni);
  };

  // Crossfade to next frame
  const advanceFrame = (dir = 1) => {
    const next = clamp(currentIdx.current + dir);
    setNextIdx(next);
    crossOpacity.setValue(0);
    Animated.timing(crossOpacity, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      currentIdx.current = next;
      setFrameIdx(next);
      crossOpacity.setValue(0);
    });
  };

  // Auto-spin loop
  const startAutoSpin = () => {
    if (!autoSpin || !hasFrames || spinning.current) return;
    spinning.current = true;
    autoTimer.current = setInterval(() => {
      advanceFrame(1);
    }, 180);
  };

  const stopAutoSpin = () => {
    spinning.current = false;
    if (autoTimer.current) {
      clearInterval(autoTimer.current);
      autoTimer.current = null;
    }
  };

  useEffect(() => {
    if (hasFrames) startAutoSpin();
    return () => stopAutoSpin();
  }, [hasFrames, autoSpin]);

  // Drag to rotate
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => hasFrames,
      onMoveShouldSetPanResponder:  () => hasFrames,
      onPanResponderGrant: () => {
        setIsDragging(true);
        stopAutoSpin();
        dragOffset.current = 0;
      },
      onPanResponderMove: (_, gs) => {
        const dx = gs.dx - dragOffset.current;
        // Every ~30px = 1 frame
        const frames = Math.round(dx / 30);
        if (Math.abs(frames) >= 1) {
          advanceFrame(-Math.sign(dx)); // drag right = rotate right
          dragOffset.current = gs.dx;
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        // Restart auto-spin after 1.5s idle
        setTimeout(() => startAutoSpin(), 1500);
      },
    })
  ).current;

  // Fallback if no frames loaded
  if (!hasFrames) {
    return <FitnessMascot gender={gender} style={style} />;
  }

  const currentSrc = frames[frameIdx];
  const nextSrc    = frames[nextIdx];

  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]} {...panResponder.panHandlers}>
      {/* Current frame */}
      {currentSrc && (
        <Animated.Image
          source={currentSrc}
          style={[
            StyleSheet.absoluteFillObject,
            { width, height, opacity },
          ]}
          resizeMode="contain"
        />
      )}

      {/* Next frame (crossfade layer) */}
      {nextSrc && (
        <Animated.Image
          source={nextSrc}
          style={[
            StyleSheet.absoluteFillObject,
            { width, height, opacity: crossOpacity },
          ]}
          resizeMode="contain"
        />
      )}

      {/* Drag hint */}
      {!isDragging && (
        <View style={hint.wrap} pointerEvents="none">
          <Text style={hint.txt}>‹ ›</Text>
        </View>
      )}
    </View>
  );
}

const hint = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 8, alignItems: 'center', width: '100%' },
  txt:  { color: 'rgba(255,255,255,0.25)', fontSize: 18, letterSpacing: 6 },
});
