import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Color palette (dark 3D studio look) ─────────────────────────────────────
const DARK  = '#060810';
const MID   = '#101424';
const LIGHT = '#1a2038';
const LIGHT2= '#222840';
const RIM   = 'rgba(232,244,74,0.55)';  // lime rim light (left edge)
const RIM2  = 'rgba(232,244,74,0.20)';  // subtle rim (top edge)
const SPC   = 'rgba(255,255,255,0.07)'; // specular highlight
const CREASE= 'rgba(0,0,0,0.55)';       // muscle crease

// ─── Gradient part helper ─────────────────────────────────────────────────────
function Lit({ style, h = false }) {
  // h = horizontal gradient (left lit → right dark)
  // v = vertical
  return (
    <LinearGradient
      colors={h ? [LIGHT2, LIGHT, MID, DARK] : [LIGHT, MID, DARK]}
      start={h ? { x: 0, y: 0.5 } : { x: 0.3, y: 0 }}
      end={h   ? { x: 1, y: 0.5 } : { x: 0.9, y: 1 }}
      style={[StyleSheet.absoluteFillObject, style]}
    />
  );
}

// ─── Single body section ──────────────────────────────────────────────────────
function Piece({ x, y, w, h, r, rimLeft, rimTop, rotate, children, extraStyle }) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          left: x, top: y, width: w, height: h,
          borderRadius: r ?? w / 2,
          overflow: 'hidden',
          ...(rimLeft && { borderLeftWidth: 1.5, borderLeftColor: RIM }),
          ...(rimTop  && { borderTopWidth: 1,   borderTopColor:  RIM2 }),
        },
        rotate && { transform: [{ rotate }] },
        extraStyle,
      ]}
    >
      <Lit h />
      {children}
    </View>
  );
}

// ─── Abs block grid ───────────────────────────────────────────────────────────
function Abs({ cx, y }) {
  return (
    <>
      {[0, 1, 2].map(row =>
        [0, 1].map(col => (
          <View
            key={`${row}-${col}`}
            style={{
              position: 'absolute',
              left: cx - 24 + col * 26, top: y + row * 17,
              width: 22, height: 14, borderRadius: 7,
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={[LIGHT2, LIGHT, MID]}
              start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        ))
      )}
      {/* Center crease */}
      <View style={{ position: 'absolute', left: cx - 1, top: y, width: 1, height: 48, backgroundColor: CREASE }} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FitnessMascot({ gender = 'male', style }) {
  const m = gender !== 'female';
  const W = 170;
  const cx = W / 2; // 85

  // Body proportions
  const sw  = m ? 136 : 108;  // shoulder width
  const cw  = m ? 82  : 72;   // chest width
  const ww  = m ? 62  : 50;   // waist width
  const hw  = m ? 74  : 88;   // hip width
  const aw  = m ? 26  : 22;   // arm width
  const fw  = m ? 22  : 18;   // forearm width
  const tw  = m ? 35  : 33;   // thigh width
  const clw = m ? 25  : 23;   // calf width

  return (
    <View style={[{ width: W, height: 340 }, style]}>
      {/* Background glow orb */}
      <View style={{
        position: 'absolute', width: 120, height: 300,
        left: cx - 60, top: 10,
        backgroundColor: 'rgba(232,244,74,0.03)',
        borderRadius: 60,
      }} />

      {/* ── HEAD ─────────────────────────────────── */}
      <Piece x={cx - (m ? 17 : 15)} y={0} w={m ? 34 : 30} h={m ? 38 : 34} rimLeft rimTop />

      {/* ── NECK ─────────────────────────────────── */}
      <Piece x={cx - (m ? 9 : 7)} y={m ? 36 : 33} w={m ? 18 : 14} h={13} r={5} rimLeft />

      {/* ── TRAPEZOIDS / SHOULDERS ───────────────── */}
      <Piece x={cx - sw / 2} y={47} w={sw} h={m ? 22 : 18} r={m ? 11 : 9} rimLeft rimTop />

      {/* ── LEFT UPPER ARM ───────────────────────── */}
      <Piece
        x={cx - sw / 2 - aw + 6} y={58} w={aw} h={m ? 82 : 74}
        rimLeft rotate={m ? '7deg' : '5deg'}
      >
        {/* Bicep bulge highlight */}
        <View style={{
          position: 'absolute', left: 2, top: 18, width: aw - 8, height: 28,
          borderRadius: 14, backgroundColor: SPC,
        }} />
      </Piece>

      {/* ── RIGHT UPPER ARM ──────────────────────── */}
      <Piece
        x={cx + sw / 2 - 6} y={58} w={aw} h={m ? 82 : 74}
        rotate={m ? '-7deg' : '-5deg'}
      />

      {/* ── LEFT FOREARM ─────────────────────────── */}
      <Piece
        x={cx - sw / 2 - fw + 8} y={m ? 134 : 126} w={fw} h={m ? 72 : 64}
        rimLeft rotate={m ? '14deg' : '11deg'}
      />

      {/* ── RIGHT FOREARM ────────────────────────── */}
      <Piece
        x={cx + sw / 2 - 8} y={m ? 134 : 126} w={fw} h={m ? 72 : 64}
        rotate={m ? '-14deg' : '-11deg'}
      />

      {/* ── CHEST ────────────────────────────────── */}
      <Piece x={cx - cw / 2} y={66} w={cw} h={m ? 52 : 46} r={m ? 14 : 12} rimLeft>
        {/* Pec separation line */}
        {m && (
          <View style={{
            position: 'absolute', left: cw / 2 - 0.5, top: 4, width: 1, height: 42,
            backgroundColor: CREASE,
          }} />
        )}
        {/* Pec highlight */}
        <View style={{
          position: 'absolute', left: 4, top: 6,
          width: m ? cw / 2 - 8 : cw - 12, height: m ? 20 : 18,
          borderRadius: 10, backgroundColor: SPC,
        }} />
      </Piece>

      {/* ── ABS (male) / Toned mid (female) ──────── */}
      {m
        ? <Abs cx={cx} y={116} />
        : (
          <Piece x={cx - 28} y={112} w={56} h={30} r={10}>
            <View style={{ position: 'absolute', left: 6, top: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: SPC }} />
          </Piece>
        )
      }

      {/* ── WAIST ────────────────────────────────── */}
      <Piece x={cx - ww / 2} y={m ? 160 : 144} w={ww} h={m ? 20 : 16} r={9} rimLeft />

      {/* ── HIPS / GLUTES ────────────────────────── */}
      <Piece x={cx - hw / 2} y={m ? 178 : 158} w={hw} h={m ? 26 : 32} r={m ? 12 : 15} rimLeft>
        {/* Female hip highlight */}
        {!m && (
          <View style={{
            position: 'absolute', left: 6, top: 6, width: 28, height: 18,
            borderRadius: 9, backgroundColor: SPC,
          }} />
        )}
      </Piece>

      {/* ── LEFT THIGH ───────────────────────────── */}
      <Piece
        x={cx - tw - 3} y={m ? 200 : 186} w={tw} h={m ? 68 : 74}
        rimLeft
      >
        {/* Quad highlight */}
        <View style={{ position: 'absolute', left: 4, top: 10, width: tw - 12, height: 28, borderRadius: 12, backgroundColor: SPC }} />
      </Piece>

      {/* ── RIGHT THIGH ──────────────────────────── */}
      <Piece x={cx + 3} y={m ? 200 : 186} w={tw} h={m ? 68 : 74} />

      {/* ── LEFT CALF ────────────────────────────── */}
      <Piece
        x={cx - clw - 5} y={m ? 264 : 256} w={clw} h={m ? 60 : 64}
        rimLeft
      >
        <View style={{ position: 'absolute', left: 3, top: 12, width: clw - 8, height: 20, borderRadius: 8, backgroundColor: SPC }} />
      </Piece>

      {/* ── RIGHT CALF ───────────────────────────── */}
      <Piece x={cx + 5} y={m ? 264 : 256} w={clw} h={m ? 60 : 64} />

      {/* ── FEET ─────────────────────────────────── */}
      <Piece x={cx - clw - 5} y={m ? 320 : 316} w={clw + 2} h={10} r={5} rimLeft />
      <Piece x={cx + 3}       y={m ? 320 : 316} w={clw + 2} h={10} r={5} />

      {/* Subtle floor shadow */}
      <View style={{
        position: 'absolute', bottom: -6, left: cx - 45, width: 90, height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.35)',
        transform: [{ scaleX: 1.2 }],
      }} />
    </View>
  );
}
