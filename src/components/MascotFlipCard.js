import React, { useRef, useState } from 'react';
import { View, Image, TouchableOpacity, Pressable, StyleSheet, Text, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C } from '../utils/theme';
import { useMuscleFilter } from '../context/MuscleFilterContext';
import { useLang } from '../context/LanguageContext';
import { ZONE_TABLES } from '../data/zoneData';

// ── Model görselleri ──────────────────────────────────────────────────────────
let IMGS = { MF: null, MB: null, FF: null, FB: null };
try { IMGS.MF = require('../../assets/mascot_male/front.png');   } catch {}
try { IMGS.MB = require('../../assets/mascot_male/back.png');    } catch {}
try { IMGS.FF = require('../../assets/mascot_female/front.png'); } catch {}
try { IMGS.FB = require('../../assets/mascot_female/back.png');  } catch {}

// ── Zone overlay PNG'leri (script tarafından üretildi) ────────────────────────
const OV = {};
try { OV.MF_chest     = require('../../assets/zones/MF_chest.png');     } catch {}
try { OV.MF_shoulder  = require('../../assets/zones/MF_shoulder.png');  } catch {}
try { OV.MF_bicep     = require('../../assets/zones/MF_bicep.png');     } catch {}
try { OV.MF_abs       = require('../../assets/zones/MF_abs.png');       } catch {}
try { OV.MF_forearm   = require('../../assets/zones/MF_forearm.png');   } catch {}
try { OV.MF_quad      = require('../../assets/zones/MF_quad.png');      } catch {}
try { OV.MF_calf      = require('../../assets/zones/MF_calf.png');      } catch {}

try { OV.MB_trap      = require('../../assets/zones/MB_trap.png');      } catch {}
try { OV.MB_shoulder  = require('../../assets/zones/MB_shoulder.png');  } catch {}
try { OV.MB_tricep    = require('../../assets/zones/MB_tricep.png');    } catch {}
try { OV.MB_lat       = require('../../assets/zones/MB_lat.png');       } catch {}
try { OV.MB_mid_back  = require('../../assets/zones/MB_mid_back.png');  } catch {}
try { OV.MB_low_back  = require('../../assets/zones/MB_low_back.png');  } catch {}
try { OV.MB_glute     = require('../../assets/zones/MB_glute.png');     } catch {}
try { OV.MB_hamstring = require('../../assets/zones/MB_hamstring.png'); } catch {}
try { OV.MB_calf      = require('../../assets/zones/MB_calf.png');      } catch {}

try { OV.FF_chest     = require('../../assets/zones/FF_chest.png');     } catch {}
try { OV.FF_bicep     = require('../../assets/zones/FF_bicep.png');     } catch {}
try { OV.FF_abs       = require('../../assets/zones/FF_abs.png');       } catch {}
try { OV.FF_forearm   = require('../../assets/zones/FF_forearm.png');   } catch {}
try { OV.FF_quad      = require('../../assets/zones/FF_quad.png');      } catch {}
try { OV.FF_calf      = require('../../assets/zones/FF_calf.png');      } catch {}

try { OV.FB_trap      = require('../../assets/zones/FB_trap.png');      } catch {}
try { OV.FB_lat       = require('../../assets/zones/FB_lat.png');       } catch {}
try { OV.FB_mid_back  = require('../../assets/zones/FB_mid_back.png');  } catch {}
try { OV.FB_tricep    = require('../../assets/zones/FB_tricep.png');    } catch {}
try { OV.FB_low_back  = require('../../assets/zones/FB_low_back.png');  } catch {}
try { OV.FB_forearm   = require('../../assets/zones/FB_forearm.png');   } catch {}
try { OV.FB_glute     = require('../../assets/zones/FB_glute.png');     } catch {}
try { OV.FB_hamstring = require('../../assets/zones/FB_hamstring.png'); } catch {}
try { OV.FB_calf      = require('../../assets/zones/FB_calf.png');      } catch {}

// ── Zone → filtre & etiket ────────────────────────────────────────────────────
const ZONE_INFO = {
  chest:     { label: 'Göğüs',      labelEn: 'Chest',       filterType: 'cat',    value: 'Göğüs'            },
  shoulder:  { label: 'Omuz',       labelEn: 'Shoulder',    filterType: 'cat',    value: 'Omuz'             },
  bicep:     { label: 'Biseps',     labelEn: 'Biceps',      filterType: 'muscle', value: 'Biceps Brachii'   },
  tricep:    { label: 'Triceps',    labelEn: 'Triceps',     filterType: 'muscle', value: 'Triceps Brachii'  },
  forearm:   { label: 'Önkol',      labelEn: 'Forearm',     filterType: 'cat',    value: 'Kol'              },
  abs:       { label: 'Karın',      labelEn: 'Abs',         filterType: 'muscle', value: 'Rectus Abdominis' },
  quad:      { label: 'Kuadriceps', labelEn: 'Quads',       filterType: 'muscle', value: 'Quadriceps'       },
  calf:      { label: 'Baldır',     labelEn: 'Calves',      filterType: 'cat',    value: 'Bacak'            },
  trap:      { label: 'Trapez',     labelEn: 'Traps',       filterType: 'muscle', value: 'Trapez'           },
  lat:       { label: 'Latissimus', labelEn: 'Lats',        filterType: 'muscle', value: 'Latissimus Dorsi' },
  mid_back:  { label: 'Sırt',       labelEn: 'Mid Back',    filterType: 'muscle', value: 'Romboidler'       },
  low_back:  { label: 'Alt Sırt',   labelEn: 'Lower Back',  filterType: 'muscle', value: 'Erector Spinae'   },
  glute:     { label: 'Gluteus',    labelEn: 'Glutes',      filterType: 'muscle', value: 'Gluteus Maximus'  },
  hamstring: { label: 'Hamstring',  labelEn: 'Hamstrings',  filterType: 'muscle', value: 'Hamstring'        },
};

const ZONE_COLOR = {
  chest: '#ef4444', shoulder: '#f97316', bicep: '#06b6d4', tricep: '#8b5cf6',
  forearm: '#818cf8', abs: '#4ade80', quad: '#38bdf8', calf: '#7dd3fc',
  trap: '#e879f9', lat: '#f43f5e', mid_back: '#fb7185', low_back: '#a855f7',
  glute: '#fb923c', hamstring: '#0ea5e9',
};

// Overlay PNG'lerin üretildiği referans boyutlar (scripts/process_assets.js ile eşleşmeli)
const OV_W    = 390;
const OV_H    = 650;
const TABLE_W = 78;   // OV_W / CELL
const CELL    = 5;

// ── Bileşen ───────────────────────────────────────────────────────────────────
const SCREEN = Dimensions.get('window');

export default function MascotFlipCard({ gender = 'female', width = SCREEN.width, height = Math.round(SCREEN.width * (OV_H / OV_W)), style }) {
  const { lang }            = useLang();
  const { setMuscleFilter } = useMuscleFilter();
  const navigation          = useNavigation();

  const [showFront, setShowFront] = useState(true);
  const [activeZone, setActiveZone] = useState(null);
  const [tooltip, setTooltip]       = useState(null);
  const timer = useRef(null);

  const key = `${gender === 'male' ? 'M' : 'F'}${showFront ? 'F' : 'B'}`;
  const src  = IMGS[key];
  const overlay = activeZone ? OV[`${key}_${activeZone}`] : null;

  const flip = () => {
    clearTimeout(timer.current);
    setActiveZone(null);
    setTooltip(null);
    setShowFront(p => !p);
  };

  const onTouch = (e) => {
    const { locationX: lx, locationY: ly } = e.nativeEvent;
    // Touch koordinatlarını overlay referans boyutuna scale et
    const scaledX = lx / width  * OV_W;
    const scaledY = ly / height * OV_H;
    const tx = Math.max(0, Math.min(TABLE_W - 1, Math.floor(scaledX / CELL)));
    const ty = Math.max(0, Math.min(129,          Math.floor(scaledY / CELL)));
    const zoneId = ZONE_TABLES[key]?.[ty * TABLE_W + tx] ?? null;

    clearTimeout(timer.current);

    if (!zoneId) {
      setActiveZone(null);
      setTooltip(null);
      return;
    }

    const info = ZONE_INFO[zoneId];
    if (!info) return;

    setActiveZone(zoneId);
    setTooltip(info);

    timer.current = setTimeout(() => {
      setMuscleFilter({
        filterType: info.filterType,
        value:      info.value,
        label:      info.label,
        labelEn:    info.labelEn,
      });
      setActiveZone(null);
      setTooltip(null);
      navigation.navigate('Egzersizler');
    }, 700);
  };

  const accentColor = activeZone ? (ZONE_COLOR[activeZone] ?? '#dc2626') : '#dc2626';

  return (
    <View style={[ss.wrap, { width, height }, style]}>

      {/* Model görseli */}
      {src && (
        <Image
          source={src}
          style={{ position: 'absolute', top: 0, left: 0, width, height }}
          resizeMode="contain"
        />
      )}

      {/* Aktif zone overlay — piksel mükemmel */}
      {overlay && (
        <Image
          source={overlay}
          style={{ position: 'absolute', top: 0, left: 0, width, height }}
          resizeMode="stretch"
        />
      )}

      {/* Dokunma katmanı — Pressable scroll'dan ayırt eder */}
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
        onPress={onTouch}
      />

      {/* Tooltip */}
      {tooltip && (
        <View style={[ss.tooltip, { borderColor: accentColor }]} pointerEvents="none">
          <View style={[ss.dot, { backgroundColor: accentColor }]} />
          <Text style={[ss.ttxt, { color: accentColor }]}>
            {lang === 'tr' ? tooltip.label : tooltip.labelEn}
          </Text>
          <Ionicons name="arrow-forward" size={12} color={accentColor} />
        </View>
      )}

      {/* Çevirme butonu */}
      <TouchableOpacity style={ss.flipBtn} onPress={flip} activeOpacity={0.75}>
        <Ionicons name="sync-outline" size={18} color={showFront ? C.teal : C.orange} />
        <Text style={[ss.flipLbl, { color: showFront ? C.teal : C.orange }]}>
          {showFront ? (lang === 'tr' ? 'Arka' : 'Back') : (lang === 'tr' ? 'Ön' : 'Front')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const ss = StyleSheet.create({
  wrap:    { overflow: 'hidden', position: 'relative' },
  tooltip: {
    position: 'absolute', bottom: 14, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(2,6,23,0.92)', borderRadius: 20,
    borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7,
  },
  dot:     { width: 8, height: 8, borderRadius: 4 },
  ttxt:    { fontSize: 13, fontWeight: '700', color: '#fff' },
  flipBtn: {
    position: 'absolute', top: 8, right: 8,
    alignItems: 'center', gap: 3, padding: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8,
  },
  flipLbl: { fontSize: 9, fontWeight: '700' },
});
