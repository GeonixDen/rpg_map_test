import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { APP_CONFIG } from '../config/appConfig.js';
import CameraController from './CameraController.jsx';
import InteractionLayer from './InteractionLayer.jsx';
import TileLayer from './TileLayer.jsx';

function SceneFallback() {
  return null;
}

export default function MapScene({
  map,
  model,
  fitSignal,
  showTransitionLabels,
  cameraDistance,
  focusTarget,
  onTileClick,
  onRenderStats,
  mapsDict,
}) {
  const { renderer, camera } = APP_CONFIG;

  return (
    <Canvas className="map-canvas" dpr={renderer.dpr} gl={renderer.gl}>
      <color attach="background" args={[renderer.background]} />
      <OrthographicCamera
        makeDefault
        position={[0, 0, camera.positionZ]}
        zoom={camera.initialZoom}
        near={camera.near}
        far={camera.far}
      />
      <Suspense fallback={<SceneFallback />}>
        <TileLayer
          map={map}
          mapsDict={mapsDict}
          model={model}
          showTransitionLabels={showTransitionLabels}
          onRenderStats={onRenderStats}
        />
        <InteractionLayer map={map} dimensions={model.dimensions} onTileClick={onTileClick} />
      </Suspense>
      <CameraController
        dimensions={model.dimensions}
        fitSignal={fitSignal}
        cameraDistance={cameraDistance}
        focusTarget={focusTarget}
      />
    </Canvas>
  );
}
