/*

"use client";

import { useState, useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO } from "date-fns";

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

const client = generateClient<Schema>();

//const MapWith3DModel: React.FC = () => {
export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);

  const [deviceLists, setDevices] = useState<Array<{ Device: string; DeviceName: string; DeviceType: string; gltf: string; Division: string; Controller?: string | null }>>([]);
  console.log('deviceLists=', deviceLists);

  useEffect(() => {
    async function fetchData() {
        await listPost();
    }
    fetchData();
  }, []);

  //deviceLists の状態が更新された後に renderMap 関数を呼び出す
  useEffect(() => {
    if (deviceLists.length > 0) {
      renderMap();
    }
  }, [deviceLists]);

  async function listPost() {
    const { data, errors } = await client.queries.listDevice({
      Controller: "Mutsu01",
    });
    console.log('data（関数内）=', data);
    //divisionLists の状態を更新
    if (data) {
      setDevices(data as Array<{ Device: string; DeviceName: string; DeviceType: string; gltf: string; Division: string; Controller?: string | null }>); // 型を明示的にキャストする
    }
  }

  async function renderMap() {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      style: 'https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL', // APIキー
      zoom: 18,
      center: [140.302994, 35.353503],
      pitch: 60,
      canvasContextAttributes: { antialias: true }
    });

    const worldOrigin: [number, number] = [140.302994, 35.353503];
    const worldAltitude = 0;
    const worldRotate = [Math.PI / 2, 0, 0];

    const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
    const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

    const worldMatrix = BABYLON.Matrix.Compose(
      new BABYLON.Vector3(worldScale, worldScale, worldScale),
      BABYLON.Quaternion.FromEulerAngles(worldRotate[0], worldRotate[1], worldRotate[2]),
      new BABYLON.Vector3(worldOriginMercator.x, worldOriginMercator.y, worldOriginMercator.z)
    );

    const customLayer: maplibregl.CustomLayerInterface = {
      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',

      onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
        // エンジン、シーン、カメラの初期化
        const engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
        const scene = new BABYLON.Scene(engine);
        scene.autoClear = false;
        scene.detachControl();

        scene.beforeRender = () => {
          if (engine) {
            engine.wipeCaches(true);
          }
        };

        const camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), scene);

        const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), scene);
        light.intensity = 0.7;

        new BABYLON.AxesViewer(scene, 10);

        //const gltfJson = JSON.parse(device.gltf);
        const gltfJson = JSON.parse(deviceLists[0].gltf);
        console.log('gltfJson[0]=', gltfJson);



        // URLから.gltfファイルを読み込む
        BABYLON.SceneLoader.LoadAssetContainerAsync(
          'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
          '',
          //'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/',
          //'34M_17.gltf',

          //'https://pckk-device.s3.ap-northeast-1.amazonaws.com/',
          //'34M_17.gltf',

          scene
        //).then((modelContainer) => {
        ).then((gltfJson) => { //変更。         
          const modelContainer = gltfJson ; //変更。

          modelContainer.addAllToScene();



          const rootMesh = modelContainer.createRootMesh();
          const rootMesh2 = rootMesh.clone();

          rootMesh2.position.x = 25;
          rootMesh2.position.z = 25;
        });

        // プロパティをカスタムレイヤーオブジェクトに追加
        (this as any).map = map;
        (this as any).engine = engine;
        (this as any).scene = scene;
        (this as any).camera = camera;
      },

      render(gl: WebGLRenderingContext, args: any) {
        const cameraMatrix = BABYLON.Matrix.FromArray(args.defaultProjectionData.mainMatrix);
        const wvpMatrix = worldMatrix.multiply(cameraMatrix);

        if ((this as any).camera) {
          (this as any).camera.freezeProjectionMatrix(wvpMatrix);
        }
        if ((this as any).scene) {
          (this as any).scene.render(false);
        }
        if ((this as any).map) {
          (this as any).map.triggerRepaint();
        }
      }
    };

    map.on('style.load', () => {
      map.addLayer(customLayer);
    });

    return () => {
      map.remove();
    };

  }

  return <div ref={mapContainer} style={{ width: '80%', height: '200%' }} />;
};

*/

"use client";

import { useState, useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO } from "date-fns";

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

const client = generateClient<Schema>();

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);

  const [deviceLists, setDevices] = useState<Array<{ Device: string; DeviceName: string; DeviceType: string; gltf: string; Division: string; Controller?: string | null }>>([]);
  console.log('deviceLists=', deviceLists);

  useEffect(() => {
    async function fetchData() {
        await listPost();
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (deviceLists.length > 0) {
      renderMap();
    }
  }, [deviceLists]);

  async function listPost() {
    const { data, errors } = await client.queries.listDevice({
      Controller: "Mutsu01",
    });
    console.log('data（関数内）=', data);
    if (data) {
      setDevices(data as Array<{ Device: string; DeviceName: string; DeviceType: string; gltf: string; Division: string; Controller?: string | null }>);
    }
  }

  async function renderMap() {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      style: 'https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL',
      zoom: 18,
      center: [140.302994, 35.353503],
      pitch: 60,
      canvasContextAttributes: { antialias: true }
    });

    const worldOrigin: [number, number] = [140.302994, 35.353503];
    const worldAltitude = 0;
    const worldRotate = [Math.PI / 2, 0, 0];

    const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
    const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

    const worldMatrix = BABYLON.Matrix.Compose(
      new BABYLON.Vector3(worldScale, worldScale, worldScale),
      BABYLON.Quaternion.FromEulerAngles(worldRotate[0], worldRotate[1], worldRotate[2]),
      new BABYLON.Vector3(worldOriginMercator.x, worldOriginMercator.y, worldOriginMercator.z)
    );

    const customLayer: maplibregl.CustomLayerInterface = {
      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',

      onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
        const engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
        const scene = new BABYLON.Scene(engine);
        scene.autoClear = false;
        scene.detachControl();

        scene.beforeRender = () => {
          if (engine) {
            engine.wipeCaches(true);
          }
        };

        const camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), scene);

        const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), scene);
        light.intensity = 0.7;

        new BABYLON.AxesViewer(scene, 10);

        // サンプルの.gltfデータをベタ書き
        const gltfJson = {
          "asset": {
            "version": "2.0"
          },
          "scenes": [
            {
              "nodes": [0]
            }
          ],
          "nodes": [
            {
              "mesh": 0
            }
          ],
          "meshes": [
            {
              "primitives": [
                {
                  "attributes": {
                    "POSITION": 0
                  },
                  "indices": 1
                }
              ]
            }
          ],
          "buffers": [
            {
              "uri": "data:application/octet-stream;base64,AAAA...",
              "byteLength": 1024
            }
          ],
          "bufferViews": [
            {
              "buffer": 0,
              "byteOffset": 0,
              "byteLength": 512,
              "target": 34962
            },
            {
              "buffer": 0,
              "byteOffset": 512,
              "byteLength": 512,
              "target": 34963
            }
          ],
          "accessors": [
            {
              "bufferView": 0,
              "byteOffset": 0,
              "componentType": 5126,
              "count": 24,
              "type": "VEC3",
              "max": [1.0, 1.0, 1.0],
              "min": [-1.0, -1.0, -1.0]
            },
            {
              "bufferView": 1,
              "byteOffset": 0,
              "componentType": 5123,
              "count": 36,
              "type": "SCALAR"
            }
          ]
        };

        BABYLON.SceneLoader.LoadAssetContainerFromData(
          JSON.stringify(gltfJson),
          '',
          scene
        ).then((modelContainer) => {
          modelContainer.addAllToScene();

          const rootMesh = modelContainer.createRootMesh();
          const rootMesh2 = rootMesh.clone();

          rootMesh2.position.x = 25;
          rootMesh2.position.z = 25;
        });

        (this as any).map = map;
        (this as any).engine = engine;
        (this as any).scene = scene;
        (this as any).camera = camera;
      },

      render(gl: WebGLRenderingContext, args: any) {
        const cameraMatrix = BABYLON.Matrix.FromArray(args.defaultProjectionData.mainMatrix);
        const wvpMatrix = worldMatrix.multiply(cameraMatrix);

        if ((this as any).camera) {
          (this as any).camera.freezeProjectionMatrix(wvpMatrix);
        }
        if ((this as any).scene) {
          (this as any).scene.render(false);
        }
        if ((this as any).map) {
          (this as any).map.triggerRepaint();
        }
      }
    };

    map.on('style.load', () => {
      map.addLayer(customLayer);
    });

    return () => {
      map.remove();
    };
  }

  return <div ref={mapContainer} style={{ width: '80%', height: '200%' }} />;
};







