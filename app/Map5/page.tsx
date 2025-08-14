'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl, { Map, CustomLayerInterface } from 'maplibre-gl';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import 'maplibre-gl/dist/maplibre-gl.css';

// 型安全なカスタムレイヤー定義
interface BabylonCustomLayer extends CustomLayerInterface {
  engine?: BABYLON.Engine;
  scene?: BABYLON.Scene;
  camera?: BABYLON.FreeCamera;
  map?: maplibregl.Map;
}

const BabylonMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: "map",
      style: "https://demotiles.maplibre.org/style.json",
      center: [140.302994, 35.353503],
      zoom: 17,
      pitch: 30,    
      bearing: 30,
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
        this.engine = new BABYLON.Engine(gl, true, { preserveDrawingBuffer: true }, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.autoClear = false;
        this.scene.detachControl();
        this.scene.beforeRender = () => this.engine?.wipeCaches(true);

        this.camera = new BABYLON.FreeCamera('Camera', new BABYLON.Vector3(0, 0, 0), this.scene);
        this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        this.camera.viewport = new BABYLON.Viewport(0, 0, 1, 1);

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

          this.scene?.executeWhenReady(() => {
            this.scene?.render();
          });
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

  // JSX を返すことで ts(2322) エラーを回避
  return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
};

export default BabylonMap;














