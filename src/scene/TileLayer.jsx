import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import * as THREE from 'three';
import { APP_CONFIG } from '../config/appConfig.js';
import { chunksForRange, getVisibleChunkRange } from '../utils/mapModel.js';
import MapEdgeFog from './layers/MapEdgeFog.jsx';
import MapBounds from './layers/MapBounds.jsx';
import OverviewLayer from './layers/OverviewLayer.jsx';
import TransitionLabelsLayer from './layers/TransitionLabelsLayer.jsx';
import TileChunk from './layers/TileChunk.jsx';
import { createTreeSwayMaterial, updateTreeSwayMaterial } from './materials/createTreeSwayMaterial.js';

export default function TileLayer({ map, mapsDict, model, showTransitionLabels, onRenderStats }) {
  const texture = useTexture(APP_CONFIG.data.tilesetUrl);
  const { camera, size } = useThree();
  const [range, setRange] = useState(null);
  const [mode, setMode] = useState('chunks');
  const lastRangeKeyRef = useRef('');
  const lastModeRef = useRef('chunks');

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
  }, [texture]);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false,
      }),
    [texture],
  );
  const treeMaterial = useMemo(() => createTreeSwayMaterial(texture), [texture]);

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => treeMaterial.dispose(), [treeMaterial]);

  useEffect(() => {
    setRange(null);
    setMode('chunks');
    lastRangeKeyRef.current = '';
    lastModeRef.current = 'chunks';
  }, [model]);

  useFrame(({ clock }) => {
    const { lod } = APP_CONFIG;
    const nextMode =
      lastModeRef.current === 'overview'
        ? camera.zoom < lod.overviewExitZoom
          ? 'overview'
          : 'chunks'
        : camera.zoom < lod.overviewEnterZoom && model.dimensions.cells > lod.overviewMinCells
          ? 'overview'
          : 'chunks';

    if (nextMode !== lastModeRef.current) {
      lastModeRef.current = nextMode;
      setMode(nextMode);
    }

    if (nextMode === 'overview') return;

    const nextRange = getVisibleChunkRange(model, camera, size, 1);
    if (nextRange && nextRange.key !== lastRangeKeyRef.current) {
      lastRangeKeyRef.current = nextRange.key;
      setRange(nextRange);
    }

    updateTreeSwayMaterial(treeMaterial, clock.elapsedTime);
  });

  const visibleChunks = useMemo(() => chunksForRange(model, range), [model, range]);
  const visibleTreeInstances = useMemo(
    () =>
      visibleChunks.reduce(
        (sum, chunk) =>
          sum + chunk.groups.reduce((chunkSum, group) => chunkSum + (group.canSway ? group.count : 0), 0),
        0,
      ),
    [visibleChunks],
  );
  const animateTreeSway =
    APP_CONFIG.treeSway.enabled &&
    visibleTreeInstances > 0 &&
    visibleTreeInstances <= APP_CONFIG.treeSway.maxAnimatedInstances &&
    mode === 'chunks';
  const [spring] = useSpring(
    () => ({
      from: { scale: 0.96 },
      to: { scale: 1 },
      reset: true,
      config: { tension: 180, friction: 24 },
    }),
    [model.id],
  );

  useEffect(() => {
    onRenderStats?.({
      mode,
      visibleChunks: mode === 'overview' ? 0 : visibleChunks.length,
      totalChunks: model.chunks.length,
    });
  }, [mode, model.chunks.length, onRenderStats, visibleChunks.length]);

  return (
    <group>
      <OverviewLayer map={map} model={model} atlasImage={texture.image} visible={mode === 'overview'} />
      <a.group scale={spring.scale.to((value) => [value, value, 1])} visible={mode === 'chunks'}>
        {visibleChunks.map((chunk) => (
          <TileChunk
            key={chunk.id}
            chunk={chunk}
            image={texture.image}
            material={material}
            treeMaterial={treeMaterial}
            animateTreeSway={animateTreeSway}
          />
        ))}
        <MapBounds dimensions={model.dimensions} />
      </a.group>
      <MapEdgeFog dimensions={model.dimensions} />
      <TransitionLabelsLayer map={map} mapsDict={mapsDict} dimensions={model.dimensions} visible={showTransitionLabels} />
    </group>
  );
}
