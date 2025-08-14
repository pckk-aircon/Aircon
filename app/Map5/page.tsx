/*


'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl, { Map, CustomLayerInterface } from 'maplibre-gl';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import 'maplibre-gl/dist/maplibre-gl.css';

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
      //container: 'map',
      container: mapContainer.current, // ← ここを修正
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 19,
          },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#e0dfdf' } },
          { id: 'simple-tiles', type: 'raster', source: 'raster-tiles' },
        ],
      },
      //center: [lon, lat],
      center: [140.3043164,35.3526954],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });


    const worldOrigin: [number, number] = [140.3043164, 35.3526954];
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
        this.engine = new BABYLON.Engine(gl, true, { preserveDrawingBuffer: true, stencil: true }, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.autoClear = false;

        this.camera = new BABYLON.FreeCamera('Camera', new BABYLON.Vector3(0, 0, 100), this.scene);
        this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        this.camera.viewport = new BABYLON.Viewport(0, 0, 1, 1);
        this.camera.setTarget(BABYLON.Vector3.Zero());

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
          rootMesh.scaling = new BABYLON.Vector3(10, 10, 10);
          rootMesh.position = new BABYLON.Vector3(0, 0, 0);

          const cloneMesh = rootMesh.clone('cloneMesh');
          cloneMesh.position = new BABYLON.Vector3(25, 0, 25);

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
        this.scene?.render();
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


*/

'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl, { Map, CustomLayerInterface, LngLatLike, MercatorCoordinate } from 'maplibre-gl';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import 'maplibre-gl/dist/maplibre-gl.css';

const BabylonMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const worldOrigin: LngLatLike = [140.3043164, 35.3526954];
    const worldAltitude = 0;
    const worldRotate = [Math.PI / 2, 0, 0];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#e0dfdf' } },
          { id: 'simple-tiles', type: 'raster', source: 'raster-tiles' },
        ],
      },
      center: worldOrigin,
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    const worldOriginMercator = MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
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

    const customLayer: CustomLayerInterface = {
      id: 'babylon-layer',
      type: 'custom',
      renderingMode: '3d',
      onAdd(map: Map, gl: WebGLRenderingContext) {
        const engine = new BABYLON.Engine(gl, true, { preserveDrawingBuffer: true, stencil: true }, false);
        const scene = new BABYLON.Scene(engine);
        scene.autoClear = false;

        const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 0, 100), scene);
        camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        camera.viewport = new BABYLON.Viewport(0, 0, 1, 1);
        camera.setTarget(BABYLON.Vector3.Zero());

        new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 0, 100), scene);

        BABYLON.SceneLoader.LoadAssetContainerAsync(
          'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
          '',
          scene
        ).then(container => {
          container.addAllToScene();
          const root = container.createRootMesh();
          root.scaling = new BABYLON.Vector3(10, 10, 10);
          root.position = new BABYLON.Vector3(0, 0, 0);
        });

        engine.runRenderLoop(() => {
          scene.render();
        });

        (customLayer as any).scene = scene;
        (customLayer as any).camera = camera;
      },
      render(gl: WebGLRenderingContext, matrix: any) {
        const scene = (customLayer as any).scene;
        const camera = (customLayer as any).camera;
        if (!scene || !camera) return;

        const cameraMatrix = BABYLON.Matrix.FromArray(matrix.defaultProjectionData.mainMatrix);
        const wvpMatrix = worldMatrix.multiply(cameraMatrix);
        camera.freezeProjectionMatrix(wvpMatrix);
        scene.render();
      }
    };

    map.on('style.load', () => {
      map.addLayer(customLayer);
    });
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />;
};

export default BabylonMap;


