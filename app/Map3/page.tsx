'use client';
import React from 'react';

const MapPage = () => {
  const models = [
    {
      lon: 140.3032013,
      lat: 35.3537465,
      modelUrl: 'TempModel.glb',
      scale: 1.5,
      rx: Math.PI / 2,
      ry: 0,
      rz: 0
    },
    {
      lon: 140.304,
      lat: 35.354,
      modelUrl: 'AirconModel.glb',
      scale: 1.2,
      rx: Math.PI / 2,
      ry: 0,
      rz: Math.PI / 4
    }
  ];

  const query = new URLSearchParams({
    models: JSON.stringify(models)
  }).toString();

  const iframeSrc = `/map.html?${query}`;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <iframe
        src={iframeSrc}
        title="Babylon.js Map"
        width="100%"
        height="100%"
        style={{ border: 'none' }}
      />
    </div>
  );
};

export default MapPage;





