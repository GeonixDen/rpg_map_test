import React from 'react';
import TileBatch from './TileBatch.jsx';

export default function TileChunk({ chunk, image, material }) {
  return (
    <group>
      {chunk.groups.map((group) => (
        <TileBatch key={group.tileKey} group={group} image={image} material={material} />
      ))}
    </group>
  );
}
