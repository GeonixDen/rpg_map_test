import React from 'react';
import FogOfWarPlane from './FogOfWarPlane.jsx';
import MapEdgeFog from './MapEdgeFog.jsx';

export default function MapFogLayer({ dimensions, fogOfWarEnabled = false, visibleTileKeys = null }) {
  return (
    <>
      <FogOfWarPlane
        dimensions={dimensions}
        visible={fogOfWarEnabled}
        visibleTileKeys={visibleTileKeys}
      />
      <MapEdgeFog dimensions={dimensions} />
    </>
  );
}
