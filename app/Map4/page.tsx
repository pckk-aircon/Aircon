/*

'use client';
import React from 'react';

const MapPage = () => {
  // 渡したいパラメータを定義
  const lon = 140.3032013;
  const lat = 35.3537465;
  const modelUrl = 'TempModel.glb';
  const scale = 1.5;
  const rotation = [Math.PI / 2, 0, 0];

  // クエリ文字列を構築
  const query = new URLSearchParams({
    lon: lon.toString(),
    lat: lat.toString(),
    modelUrl,
    scale: scale.toString(),
    rx: rotation[0].toString(),
    ry: rotation[1].toString(),
    rz: rotation[2].toString()
  }).toString();

  // iframeのsrcにクエリを付加
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

*/

'use client';
import React from 'react';

const MapPage = () => {
  const models = [
    {
      lon: 140.3032013,
      lat: 35.3537465,
      modelUrl: 'TempModel.glb',
      scale: 1.5,
      rotation: [Math.PI / 2, 0, 0]
    },
    {
      lon: 140.3040000,
      lat: 35.3540000,
      modelUrl: 'AirconModel.glb',
      scale: 1.2,
      rotation: [Math.PI / 2, 0, Math.PI / 4]
    }
  ];

  const query = encodeURIComponent(JSON.stringify(models));
  const iframeSrc = `/map.html?models=${query}`;

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












