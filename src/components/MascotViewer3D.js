import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, PanResponder, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Asset } from 'expo-asset';
import { C } from '../utils/theme';

// ─── Polyfill document for Three.js in React Native ──────────────────────────
if (typeof global.document === 'undefined') {
  global.document = {
    createElementNS: (_ns, tag) => {
      const el = { style: {}, addEventListener: () => {}, removeEventListener: () => {} };
      if (tag === 'canvas') el.getContext = () => null;
      return el;
    },
    createElement: (tag) => {
      const el = { style: {}, addEventListener: () => {}, removeEventListener: () => {} };
      if (tag === 'canvas') el.getContext = () => null;
      return el;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}
if (typeof global.window === 'undefined') {
  global.window = global;
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WOMAN_GLB = require('../../assets/mascot_female/woman.glb');
const MAN_GLB   = require('../../assets/mascot_male/man.glb');

export default function MascotViewer3D({ gender = 'female', width = 280, height = 420, style }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [errMsg, setErrMsg] = useState('');

  const rendRef   = useRef(null);
  const modelRef  = useRef(null);
  const rafRef    = useRef(null);
  const rotY      = useRef(0);
  const lastX     = useRef(0);
  const isDrag    = useRef(false);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (_, gs) => { isDrag.current = true;  lastX.current = gs.x0; },
    onPanResponderMove: (_, gs) => {
      rotY.current += (gs.moveX - lastX.current) * 0.012;
      lastX.current = gs.moveX;
      if (modelRef.current) modelRef.current.rotation.y = rotY.current;
    },
    onPanResponderRelease: () => { isDrag.current = false; },
  })).current;

  const onContextCreate = async (gl) => {
    try {
      const W = gl.drawingBufferWidth;
      const H = gl.drawingBufferHeight;

      // Renderer — fully transparent background
      const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0); // transparent
      rendRef.current = renderer;

      // Scene
      const scene = new THREE.Scene();

      // Camera — show full body with room to spare
      const camera = new THREE.PerspectiveCamera(38, W / H, 0.01, 1000);
      camera.position.set(0, 0, 3.2);

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2, 4, 3); scene.add(key);
      const fill = new THREE.DirectionalLight(0xb0d0ff, 0.9);
      fill.position.set(-3, 0, 2); scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffc080, 0.5);
      rim.position.set(0, -3, -3); scene.add(rim);

      // Load correct GLB based on gender
      const asset = Asset.fromModule(gender === 'male' ? MAN_GLB : WOMAN_GLB);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      console.log('[3D] Loading GLB from:', uri);

      // Fetch as ArrayBuffer
      const res = await fetch(uri);
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const buf = await res.arrayBuffer();
      console.log('[3D] GLB buffer size:', buf.byteLength);

      await new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.parse(buf, '', (gltf) => {
          const sceneRoot = gltf.scene;
          const topChild = sceneRoot.children[0]; // the grouped container
          console.log('[3D] topChild children:', topChild?.children?.length);

          // Go one level deeper — take only the FIRST sub-child (first model)
          const model = new THREE.Group();
          if (topChild?.children?.length > 1) {
            // Two models inside — clone just the first one
            const firstModel = topChild.children[0];
            model.add(firstModel);
            console.log('[3D] Using sub-child 0 of', topChild.children.length);
          } else {
            // Single model — use as-is
            model.add(topChild || sceneRoot);
          }

          // Replace all textures/materials with plain metallic (Blob API not supported in RN)
          model.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xd0ccc8,
                metalness: 0.55,
                roughness: 0.35,
              });
              child.castShadow = false;
              child.receiveShadow = false;
            }
          });

          // Center + scale to fit view
          const box  = new THREE.Box3().setFromObject(model);
          const ctr  = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const sc = 1.4 / maxDim; // smaller scale so full body fits

          model.scale.setScalar(sc);
          model.position.set(-ctr.x * sc, -ctr.y * sc, -ctr.z * sc);

          // Rotate to face front (try 0 first, if still sideways use Math.PI)
          model.rotation.y = Math.PI;

          scene.add(model);
          modelRef.current = model;
          console.log('[3D] Model added. size:', JSON.stringify(size), 'scale:', sc);
          resolve();
        }, (err) => { reject(err); });
      });

      setStatus('ok');

      // Render loop
      const animate = () => {
        rafRef.current = requestAnimationFrame(animate);
        if (!isDrag.current && modelRef.current) {
          modelRef.current.rotation.y += 0.005;
          rotY.current = modelRef.current.rotation.y;
        }
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();

    } catch (e) {
      console.error('[3D] Error:', e);
      setStatus('error');
      setErrMsg(String(e?.message ?? e));
    }
  };

  // Cleanup on gender change AND unmount
  useEffect(() => {
    return () => {
      if (rafRef.current)  { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (rendRef.current) { rendRef.current.dispose(); rendRef.current = null; }
      modelRef.current = null;
      setStatus('loading');
    };
  }, [gender]);

  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}
      {...(status === 'ok' ? pan.panHandlers : {})}>
      <GLView key={gender} style={{ width, height, position: 'absolute' }} onContextCreate={onContextCreate} />
      {status === 'loading' && (
        <View style={styles.overlay}>
          <ActivityIndicator color={C.lime} size="large" />
          <Text style={styles.txt}>3D model yükleniyor...</Text>
        </View>
      )}
      {status === 'error' && (
        <View style={styles.overlay}>
          <Text style={[styles.txt, { color: C.red }]}>⚠ {errMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', alignItems: 'center', gap: 8, padding: 16 },
  txt:     { color: C.muted, fontSize: 12, textAlign: 'center' },
});
