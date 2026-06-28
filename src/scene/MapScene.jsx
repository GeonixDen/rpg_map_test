import React, { memo, Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { APP_CONFIG } from '../config/appConfig.js';
import { tileToWorld } from '../utils/mapModel.js';
import CameraController from './CameraController.jsx';
import InteractionLayer from './InteractionLayer.jsx';
import AnimatedEntityLayer from './layers/AnimatedEntityLayer.jsx';
import DynamicEntitiesLayer from './layers/DynamicEntitiesLayer.jsx';
import QuestGuideLayer from './layers/QuestGuideLayer.jsx';
import TileLayer from './TileLayer.jsx';

function SceneFallback() {
  return null;
}

function MapScene({
  map,
  model,
  cameraMode,
  showTransitionLabels,
  fogOfWarEnabled = false,
  visibleTileKeys = null,
  visibleTileBounds = null,
  interactionEnabled = true,
  lockedHoverTile,
  hoverLayers,
  actionsByTile,
  movementAnimation,
  playerEntity,
  questGuide,
  onMovementComplete,
  onTileClick,
  onRenderStats,
  mapsDict,
  otherPlayers = [],
  actors = [],
  transitionLabelBlockers = [],
}) {
  const { renderer, camera } = APP_CONFIG;
  const playerWorldRef = useRef(null);

  useEffect(() => {
    const x = Number(playerEntity?.x);
    const y = Number(playerEntity?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !model?.dimensions) {
      playerWorldRef.current = null;
      return;
    }

    const world = tileToWorld(x, y, model.dimensions);
    playerWorldRef.current = { worldX: world.x, worldY: world.y };
  }, [model?.dimensions, playerEntity]);

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
          fogOfWarEnabled={fogOfWarEnabled}
          visibleTileKeys={visibleTileKeys}
          transitionLabelBlockers={transitionLabelBlockers}
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
          entity={playerEntity}
          animation={movementAnimation}
          dimensions={model.dimensions}
          mapType={model.mapType}
          z={APP_CONFIG.dynamicEntities.actors.z}
          renderOrder={APP_CONFIG.dynamicEntities.actors.renderOrder + 1}
          worldPositionRef={playerWorldRef}
          onComplete={onMovementComplete}
        />
        <QuestGuideLayer
          guide={questGuide}
          dimensions={model.dimensions}
          followWorldRef={playerWorldRef}
        />
        <InteractionLayer
          map={map}
          dimensions={model.dimensions}
          enabled={interactionEnabled}
          lockedTile={lockedHoverTile}
          hoverLayers={hoverLayers}
          actionsByTile={actionsByTile}
          visibleTileKeys={visibleTileKeys}
          onTileClick={onTileClick}
        />
      </Suspense>
      <CameraController
        dimensions={model.dimensions}
        mode={cameraMode}
        followWorldRef={playerWorldRef}
        fitBounds={fogOfWarEnabled ? visibleTileBounds : null}
      />
    </Canvas>
  );
}

export default memo(MapScene);
