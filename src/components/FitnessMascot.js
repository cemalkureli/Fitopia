import React, { useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ─── Asset loading (graceful fallback if files don't exist yet) ───────────────
let IMG = { male_front: null, male_back: null, female_front: null, female_back: null };
// Static requires only — Metro cannot resolve dynamic paths
try { IMG.male_front   = require('../../assets/mascot_male/000.webp');   } catch {}
try { IMG.male_back    = require('../../assets/mascot_male/180.webp');   } catch {}
try { IMG.female_front = require('../../assets/mascot_female/000.webp'); } catch {}
try { IMG.female_back  = require('../../assets/mascot_female/180.webp'); } catch {}

// ─── Fallback View-based figure ───────────────────────────────────────────────
const DARK  = '#060810';  const MID   = '#101424';
const LIGHT = '#1a2038';  const L2    = '#222840';
const RIM   = 'rgba(232,244,74,0.55)';
const SPC   = 'rgba(255,255,255,0.07)';
const CREASE= 'rgba(0,0,0,0.55)';

function Piece({ x, y, w, h, r, rimLeft, rimTop, rotate, children }) {
  return (
    <View style={[{
      position: 'absolute', left: x, top: y, width: w, height: h,
      borderRadius: r ?? w / 2, overflow: 'hidden',
      ...(rimLeft && { borderLeftWidth: 1.5, borderLeftColor: RIM }),
      ...(rimTop  && { borderTopWidth: 1, borderTopColor: 'rgba(232,244,74,0.2)' }),
    }, rotate && { transform: [{ rotate }] }]}>
      <LinearGradient colors={[L2, LIGHT, MID, DARK]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFillObject} />
      {children}
    </View>
  );
}

function FallbackMascot({ gender = 'male' }) {
  const m = gender !== 'female';
  const W = 170; const cx = W / 2;
  const sw=m?136:108; const cw=m?82:72; const ww=m?62:50; const hw=m?74:88;
  const aw=m?26:22; const fw=m?22:18; const tw=m?35:33; const clw=m?25:23;

  return (
    <View style={{ width: W, height: 340 }}>
      <View style={{ position: 'absolute', width: 120, height: 300, left: cx-60, top: 10, backgroundColor: 'rgba(232,244,74,0.03)', borderRadius: 60 }} />
      <Piece x={cx-(m?17:15)} y={0}      w={m?34:30} h={m?38:34} rimLeft rimTop />
      <Piece x={cx-(m?9:7)}   y={m?36:33} w={m?18:14} h={13} r={5} rimLeft />
      <Piece x={cx-sw/2} y={47} w={sw} h={m?22:18} r={m?11:9} rimLeft rimTop />
      <Piece x={cx-sw/2-aw+6} y={58} w={aw} h={m?82:74} rimLeft rotate={m?'7deg':'5deg'}>
        <View style={{ position: 'absolute', left: 2, top: 18, width: aw-8, height: 28, borderRadius: 14, backgroundColor: SPC }} />
      </Piece>
      <Piece x={cx+sw/2-6}   y={58} w={aw} h={m?82:74} rotate={m?'-7deg':'-5deg'} />
      <Piece x={cx-sw/2-fw+8} y={m?134:126} w={fw} h={m?72:64} rimLeft rotate={m?'14deg':'11deg'} />
      <Piece x={cx+sw/2-8}    y={m?134:126} w={fw} h={m?72:64} rotate={m?'-14deg':'-11deg'} />
      <Piece x={cx-cw/2} y={66} w={cw} h={m?52:46} r={m?14:12} rimLeft>
        {m && <View style={{ position:'absolute', left:cw/2-0.5, top:4, width:1, height:42, backgroundColor:CREASE }} />}
        <View style={{ position:'absolute', left:4, top:6, width:m?cw/2-8:cw-12, height:m?20:18, borderRadius:10, backgroundColor:SPC }} />
      </Piece>
      {m ? (
        <>
          {[0,1,2].map(row => [0,1].map(col => (
            <View key={`${row}-${col}`} style={{ position:'absolute', left:cx-24+col*26, top:116+row*17, width:22, height:14, borderRadius:7, overflow:'hidden' }}>
              <LinearGradient colors={[L2,LIGHT,MID]} start={{x:0.2,y:0}} end={{x:0.9,y:1}} style={StyleSheet.absoluteFillObject} />
            </View>
          )))}
          <View style={{ position:'absolute', left:cx-1, top:116, width:1, height:48, backgroundColor:CREASE }} />
        </>
      ) : (
        <Piece x={cx-28} y={112} w={56} h={30} r={10}>
          <View style={{ position:'absolute', left:6, top:6, width:18, height:18, borderRadius:9, backgroundColor:SPC }} />
        </Piece>
      )}
      <Piece x={cx-ww/2} y={m?160:144} w={ww} h={m?20:16} r={9} rimLeft />
      <Piece x={cx-hw/2} y={m?178:158} w={hw} h={m?26:32} r={m?12:15} rimLeft>
        {!m && <View style={{ position:'absolute', left:6, top:6, width:28, height:18, borderRadius:9, backgroundColor:SPC }} />}
      </Piece>
      <Piece x={cx-tw-3} y={m?200:186} w={tw} h={m?68:74} rimLeft>
        <View style={{ position:'absolute', left:4, top:10, width:tw-12, height:28, borderRadius:12, backgroundColor:SPC }} />
      </Piece>
      <Piece x={cx+3} y={m?200:186} w={tw} h={m?68:74} />
      <Piece x={cx-clw-5} y={m?264:256} w={clw} h={m?60:64} rimLeft>
        <View style={{ position:'absolute', left:3, top:12, width:clw-8, height:20, borderRadius:8, backgroundColor:SPC }} />
      </Piece>
      <Piece x={cx+5} y={m?264:256} w={clw} h={m?60:64} />
      <Piece x={cx-clw-5} y={m?320:316} w={clw+2} h={10} r={5} rimLeft />
      <Piece x={cx+3}     y={m?320:316} w={clw+2} h={10} r={5} />
      <View style={{ position:'absolute', bottom:-6, left:cx-45, width:90, height:12, borderRadius:6, backgroundColor:'rgba(0,0,0,0.35)', transform:[{scaleX:1.2}] }} />
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function FitnessMascot({ gender = 'male', style }) {
  const [side, setSide] = useState('front'); // 'front' | 'back'

  const key   = `${gender === 'female' ? 'female' : 'male'}_${side}`;
  const imgSrc = IMG[key];

  const hasAny = IMG.male_front || IMG.male_back || IMG.female_front || IMG.female_back;

  if (hasAny && imgSrc) {
    return (
      <View style={[{ alignItems: 'center' }, style]}>
        <Image source={imgSrc} style={{ width: 200, height: 360 }} resizeMode="contain" />
        {/* Front / Back toggle */}
        <View style={ms.toggle}>
          {['front', 'back'].map(s => (
            <TouchableOpacity
              key={s}
              style={[ms.toggleBtn, side === s && ms.toggleBtnActive]}
              onPress={() => setSide(s)}
            >
              <Ionicons
                name={s === 'front' ? 'person-outline' : 'person'}
                size={14}
                color={side === s ? '#0a0c0f' : '#dc2626'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // Fallback
  return (
    <View style={style}>
      <FallbackMascot gender={gender} />
    </View>
  );
}

const ms = StyleSheet.create({
  toggle:        { flexDirection: 'row', gap: 6, marginTop: 8 },
  toggleBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#dc2626', backgroundColor: 'transparent' },
  toggleBtnActive: { backgroundColor: '#dc2626' },
});
