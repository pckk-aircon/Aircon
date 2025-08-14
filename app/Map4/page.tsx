/*

'use client';

import React, { useEffect, useRef } from 'react';
import BabylonMap from '../components/BabylonMap';

function App() {
  return (
    <div>
      <h1>Babylon.js + Maplibre GL 地図表示</h1>
      <BabylonMap lon={148.9819} lat={-35.39847} />
    </div>
  );
}

export default App;

*/

'use client';

import React, { useEffect } from 'react';
import BabylonMap from '../components/BabylonMap';

function App() {
  // 初期座標（例：キャンベラ）
  const lon = 148.9819;
  const lat = -35.39847;

  useEffect(() => {
    // HTML側に座標を送るイベントを発火
    const event = new CustomEvent('updateCoordinates', {
      detail: { lon, lat }
    });
    window.dispatchEvent(event);
  }, [lon, lat]); // lon/latが変わったら再発火

  return (
    <div>
      <h1>Babylon.js + Maplibre GL 地図表示</h1>
      <BabylonMap lon={lon} lat={lat} />
    </div>
  );
}

export default App;






