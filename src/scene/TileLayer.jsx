import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import * as THREE from 'three';
import { APP_CONFIG } from '../config/appConfig.js';
import { chunksForRange, getVisibleChunkRange } from '../utils/mapModel.js';
import MapFogLayer from './layers/MapFogLayer.jsx';
import MapBounds from './layers/MapBounds.jsx';
import OverviewLayer from './layers/OverviewLayer.jsx';
import ShaderTileLayer from './layers/ShaderTileLayer.jsx';
import TransitionLabelsLayer from './layers/TransitionLabelsLayer.jsx';
import TileChunk from './layers/TileChunk.jsx';
import { createTreeSwayMaterial, updateTreeSwayMaterial } from './materials/createTreeSwayMaterial.js';

export default function TileLayer({
  map,
  mapsDict,
  model,
  showTransitionLabels,
  fogOfWarEnabled = false,
  visibleTileKeys = null,
  transitionLabelBlockers = [],
  onSceneReady,
}) {
  const useShaderTilemap = APP_CONFIG.mapRenderer.type === 'shader';
  const texture = useTexture(APP_CONFIG.data.tilesetUrl);
  const { camera, size } = useThree();
  const [range, setRange] = useState(null);
  const [mode, setMode] = useState('chunks');
  const lastRangeKeyRef = useRef('');
  const lastModeRef = useRef('chunks');
  const sceneReadyReportedRef = useRef(false);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 1;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
  }, [texture]);

  const material = useMemo(
    () =>
      useShaderTilemap
        ? null
        : new THREE.MeshBasicMaterial({
            map: texture,
            toneMapped: false,
          }),
    [texture, useShaderTilemap],
  );
  const treeMaterial = useMemo(
    () => (useShaderTilemap ? null : createTreeSwayMaterial(texture)),
    [texture, useShaderTilemap],
  );

  useEffect(() => () => material?.dispose(), [material]);
  useEffect(() => () => treeMaterial?.dispose(), [treeMaterial]);

  useEffect(() => {
    setRange(null);
    setMode('chunks');
    lastRangeKeyRef.current = '';
    lastModeRef.current = 'chunks';
    sceneReadyReportedRef.current = false;
  }, [model.id]);

  useFrame(({ clock }) => {
    if (useShaderTilemap) return;

    const { lod } = APP_CONFIG;
    const nextMode = fogOfWarEnabled
      ? 'chunks'
      : lastModeRef.current === 'overview'
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

  const visibleChunks = useMemo(
    () => (useShaderTilemap ? [] : chunksForRange(model, range)),
    [model, range, useShaderTilemap],
  );
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
    if (sceneReadyReportedRef.current || !onSceneReady || !texture.image) return undefined;

    const hasRenderableTiles =
      useShaderTilemap || mode === 'overview' || visibleChunks.length > 0 || model.chunks.length === 0;
    if (!hasRenderableTiles) return undefined;

    const frameId = requestAnimationFrame(() => {
      sceneReadyReportedRef.current = true;
      onSceneReady(model.id);
    });

    return () => cancelAnimationFrame(frameId);
  }, [mode, model.chunks.length, model.id, onSceneReady, texture.image, useShaderTilemap, visibleChunks.length]);

  return (
    <group>
      <MapFogLayer
        dimensions={model.dimensions}
        fogOfWarEnabled={fogOfWarEnabled}
        visibleTileKeys={visibleTileKeys}
      />
      {useShaderTilemap ? (
        <ShaderTileLayer map={map} model={model} atlasTexture={texture} />
      ) : null}
      {!useShaderTilemap && !fogOfWarEnabled ? (
        <OverviewLayer map={map} model={model} atlasImage={texture.image} visible={mode === 'overview'} />
      ) : null}
      <a.group scale={spring.scale.to((value) => [value, value, 1])} visible={!useShaderTilemap && mode === 'chunks'}>
        {!useShaderTilemap
          ? visibleChunks.map((chunk) => (
              <TileChunk
                key={chunk.id}
                chunk={chunk}
                image={texture.image}
                material={material}
                treeMaterial={treeMaterial}
                animateTreeSway={animateTreeSway}
              />
            ))
          : null}
        {!fogOfWarEnabled ? <MapBounds dimensions={model.dimensions} /> : null}
      </a.group>
      {useShaderTilemap && !fogOfWarEnabled ? <MapBounds dimensions={model.dimensions} /> : null}
      <TransitionLabelsLayer
        map={map}
        mapsDict={mapsDict}
        dimensions={model.dimensions}
        visible={showTransitionLabels}
        visibleTileKeys={visibleTileKeys}
        blockedTiles={transitionLabelBlockers}
      />
    </group>
  );
}
