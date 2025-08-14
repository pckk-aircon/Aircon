'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl, { Map, CustomLayerInterface } from 'maplibre-gl';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import 'maplibre-gl/dist/maplibre-gl.css';

// Babylon.js のプロパティを含む型安全なカスタムレイヤー定義
interface BabylonCustomLayer extends CustomLayerInterface {
  engine?: BABYLON.Engine;
  scene?: BABYLON.Scene;
  camera?: BABYLON.Camera;
  map?: maplibregl.Map;
}

const BabylonMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map: Map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://api.maptiler.com/maps/basic/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
      zoom: 18,
      center: [148.9819, -35.3981],
      pitch: 60,
      canvasContextAttributes: { antialias: true }
    });

    const worldOrigin: [number, number] = [148.9819, -35.39847];
    const worldAltitude = 0;
    const worldRotate = [Math.PI / 2, 0, 0];

    const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
    const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

    const quaternion = BABYLON.Quaternion.FromEulerAngles(
      worldRotate[0],
      worldRotate[1],
      worldRotate[2]
    );

    const worldMatrix = BABYLON.Matrix.Compose(
      new BABYLON.Vector3(worldScale, worldScale, worldScale),
      quaternion,
      new BABYLON.Vector3(
        worldOriginMercator.x,
        worldOriginMercator.y,
        worldOriginMercator.z
      )
    );

    const customLayer: BabylonCustomLayer = {
      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',
      onAdd(map, gl) {
        this.engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.autoClear = false;
        this.scene.detachControl();
        this.scene.beforeRender = () => this.engine?.wipeCaches(true);

        this.camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), this.scene);

        const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), this.scene);
        light.intensity = 0.7;

        new BABYLON.AxesViewer(this.scene, 10);

        BABYLON.SceneLoader.LoadAssetContainerAsync(
          'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
          '',
          this.scene
        ).then((modelContainer) => {
          modelContainer.addAllToScene();
          const rootMesh = modelContainer.createRootMesh();
          const rootMesh2 = rootMesh.clone();
          rootMesh2.position.x = 25;
          rootMesh2.position.z = 25;
        });

        this.map = map;
      },
      render(gl, args) {
        const cameraMatrix = BABYLON.Matrix.FromArray(args.defaultProjectionData.mainMatrix);
        const wvpMatrix = worldMatrix.multiply(cameraMatrix);
        this.camera?.freezeProjectionMatrix(wvpMatrix);
        this.scene?.render(false);
        this.map?.triggerRepaint();
      }
    };

    map.on('style.load', () => {
      map.addLayer(customLayer);
    });
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
};

export default BabylonMap;













