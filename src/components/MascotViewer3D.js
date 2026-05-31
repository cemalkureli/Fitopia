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

export default function MascotViewer3D({ width = 280, height = 420, style }) {
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

      // Camera — closer, looking at model center
      const camera = new THREE.PerspectiveCamera(40, W / H, 0.01, 1000);
      camera.position.set(0, 0.1, 2.2);

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2, 4, 3); scene.add(key);
      const fill = new THREE.DirectionalLight(0xb0d0ff, 0.9);
      fill.position.set(-3, 0, 2); scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffc080, 0.5);
      rim.position.set(0, -3, -3); scene.add(rim);

      // Load GLB
      const asset = Asset.fromModule(WOMAN_GLB);
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
          console.log('[3D] scenes:', gltf.scenes?.length, 'children:', gltf.scene?.children?.length);

          // Use ONLY the first scene/model (GLB has 2, user wants first/front one)
          let model;
          if (gltf.scenes && gltf.scenes.length > 0) {
            model = gltf.scenes[0];  // first scene only
          } else {
            model = gltf.scene;
          }

          // If first scene has children, use only first child
          if (model.children && model.children.length > 1) {
            const firstChild = model.children[0].clone();
            model = new THREE.Group();
            model.add(firstChild);
          }

          // Center + scale to fit view
          const box  = new THREE.Box3().setFromObject(model);
          const ctr  = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const sc = 1.8 / maxDim;

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

  useEffect(() => () => {
    if (rafRef.current)  cancelAnimationFrame(rafRef.current);
    if (rendRef.current) rendRef.current.dispose();
  }, []);

  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}
      {...(status === 'ok' ? pan.panHandlers : {})}>
      <GLView style={{ width, height, position: 'absolute' }} onContextCreate={onContextCreate} />
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
