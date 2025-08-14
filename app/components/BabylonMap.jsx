/*

import React, { useEffect, useRef } from 'react';

// Babylon.js & Maplibre GL の外部スクリプトを読み込む
const loadScript = (src) => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    document.head.appendChild(script);
  });
};

const BabylonMap = ({ lon, lat }) => {
  const mapContainerRef = useRef(null);

  useEffect(() => {
    const initMapAndBabylon = async () => {
      await loadScript('https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js');
      await loadScript('https://unpkg.com/babylonjs@5.42.2/babylon.js');
      await loadScript('https://unpkg.com/babylonjs-loaders@5.42.2/babylonjs.loaders.min.js');

      const BABYLON = window.BABYLON;
      const maplibregl = window.maplibregl;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL',
        zoom: 18,
        center: [lon, lat],
        pitch: 60,
        canvasContextAttributes: { antialias: true }
      });

      const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0);
      const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();
      const worldRotate = [Math.PI / 2, 0, 0];

      const worldMatrix = BABYLON.Matrix.Compose(
        new BABYLON.Vector3(worldScale, worldScale, worldScale),
        BABYLON.Quaternion.FromEulerAngles(...worldRotate),
        new BABYLON.Vector3(
          worldOriginMercator.x,
          worldOriginMercator.y,
          worldOriginMercator.z
        )
      );

      const customLayer = {
        id: '3d-model',
        type: 'custom',
        renderingMode: '3d',
        onAdd(map, gl) {
          this.engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
          this.scene = new BABYLON.Scene(this.engine);
          this.scene.autoClear = false;
          this.scene.detachControl();

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
          this.camera.freezeProjectionMatrix(wvpMatrix);
          this.scene.render(false);
          this.map.triggerRepaint();
        }
      };

      map.on('style.load', () => {
        map.addLayer(customLayer);
      });
    };

    initMapAndBabylon();
  }, [lon, lat]);

  return <div ref={mapContainerRef} style={{ width: '100%', height: '100vh' }} />;
};

export default BabylonMap;


*/

import React, { useEffect, useRef } from 'react';

// Babylon.js & Maplibre GL の外部スクリプトを読み込む
const loadScript = (src) => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    document.head.appendChild(script);
  });
};

const BabylonMap = ({ lon, lat }) => {
  const mapContainerRef = useRef(null);

  useEffect(() => {
    const initMapAndBabylon = async () => {
      await loadScript('https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js');
      await loadScript('https://unpkg.com/babylonjs@5.42.2/babylon.js');
      await loadScript('https://unpkg.com/babylonjs-loaders@5.42.2/babylonjs.loaders.min.js');

      const BABYLON = window.BABYLON;
      const maplibregl = window.maplibregl;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL',
        zoom: 18,
        center: [lon, lat],
        pitch: 60,
        canvasContextAttributes: { antialias: true }
      });

      const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0);
      const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();
      const worldRotate = [Math.PI / 2, 0, 0];

      const worldMatrix = BABYLON.Matrix.Compose(
        new BABYLON.Vector3(worldScale, worldScale, worldScale),
        BABYLON.Quaternion.FromEulerAngles(...worldRotate),
        new BABYLON.Vector3(
          worldOriginMercator.x,
          worldOriginMercator.y,
          worldOriginMercator.z
        )
      );

      const customLayer = {
        id: '3d-model',
        type: 'custom',
        renderingMode: '3d',
        onAdd(map, gl) {
          this.engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
          this.scene = new BABYLON.Scene(this.engine);
          this.scene.autoClear = false;
          this.scene.detachControl();

          this.camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), this.scene);

          const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), this.scene);
          light.intensity = 0.7;

          new BABYLON.AxesViewer(this.scene, 10);

          //const modelUrl = `${device.DeviceType}Model.glb`;
          const modelUrl = "AirconModel.glb";

          BABYLON.SceneLoader.LoadAssetContainerAsync(
            //'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
            //'',

            'https://pckk-device.s3.ap-southeast-2.amazonaws.com/',
            modelUrl,

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
          this.camera.freezeProjectionMatrix(wvpMatrix);
          this.scene.render(false);
          this.map.triggerRepaint();
        }
      };

      map.on('style.load', () => {
        map.addLayer(customLayer);
      });
    };

    initMapAndBabylon();
  }, [lon, lat]);

  return <div ref={mapContainerRef} style={{ width: '100%', height: '100vh' }} />;
};

export default BabylonMap;

