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
  const iframeSrc = `/map4.html?${query}`;

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














