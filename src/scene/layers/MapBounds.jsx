import React, { useMemo } from 'react';
import { APP_CONFIG } from '../../config/appConfig.js';

export default function MapBounds({ dimensions }) {
  const cfg = APP_CONFIG.mapBounds;
  const points = useMemo(() => {
    const w = dimensions.cols / 2;
    const h = dimensions.rows / 2;
    return new Float32Array([
      -w, -h, cfg.z,
      w, -h, cfg.z,
      w, -h, cfg.z,
      w, h, cfg.z,
      w, h, cfg.z,
      -w, h, cfg.z,
      -w, h, cfg.z,
      -w, -h, cfg.z,
    ]);
  }, [cfg.z, dimensions]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={cfg.color} transparent opacity={cfg.opacity} toneMapped={false} />
    </lineSegments>
  );
}
