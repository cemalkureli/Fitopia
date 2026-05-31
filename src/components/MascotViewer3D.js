/**
 * MascotViewer3D
 * Renders a GLB 3D model using expo-gl + three.js
 * Supports drag-to-rotate
 */
import React, { useRef, useEffect } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// GLB assets — static requires
const WOMAN_GLB = require('../../assets/mascot_female/woman.glb');

export default function MascotViewer3D({
  width  = 280,
  height = 420,
  style,
}) {
  const glRef     = useRef(null);
  const sceneRef  = useRef(null);
  const cameraRef = useRef(null);
  const rendRef   = useRef(null);
  const modelRef  = useRef(null);
  const rafRef    = useRef(null);
  const rotY      = useRef(0);
  const lastX     = useRef(0);
  const isDrag    = useRef(false);

  // ── PanResponder for drag-to-rotate ──────────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (_, gs) => {
        isDrag.current = true;
        lastX.current  = gs.x0;
      },
      onPanResponderMove: (_, gs) => {
        const dx = gs.moveX - lastX.current;
        rotY.current += dx * 0.012;
        lastX.current = gs.moveX;
        if (modelRef.current) modelRef.current.rotation.y = rotY.current;
      },
      onPanResponderRelease: () => { isDrag.current = false; },
    })
  ).current;

  // ── Three.js setup ────────────────────────────────────────────────────────────
  const onContextCreate = async (gl) => {
    glRef.current = gl;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    rendRef.current = renderer;

    // Scene (transparent bg — blends with app dark background)
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, 0, 2.8);
    cameraRef.current = camera;

    // Lighting — studio setup
    const ambient = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(2, 4, 3);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xe0f0ff, 0.8);
    fill.position.set(-3, 1, 2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffd0a0, 0.6);
    rim.position.set(0, -2, -3);
    scene.add(rim);

    // Load GLB
    try {
      const asset = Asset.fromModule(WOMAN_GLB);
      await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;

      // Fetch the GLB as ArrayBuffer and pass to GLTFLoader
      const response = await fetch(uri);
      const buffer   = await response.arrayBuffer();

      const loader = new GLTFLoader();
      loader.parse(buffer, '', (gltf) => {
        const model = gltf.scene;

        // Auto-center and scale
        const box    = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale  = 1.8 / maxDim;

        model.position.sub(center.multiplyScalar(scale));
        model.scale.setScalar(scale);
        model.position.y -= 0.1; // slight downward shift

        scene.add(model);
        modelRef.current = model;
      }, (err) => {
        console.warn('GLB parse error:', err);
      });
    } catch (e) {
      console.warn('GLB load error:', e);
    }

    // Render loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      // Slow auto-rotation when not dragging
      if (!isDrag.current && modelRef.current) {
        modelRef.current.rotation.y += 0.004;
        rotY.current = modelRef.current.rotation.y;
      }
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (rendRef.current) rendRef.current.dispose();
    };
  }, []);

  return (
    <View style={[{ width, height }, style]} {...pan.panHandlers}>
      <GLView
        style={{ width, height }}
        onContextCreate={onContextCreate}
      />
    </View>
  );
}
