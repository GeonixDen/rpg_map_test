import React, { memo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { APP_CONFIG } from '../config/appConfig.js';
import CameraController from './CameraController.jsx';
import InteractionLayer from './InteractionLayer.jsx';
import AnimatedEntityLayer from './layers/AnimatedEntityLayer.jsx';
import DynamicEntitiesLayer from './layers/DynamicEntitiesLayer.jsx';
import TileLayer from './TileLayer.jsx';

function SceneFallback() {
  return null;
}

function MapScene({
  map,
  model,
  cameraMode,
  showTransitionLabels,
  followTarget,
  interactionEnabled = true,
  lockedHoverTile,
  hoverLayers,
  actionsByTile,
  movementAnimation,
  movingEntity,
  onMovementComplete,
  onTileClick,
  onRenderStats,
  mapsDict,
  otherPlayers = [],
  actors = [],
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
        <DynamicEntitiesLayer
          entities={otherPlayers}
          dimensions={model.dimensions}
          mapType={model.mapType}
          z={APP_CONFIG.dynamicEntities.otherPlayers.z}
          renderOrder={APP_CONFIG.dynamicEntities.otherPlayers.renderOrder}
        />
        <DynamicEntitiesLayer
          entities={actors}
          dimensions={model.dimensions}
          mapType={model.mapType}
          z={APP_CONFIG.dynamicEntities.actors.z}
          renderOrder={APP_CONFIG.dynamicEntities.actors.renderOrder}
        />
        <AnimatedEntityLayer
          entity={movingEntity}
          animation={movementAnimation}
          dimensions={model.dimensions}
          mapType={model.mapType}
          z={APP_CONFIG.dynamicEntities.actors.z}
          renderOrder={APP_CONFIG.dynamicEntities.actors.renderOrder + 1}
          onComplete={onMovementComplete}
        />
        <InteractionLayer
          map={map}
          dimensions={model.dimensions}
          enabled={interactionEnabled}
          lockedTile={lockedHoverTile}
          hoverLayers={hoverLayers}
          actionsByTile={actionsByTile}
          onTileClick={onTileClick}
        />
      </Suspense>
      <CameraController
        dimensions={model.dimensions}
        mode={cameraMode}
        followTarget={followTarget}
        followAnimation={movementAnimation}
      />
    </Canvas>
  );
}

export default memo(MapScene);
