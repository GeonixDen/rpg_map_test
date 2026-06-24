import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { MOUSE, Vector3 } from 'three';
import { APP_CONFIG } from '../config/appConfig.js';
import { tileToWorld } from '../utils/mapModel.js';
import { sampleMovementPath } from '../utils/movementPath.js';

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getRendererDpr(gl) {
  const dpr = Number(gl?.getPixelRatio?.());
  const windowDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  return Number.isFinite(dpr) && dpr > 0 ? dpr : windowDpr || 1;
}

function snapZoomToTilePixels(zoom, cameraConfig, gl) {
  const cfg = APP_CONFIG.pixelArt;
  if (!cfg?.enabled || !cfg.snapFollowZoom || zoom < cfg.minSnapZoom) return zoom;

  const dpr = getRendererDpr(gl);
  const tileSize = APP_CONFIG.tileAtlas.tileSize;
  const scale = Math.max(1, Math.round((zoom * dpr) / tileSize));
  const snapped = (tileSize * scale) / dpr;
  return Math.max(cameraConfig.minZoom, Math.min(cameraConfig.maxZoom, snapped));
}

function snapCameraPositionToPixels(camera, gl) {
  const cfg = APP_CONFIG.pixelArt;
  if (!cfg?.enabled || !cfg.snapCameraPosition) return;

  const pixelsPerWorldUnit = camera.zoom * getRendererDpr(gl);
  if (!Number.isFinite(pixelsPerWorldUnit) || pixelsPerWorldUnit <= 0) return;

  const worldStep = 1 / pixelsPerWorldUnit;
  camera.position.x = Math.round(camera.position.x / worldStep) * worldStep;
  camera.position.y = Math.round(camera.position.y / worldStep) * worldStep;
}

function getFollowZoom(size, cameraConfig, gl) {
  const distance = APP_CONFIG.camera.distance.default;
  if (!distance || !size.width || !size.height) return cameraConfig.initialZoom;

  const zoom = Math.max(
    cameraConfig.minZoom,
    Math.min(cameraConfig.maxZoom, Math.min(size.width, size.height) / distance),
  );
  return snapZoomToTilePixels(zoom, cameraConfig, gl);
}

function getFitZoom(dimensions, size, cameraConfig) {
  if (!dimensions?.cols || !dimensions?.rows || !size.width || !size.height) return null;

  const zoomX = size.width / (dimensions.cols + cameraConfig.fit.paddingTiles);
  const zoomY = size.height / (dimensions.rows + cameraConfig.fit.paddingTiles);

  return Math.max(
    cameraConfig.fit.minZoom,
    Math.min(cameraConfig.fit.maxZoom, Math.min(zoomX, zoomY) * cameraConfig.fit.scale),
  );
}

function getFollowWorldPoint(followTarget, followAnimation, dimensions) {
  const animatedPoint = sampleMovementPath(followAnimation, undefined, {
    easing: APP_CONFIG.movement.cameraEasing,
  });
  if (animatedPoint && dimensions) {
    const world = tileToWorld(animatedPoint.x, animatedPoint.y, dimensions);
    return { worldX: world.x, worldY: world.y };
  }

  return followTarget;
}

export default function CameraController({ dimensions, mode = 'follow', followTarget, followAnimation }) {
  const controlsRef = useRef(null);
  const flyToRef = useRef(null);
  const [controlsReady, setControlsReady] = useState(false);
  const { camera, gl, size, invalidate } = useThree();
  const { camera: cameraConfig } = APP_CONFIG;
  const isFullMap = mode === 'full';
  const startCameraFlight = useCallback(
    ({ endPosition, endZoom, endTarget, durationScale = 1, enableControlsOnDone = false }) => {
      const target = controlsRef.current?.target || new Vector3(camera.position.x, camera.position.y, 0);
      const duration = Math.max(0.18, cameraConfig.flyTo.duration * durationScale);

      flyToRef.current = {
        elapsed: 0,
        duration,
        startPosition: camera.position.clone(),
        endPosition,
        startTarget: target.clone(),
        endTarget,
        startZoom: camera.zoom,
        endZoom,
        enableControlsOnDone,
      };
      invalidate();
    },
    [camera, cameraConfig.flyTo.duration, invalidate],
  );

  useEffect(() => {
    if (isFullMap) {
      const zoom = getFitZoom(dimensions, size, cameraConfig);
      if (zoom == null) return;

      setControlsReady(false);
      startCameraFlight({
        endPosition: new Vector3(0, 0, cameraConfig.positionZ),
        endTarget: new Vector3(0, 0, 0),
        endZoom: zoom,
        durationScale: 1.35,
        enableControlsOnDone: true,
      });
      return;
    }

    setControlsReady(false);
    flyToRef.current = null;
  }, [cameraConfig, dimensions, isFullMap, size, startCameraFlight]);

  useFrame((_, delta) => {
    const flight = flyToRef.current;

    if (flight) {
      flight.elapsed += delta;
      const t = Math.min(1, flight.elapsed / flight.duration);
      const eased = easeOutCubic(t);

      camera.position.lerpVectors(flight.startPosition, flight.endPosition, eased);
      camera.zoom = flight.startZoom + (flight.endZoom - flight.startZoom) * eased;
      camera.updateProjectionMatrix();

      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(flight.startTarget, flight.endTarget, eased);
        controlsRef.current.update();
      }

      invalidate();

      if (t >= 1) {
        camera.position.copy(flight.endPosition);
        camera.zoom = flight.endZoom;
        camera.updateProjectionMatrix();
        if (controlsRef.current) {
          controlsRef.current.target.copy(flight.endTarget);
          controlsRef.current.update();
        }
        if (flight.enableControlsOnDone) {
          setControlsReady(true);
        }
        flyToRef.current = null;
      }
      return;
    }

    const target = isFullMap ? null : getFollowWorldPoint(followTarget, followAnimation, dimensions);
    if (!target) return;

    const smoothing = followAnimation ? cameraConfig.follow.movementSmoothing : cameraConfig.follow.smoothing;
    const alpha = 1 - Math.exp(-delta * smoothing);
    const targetPosition = new Vector3(target.worldX, target.worldY, cameraConfig.positionZ);
    const targetZoom = getFollowZoom(size, cameraConfig, gl);

    camera.position.lerp(targetPosition, alpha);
    camera.zoom += (targetZoom - camera.zoom) * alpha;
    snapCameraPositionToPixels(camera, gl);
    camera.updateProjectionMatrix();
    invalidate();
  });

  if (!isFullMap || !controlsReady) return null;

  return (
    <MapControls
      ref={controlsRef}
      enableRotate={false}
      enableDamping
      dampingFactor={cameraConfig.controls.dampingFactor}
      screenSpacePanning
      minZoom={cameraConfig.minZoom}
      maxZoom={cameraConfig.maxZoom}
      mouseButtons={{
        LEFT: MOUSE.PAN,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
      }}
    />
  );
}
