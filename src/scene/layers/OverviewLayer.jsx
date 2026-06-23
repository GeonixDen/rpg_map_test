import React, { useEffect, useMemo } from 'react';
import { createOverviewTexture } from '../overviewTexture.js';

export default function OverviewLayer({ map, model, atlasImage, visible }) {
  const texture = useMemo(() => createOverviewTexture(map, model, atlasImage), [map, model, atlasImage]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, 0, -0.04]} visible={visible}>
      <planeGeometry args={[model.dimensions.cols, model.dimensions.rows]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
