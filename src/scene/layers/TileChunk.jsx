import React, { memo } from 'react';
import TileBatch from './TileBatch.jsx';

function TileChunk({ chunk, image, material, treeMaterial, animateTreeSway }) {
  return (
    <group>
      {chunk.groups.map((group) => (
        <TileBatch
          key={group.id}
          group={group}
          image={image}
          material={group.canSway && animateTreeSway ? treeMaterial : material}
        />
      ))}
    </group>
  );
}

export default memo(TileChunk);
