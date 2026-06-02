/**
 * process_assets.js — v3
 * Yaklaşım: renk-bazlı clustering
 *   - Her benzersiz renk kümesi = 1 zone overlay
 *   - Centroid pozisyonu sadece zone ismi için kullanılır
 *   - Pozisyon sınırları overlaya UYGULANMAZ → piksel mükemmel
 */

const { Jimp, intToRGBA } = require('jimp');
const path = require('path');
const fs   = require('fs');

const ROOT      = path.join(__dirname, '..');
const ZONES_DIR = path.join(ROOT, 'assets', 'zones');

const DISPLAY_W = 390;
const DISPLAY_H = 650;
const TABLE_W   = 78;
const TABLE_H   = 130;
const CELL      = 5;

// Tolerance: iki rengin "aynı" sayılması için max mesafe
const COLOR_TOL = 35;

// ── Zone renkleri (RGBA int) ──────────────────────────────────────────────────
function rgba(r, g, b, a) { return ((r*0x1000000)+(g*0x10000)+(b*0x100)+a)>>>0; }
const ZONE_RGBA = {
  chest:     rgba(239,68, 68, 185),  shoulder: rgba(249,115,22, 185),
  bicep:     rgba(6, 182,212,185),   tricep:   rgba(139,92, 246,185),
  forearm:   rgba(129,140,248,185),  abs:      rgba(74, 222,128,185),
  quad:      rgba(56, 189,248,185),  calf:     rgba(125,211,252,185),
  trap:      rgba(232,121,249,185),  lat:      rgba(244,63, 94, 185),
  mid_back:  rgba(251,113,133,185),  low_back: rgba(168,85, 247,185),
  glute:     rgba(251,146,60, 185),  hamstring:rgba(14, 165,233,185),
};

// ── Arka plan mı? ─────────────────────────────────────────────────────────────
function isBg(r, g, b, a) {
  if (a < 20) return true;
  if (r < 22 && g < 22 && b < 22) return true;   // siyah
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
  return mx===0 ? true : (mx-mn)/mx < 0.20;       // gri (vücut)
}

// ── İki renk aynı küme mi? ────────────────────────────────────────────────────
function colorDist(r1,g1,b1, r2,g2,b2) {
  return Math.sqrt((r1-r2)**2+(g1-g2)**2+(b1-b2)**2);
}

// ── Letterbox hesapla ─────────────────────────────────────────────────────────
function calcBounds(natW, natH) {
  const scale = Math.min(DISPLAY_W/natW, DISPLAY_H/natH);
  const rW = natW*scale, rH = natH*scale;
  return { scale, rW, rH, ox:(DISPLAY_W-rW)/2, oy:(DISPLAY_H-rH)/2 };
}

// ── Centroid pozisyona göre zone ismi ─────────────────────────────────────────
function nameByPos(cxPct, cyPct, isFront) {
  const arm    = cxPct < 25 || cxPct > 75;
  const center = cxPct >= 22 && cxPct <= 78;
  const leg    = cxPct >= 14 && cxPct <= 86;

  if (isFront) {
    if (cyPct < 15) return null;
    if (cyPct < 28 && arm)                       return 'shoulder';
    if (cyPct >= 16 && cyPct < 38 && center)     return 'chest';
    if (cyPct >= 24 && cyPct < 50 && arm)        return cyPct < 37 ? 'bicep' : 'forearm';
    if (cyPct >= 34 && cyPct < 57 && center)     return 'abs';
    if (cyPct >= 55 && cyPct < 80 && leg)        return 'quad';
    if (cyPct >= 79 && leg)                      return 'calf';
  } else {
    if (cyPct < 15) return null;
    if (cyPct < 28 && arm)                       return 'shoulder';
    if (cyPct >= 12 && cyPct < 32 && center)     return 'trap';
    if (cyPct >= 22 && cyPct < 52 && arm)        return cyPct < 38 ? 'tricep' : (cyPct < 32 ? 'lat' : 'forearm');
    if (cyPct >= 22 && cyPct < 52 && (cxPct<36||cxPct>64)) return 'lat';
    if (cyPct >= 27 && cyPct < 48 && center)     return 'mid_back';
    if (cyPct >= 46 && cyPct < 60 && center)     return 'low_back';
    if (cyPct >= 53 && cyPct < 70 && leg)        return 'glute';
    if (cyPct >= 68 && cyPct < 82 && leg)        return 'hamstring';
    if (cyPct >= 80 && leg)                      return 'calf';
  }
  return null;
}

// ── Bir mask'ı işle ───────────────────────────────────────────────────────────
async function processMask(maskPath, key, isFront) {
  const mask = await Jimp.read(maskPath);
  const natW = mask.width, natH = mask.height;
  const { scale, rW, rH, ox, oy } = calcBounds(natW, natH);
  console.log(`  ${natW}×${natH}  offset=(${ox.toFixed(1)},${oy.toFixed(1)})`);

  // 1. Renk kümeleri bul (representative color → {n, sx, sy, pixels})
  const clusters = [];   // [{r,g,b, n, sx, sy, pixels:[{dx,dy}]}]

  for (let ny = 0; ny < natH; ny += 2) {
    for (let nx = 0; nx < natW; nx += 2) {
      const c = intToRGBA(mask.getPixelColor(nx, ny));
      if (isBg(c.r, c.g, c.b, c.a)) continue;

      const dx = Math.round(nx * scale + ox);
      const dy = Math.round(ny * scale + oy);

      // Mevcut küme bul
      let found = null;
      for (const cl of clusters) {
        if (colorDist(c.r,c.g,c.b, cl.r,cl.g,cl.b) <= COLOR_TOL) { found = cl; break; }
      }
      if (!found) {
        found = { r:c.r, g:c.g, b:c.b, n:0, sx:0, sy:0, pixels:[] };
        clusters.push(found);
      }
      found.n++;
      found.sx += dx / DISPLAY_W * 100;
      found.sy += dy / DISPLAY_H * 100;
      found.pixels.push({ dx, dy });
    }
  }

  // 2. Küçük kümeleri filtrele, her kümeye isim ver
  const zoneMap = [];   // [{zoneId, pixels}]
  const usedZones = {};

  for (const cl of clusters.sort((a,b) => b.n - a.n)) {
    if (cl.n < 200) continue;
    const cxPct = cl.sx / cl.n;
    const cyPct = cl.sy / cl.n;
    let id = nameByPos(cxPct, cyPct, isFront);
    if (!id) continue;

    // Aynı zone zaten var mı? Varsa en büyük küme kazanır
    if (!usedZones[id]) {
      usedZones[id] = true;
      zoneMap.push({ id, pixels: cl.pixels, cxPct, cyPct });
      console.log(`    cluster #${('0'+cl.r.toString(16)).slice(-2)}.. n=${cl.n} cy=${cyPct.toFixed(0)}% → ${id}`);
    }
  }

  // 3. Lookup table (renk-bazlı)
  const table = new Array(TABLE_W * TABLE_H).fill(null);

  // Her tablo hücresi için mask pikselini oku → renk küme → zone ID
  const clusterForColor = (r,g,b) => {
    let best = null, bestD = Infinity;
    for (const cl of clusters) {
      if (cl.n < 200) continue;
      const d = colorDist(r,g,b, cl.r,cl.g,cl.b);
      if (d < bestD && d <= COLOR_TOL*1.5) { bestD=d; best=cl; }
    }
    return best;
  };

  for (let ty = 0; ty < TABLE_H; ty++) {
    for (let tx = 0; tx < TABLE_W; tx++) {
      const dx = (tx+0.5)*CELL, dy = (ty+0.5)*CELL;
      if (dx<ox||dx>ox+rW||dy<oy||dy>oy+rH) continue;
      const nx = Math.max(0, Math.min(natW-1, Math.floor((dx-ox)/rW*natW)));
      const ny = Math.max(0, Math.min(natH-1, Math.floor((dy-oy)/rH*natH)));
      const c  = intToRGBA(mask.getPixelColor(nx, ny));
      if (isBg(c.r,c.g,c.b,c.a)) continue;
      const cl = clusterForColor(c.r,c.g,c.b);
      if (!cl) continue;
      // Bu cluster hangi zone?
      const zm = zoneMap.find(z => z.pixels === cl.pixels || colorDist(c.r,c.g,c.b,cl.r,cl.g,cl.b)<=COLOR_TOL);
      // Doğrudan centroid lookup
      const id = nameByPos(cl.sx/cl.n, cl.sy/cl.n, isFront);
      if (id) table[ty*TABLE_W+tx] = id;
    }
  }

  // 4. Per-zone overlay PNG üret
  const found = [];
  for (const { id, pixels } of zoneMap) {
    const col = ZONE_RGBA[id];
    if (!col) continue;

    // Piksel seti (display koordinatları)
    const img = new Jimp({ width: DISPLAY_W, height: DISPLAY_H });
    const set  = new Set(pixels.map(({dx,dy}) => `${dx},${dy}`));

    // Doldur
    for (const { dx, dy } of pixels) {
      if (dx<0||dy<0||dx>=DISPLAY_W||dy>=DISPLAY_H) continue;
      img.setPixelColor(col, dx, dy);
    }

    // 2px dilasyon (boşlukları kapat)
    const out = new Jimp({ width: DISPLAY_W, height: DISPLAY_H });
    for (let y = 0; y < DISPLAY_H; y++) {
      for (let x = 0; x < DISPLAY_W; x++) {
        let hit = false;
        for (let dy2=-2;dy2<=2&&!hit;dy2++)
          for (let dx2=-2;dx2<=2&&!hit;dx2++) {
            const nx2=x+dx2, ny2=y+dy2;
            if (nx2>=0&&ny2>=0&&nx2<DISPLAY_W&&ny2<DISPLAY_H)
              if (img.getPixelColor(nx2,ny2)!==0) hit=true;
          }
        if (hit) out.setPixelColor(col, x, y);
      }
    }

    await out.write(path.join(ZONES_DIR, `${key}_${id}.png`));
    found.push(id);
    process.stdout.write(`    saved ${key}_${id}.png\n`);
  }

  console.log(`  zones: ${found.join(', ')}`);
  return { table, zones: found };
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(ZONES_DIR)) fs.mkdirSync(ZONES_DIR, {recursive:true});

  const masks = [
    { file:'assets/mascot_male/male_front_mask.png',     key:'MF', front:true  },
    { file:'assets/mascot_male/male_back_mask.png',      key:'MB', front:false },
    { file:'assets/mascot_female/female_front_mask.png', key:'FF', front:true  },
    { file:'assets/mascot_female/female_back_mask.png',  key:'FB', front:false },
  ];

  const results = {};
  for (const m of masks) {
    const full = path.join(ROOT, m.file);
    if (!fs.existsSync(full)) { console.log(`SKIP: ${m.file}`); continue; }
    console.log(`\n[${m.key}] ${path.basename(m.file)}`);
    results[m.key] = await processMask(full, m.key, m.front);
  }

  // zoneData.js
  const dataDir = path.join(ROOT, 'src','data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir,{recursive:true});

  let out = `// Auto-generated — DO NOT EDIT\n`;
  out += `// OV_W=${DISPLAY_W} OV_H=${DISPLAY_H} TABLE_W=${TABLE_W} TABLE_H=${TABLE_H} CELL=${CELL}\n\n`;
  out += `export const ZONE_TABLES = {\n`;
  for (const [k,{table}] of Object.entries(results))
    out += `  ${k}: ${JSON.stringify(table)},\n`;
  out += `};\n`;

  fs.writeFileSync(path.join(dataDir,'zoneData.js'), out);
  console.log('\n✓ src/data/zoneData.js');
  console.log('✓ assets/zones/*.png');
}

main().catch(e=>{console.error(e);process.exit(1);});
