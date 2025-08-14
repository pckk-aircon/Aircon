/*

'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

function BabylonMapLayer({
  map,
  worldPosition,
  worldRotate,
  worldScale
}: {
  map: maplibregl.Map;
  worldPosition: BABYLON.Vector3;
  worldRotate: BABYLON.Quaternion;
  worldScale: number;
}) {
  useEffect(() => {
    const customLayer: maplibregl.CustomLayerInterface & {
      engine?: BABYLON.Engine;
      scene?: BABYLON.Scene;
      camera?: BABYLON.Camera;
    } = {
      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',
      onAdd(map, gl) {
        this.engine = new BABYLON.Engine(gl, true, {
          useHighPrecisionMatrix: true
        }, true);

        this.scene = new BABYLON.Scene(this.engine);
        this.scene.autoClear = false;
        this.scene.detachControl();

        this.camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), this.scene);
        this.camera.minZ = 0.001;

        const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), this.scene);
        light.intensity = 0.7;

        new BABYLON.AxesViewer(this.scene, 5);

        BABYLON.SceneLoader.LoadAssetContainerAsync(
          'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/',
          '34M_17.gltf',
          this.scene
        ).then((container) => {
          container.addAllToScene();

          const rootMesh = container.createRootMesh();

          const material = new BABYLON.StandardMaterial("mat", this.scene);
          material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
          rootMesh.material = material;

          rootMesh.setAbsolutePosition(worldPosition);
          rootMesh.rotationQuaternion = worldRotate;
          rootMesh.scaling = new BABYLON.Vector3(worldScale, worldScale, worldScale);
        }).catch((error) => {
          console.error("モデル読み込み失敗:", error);
        });
      },
      render(gl, args) {
        const cameraMatrix = BABYLON.Matrix.FromArray(args.defaultProjectionData.mainMatrix);
        this.camera?.freezeProjectionMatrix(cameraMatrix);
        this.scene?.render(false);
        map.triggerRepaint();
      }
    };

    map.on('style.load', () => {
      map.addLayer(customLayer);
    });
  }, [map, worldPosition, worldRotate, worldScale]);

  return null;
}

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstance) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [139.767, 35.681], // 東京駅
        zoom: 15
      });
      setMapInstance(map);
    }
  }, [mapContainerRef, mapInstance]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {mapInstance && (
        <BabylonMapLayer
          map={mapInstance}
          worldPosition={new BABYLON.Vector3(0, 0, 0)}
          worldRotate={BABYLON.Quaternion.Identity()}
          worldScale={1}
        />
      )}
    </div>
  );
}

*/

'use client';

import React, { useEffect, useRef } from 'react';
import BabylonMap from '../components/BabylonMap';

function App() {
  return (
    <div>
      <h1>Babylon.js + Maplibre GL 地図表示</h1>
      <BabylonMap lon={148.9819} lat={-35.3981} />
    </div>
  );
}

export default App;






