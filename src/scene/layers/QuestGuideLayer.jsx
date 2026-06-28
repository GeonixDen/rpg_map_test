import React, { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';
import { tileToWorld } from '../../utils/mapModel.js';

function toWorldPoint(point, dimensions) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const world = tileToWorld(x, y, dimensions);
  return { x: world.x, y: world.y };
}

function getDistanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function getRouteStartIndex(path, origin) {
  if (!path.length || !origin) return 0;

  const originPoint = { x: origin.worldX, y: origin.worldY };
  const minDistanceSq = 0.4 * 0.4;
  const firstAhead = path.findIndex((point) => getDistanceSq(point, originPoint) > minDistanceSq);
  return firstAhead === -1 ? path.length - 1 : firstAhead;
}

function getPathPoint(path, indexFloat) {
  if (!path.length) return null;

  const lowerIndex = Math.max(0, Math.min(path.length - 1, Math.floor(indexFloat)));
  const upperIndex = Math.max(0, Math.min(path.length - 1, lowerIndex + 1));
  const lower = path[lowerIndex];
  const upper = path[upperIndex];
  const mix = Math.max(0, Math.min(1, indexFloat - lowerIndex));

  return {
    x: lower.x + (upper.x - lower.x) * mix,
    y: lower.y + (upper.y - lower.y) * mix,
  };
}

function getInitialPathPoint(path, origin) {
  if (origin) return { x: origin.worldX, y: origin.worldY };
  return path[0] || null;
}

function getRouteSignature(guide, points) {
  if (!guide || !points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];

  return [
    guide.mapId || '',
    guide.target?.x ?? '',
    guide.target?.y ?? '',
    points.length,
    `${first.x.toFixed(3)},${first.y.toFixed(3)}`,
    `${last.x.toFixed(3)},${last.y.toFixed(3)}`,
  ].join(':');
}

function isRouteComplete(path, origin, distanceTiles) {
  if (!path.length || !origin) return false;
  const final = path[path.length - 1];
  const originPoint = { x: origin.worldX, y: origin.worldY };
  return getDistanceSq(final, originPoint) <= distanceTiles * distanceTiles;
}

function setMaterialOpacity(material, opacity) {
  if (!material) return;
  material.opacity = opacity;
  material.visible = opacity > 0.002;
}

function getChaosOffset(time, progress, config) {
  const radius = Number(config.chaosRadius) || 0;
  if (radius <= 0) return { x: 0, y: 0 };

  const speed = Number(config.chaosSpeed) || 1;
  const phase = progress * (Number(config.chaosPhaseScale) || 0.5);

  return {
    x: (
      Math.sin(time * speed + phase) +
      Math.sin(time * speed * 1.83 + phase * 0.41) * 0.48
    ) * radius,
    y: (
      Math.cos(time * speed * 1.31 + phase * 0.73) +
      Math.sin(time * speed * 2.17 - phase * 0.29) * 0.38
    ) * radius,
  };
}

function pushTrailPoint(history, point, maxLength) {
  const last = history[0];
  if (!last || getDistanceSq(last, point) > 0.0009) {
    history.unshift({ x: point.x, y: point.y });
  }

  if (history.length > maxLength) {
    history.length = maxLength;
  }
}

function QuestGuideLayer({
  guide,
  dimensions,
  followWorldRef,
}) {
  const groupRef = useRef(null);
  const glowMaterialRef = useRef(null);
  const coreMaterialRef = useRef(null);
  const tailMaterialRefs = useRef([]);
  const tailMeshRefs = useRef([]);
  const trailHistoryRef = useRef([]);
  const activePathRef = useRef([]);
  const pendingRouteRef = useRef(null);
  const signatureRef = useRef('');
  const colorRef = useRef(APP_CONFIG.questGuide.color);
  const fadeTargetRef = useRef(0);
  const opacityRef = useRef(0);
  const progressRef = useRef(0);
  const loopResetRef = useRef(false);
  const posRef = useRef(null);
  const prevRef = useRef(null);
  const config = APP_CONFIG.questGuide;

  const route = useMemo(() => {
    if (!dimensions?.cols || !dimensions?.rows) {
      return { points: [], signature: '', color: config.color };
    }

    const sourcePoints = Array.isArray(guide?.points) && guide.points.length
      ? guide.points
      : [guide?.target].filter(Boolean);
    const points = sourcePoints.map((point) => toWorldPoint(point, dimensions)).filter(Boolean);

    return {
      points,
      signature: getRouteSignature(guide, points),
      color: guide?.color || config.color,
    };
  }, [dimensions, guide]);

  useEffect(() => {
    if (!route.signature || !route.points.length) {
      pendingRouteRef.current = null;
      fadeTargetRef.current = 0;
      return;
    }

    const nextRoute = {
      points: route.points,
      signature: route.signature,
      color: route.color,
    };

    if (!signatureRef.current || opacityRef.current <= 0.03) {
      activePathRef.current = nextRoute.points;
      signatureRef.current = nextRoute.signature;
      colorRef.current = nextRoute.color;
      pendingRouteRef.current = null;
      progressRef.current = 0;
      loopResetRef.current = false;
      posRef.current = null;
      prevRef.current = null;
      trailHistoryRef.current = [];
      fadeTargetRef.current = 1;
      return;
    }

    if (signatureRef.current === nextRoute.signature) {
      activePathRef.current = nextRoute.points;
      colorRef.current = nextRoute.color;
      pendingRouteRef.current = null;
      fadeTargetRef.current = 1;
      return;
    }

    pendingRouteRef.current = nextRoute;
    fadeTargetRef.current = 0;
  }, [route.color, route.points, route.signature]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const path = activePathRef.current;
    const dt = Math.max(0.001, delta);

    if (!path.length) {
      group.visible = false;
      return;
    }

    const time = clock.elapsedTime;
    const origin = followWorldRef?.current;
    const completionFade = isRouteComplete(path, origin, config.completeDistanceTiles);
    const desiredOpacity = completionFade ? 0 : fadeTargetRef.current;
    const fadeSpeed = desiredOpacity > opacityRef.current ? config.fadeInSpeed : config.fadeOutSpeed;
    const fadeAlpha = 1 - Math.exp(-dt * fadeSpeed);
    opacityRef.current += (desiredOpacity - opacityRef.current) * fadeAlpha;

    if (opacityRef.current <= 0.02 && fadeTargetRef.current <= 0) {
      const pendingRoute = pendingRouteRef.current;

      if (pendingRoute) {
        activePathRef.current = pendingRoute.points;
        signatureRef.current = pendingRoute.signature;
        colorRef.current = pendingRoute.color;
        pendingRouteRef.current = null;
        progressRef.current = 0;
        loopResetRef.current = false;
        posRef.current = null;
        prevRef.current = null;
        trailHistoryRef.current = [];
        fadeTargetRef.current = 1;
      } else if (loopResetRef.current && route.signature) {
        progressRef.current = 0;
        loopResetRef.current = false;
        posRef.current = null;
        prevRef.current = null;
        trailHistoryRef.current = [];
        fadeTargetRef.current = 1;
      } else if (!route.signature) {
        activePathRef.current = [];
        signatureRef.current = '';
      }
    }

    const opacity = Math.max(0, Math.min(1, opacityRef.current));
    group.visible = opacity > 0.003 || fadeTargetRef.current > 0;
    setMaterialOpacity(glowMaterialRef.current, config.glowOpacity * opacity);
    setMaterialOpacity(coreMaterialRef.current, config.coreOpacity * opacity);
    tailMaterialRefs.current.forEach((material, index) => {
      const tail = (config.tail || [])[index];
      setMaterialOpacity(material, (tail?.opacity || 0) * opacity);
    });

    glowMaterialRef.current?.color.set(colorRef.current);
    coreMaterialRef.current?.color.set(config.coreColor);
    tailMaterialRefs.current.forEach((material) => material?.color.set(colorRef.current));

    if (!group.visible || !activePathRef.current.length) return;

    if (completionFade || fadeTargetRef.current <= 0) return;

    const startIndex = getRouteStartIndex(activePathRef.current, origin);
    const routeSpan = Math.max(0, activePathRef.current.length - 1 - startIndex);
    progressRef.current += dt * config.routeTravelSpeed;

    if (progressRef.current >= routeSpan) {
      progressRef.current = routeSpan;
      loopResetRef.current = routeSpan > 0;
      fadeTargetRef.current = 0;
    }

    const target = getPathPoint(activePathRef.current, startIndex + progressRef.current);
    if (!target) return;

    if (!posRef.current) {
      posRef.current = getInitialPathPoint(activePathRef.current, origin) || { x: target.x, y: target.y };
    }

    const current = posRef.current;
    const alpha = 1 - Math.exp(-Math.max(0.001, delta) * config.followSpeed);
    current.x += (target.x - current.x) * alpha;
    current.y += (target.y - current.y) * alpha;

    const bobX = Math.sin(time * config.bobSpeed) * config.bobRadius;
    const bobY = Math.cos(time * config.bobSpeed * 1.37) * config.bobRadius * 0.75;
    const chaos = getChaosOffset(time, progressRef.current, config);
    const pulse = 1 + Math.sin(time * config.pulseSpeed) * config.pulseScale;
    const displayPoint = {
      x: current.x + bobX + chaos.x,
      y: current.y + bobY + chaos.y,
    };

    pushTrailPoint(trailHistoryRef.current, displayPoint, config.trailHistoryLength || 24);
    tailMeshRefs.current.forEach((mesh, index) => {
      const tail = (config.tail || [])[index];
      const sample = trailHistoryRef.current[Math.min(trailHistoryRef.current.length - 1, tail?.lag || (index + 1) * 4)];
      if (!mesh || !sample) return;
      mesh.position.set(sample.x - displayPoint.x, sample.y - displayPoint.y, -0.001 * (index + 1));
    });

    prevRef.current = displayPoint;
    group.position.set(displayPoint.x, displayPoint.y, config.z);
    group.rotation.set(0, 0, 0);
    group.scale.setScalar(pulse * (0.82 + opacity * 0.18));
  });

  if (!config.enabled) return null;

  return (
    <group ref={groupRef} visible={false} renderOrder={config.renderOrder} raycast={() => null}>
      <mesh renderOrder={config.renderOrder}>
        <circleGeometry args={[config.glowRadius, 28]} />
        <meshBasicMaterial
          ref={glowMaterialRef}
          color={config.color}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={config.renderOrder + 1}>
        <circleGeometry args={[config.coreRadius, 18]} />
        <meshBasicMaterial
          ref={coreMaterialRef}
          color={config.coreColor}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {(config.tail || []).map((tail, index) => (
        <mesh
          key={tail.lag || index}
          ref={(mesh) => {
            tailMeshRefs.current[index] = mesh;
          }}
          position={[0, 0, -0.001 * (index + 1)]}
          renderOrder={config.renderOrder - index - 1}
        >
          <circleGeometry args={[tail.radius, 14]} />
          <meshBasicMaterial
            ref={(material) => {
              tailMaterialRefs.current[index] = material;
            }}
            color={config.color}
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default memo(QuestGuideLayer);
