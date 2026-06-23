import React, { useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { MOUSE, Vector3 } from 'three';
import { APP_CONFIG } from '../config/appConfig.js';

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export default function CameraController({ dimensions, fitSignal, cameraDistance, focusTarget }) {
  const controlsRef = useRef(null);
  const flyToRef = useRef(null);
  const { camera, size, invalidate } = useThree();
  const { camera: cameraConfig } = APP_CONFIG;

  const applyCameraDistance = useCallback(() => {
    if (!cameraDistance || !size.width || !size.height) return;

    camera.zoom = Math.max(
      cameraConfig.minZoom,
      Math.min(cameraConfig.maxZoom, Math.min(size.width, size.height) / cameraDistance),
    );
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, cameraConfig.maxZoom, cameraConfig.minZoom, cameraDistance, invalidate, size.height, size.width]);

  const fitMap = useCallback(() => {
    if (!dimensions?.cols || !dimensions?.rows || !size.width || !size.height) return;

    const zoomX = size.width / (dimensions.cols + cameraConfig.fit.paddingTiles);
    const zoomY = size.height / (dimensions.rows + cameraConfig.fit.paddingTiles);
    const zoom = Math.max(
      cameraConfig.fit.minZoom,
      Math.min(cameraConfig.fit.maxZoom, Math.min(zoomX, zoomY) * cameraConfig.fit.scale),
    );

    camera.position.set(0, 0, cameraConfig.positionZ);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }

    invalidate();
  }, [camera, cameraConfig, dimensions, invalidate, size.height, size.width]);

  useEffect(() => {
    fitMap();
  }, [fitMap, fitSignal]);

  useEffect(() => {
    applyCameraDistance();
  }, [applyCameraDistance]);

  useEffect(() => {
    if (!focusTarget) return;

    const controls = controlsRef.current;
    const target = controls?.target || new Vector3(camera.position.x, camera.position.y, 0);

    flyToRef.current = {
      elapsed: 0,
      duration: cameraConfig.flyTo.duration,
      startPosition: camera.position.clone(),
      endPosition: new Vector3(focusTarget.worldX, focusTarget.worldY, camera.position.z),
      startTarget: target.clone(),
      endTarget: new Vector3(focusTarget.worldX, focusTarget.worldY, 0),
    };
    invalidate();
  }, [camera, cameraConfig.flyTo.duration, focusTarget, invalidate]);

  useFrame((_, delta) => {
    const flight = flyToRef.current;
    if (!flight) return;

    flight.elapsed += delta;
    const t = Math.min(1, flight.elapsed / flight.duration);
    const eased = easeOutCubic(t);

    camera.position.lerpVectors(flight.startPosition, flight.endPosition, eased);

    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(flight.startTarget, flight.endTarget, eased);
      controlsRef.current.update();
    }

    camera.updateProjectionMatrix();
    invalidate();

    if (t >= 1) {
      flyToRef.current = null;
    }
  });

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
