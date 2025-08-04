/*


"use client";

import { useState, useEffect } from "react";
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

import { addGeoJsonLayerToMap } from '../utils/addGeoJsonLayerToMap';

import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

import { useController } from "@/app/context/ControllerContext"; // ← 追加

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {

  const { controller } = useController(); // ← Sidebarで選択されたcontrollerを取得

  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; Geojson: string ;Controller?: string | null }>>([]);
  const [deviceLists, setDevices] = useState<Array<{
    Device: string;
    DeviceName: string;
    DeviceType: string;
    gltf: string;
    direction: string;
    height: string;
    lat: string;
    lon: string;
    model: string;
    Division: string;
    Controller?: string | null }>>([]);
  
  console.log('divisionLists（State直後）=', divisionLists);

  useEffect(() => {
    async function fetchData() {
        await listPost();
    }
    fetchData();
  }, [controller]);


  //divisionLists の状態が更新された後に renderMap 関数を呼び出す
  useEffect(() => {
    if (divisionLists.length > 0) {
      renderMap();
    }
  }, [divisionLists]);


  async function listPost() {

    const { data: divisionData, errors: divisionErrors } = await client.queries.listDivision({
      Controller: controller,
    });

    const { data: deviceData, errors: deviceErrors } = await client.queries.listDevice({
      Controller: controller,
    });

    if (divisionData) {
      setPosts(divisionData as Array<{ Division: string; DivisionName: string; Geojson: string; Controller?: string | null }>);
    }

    if (deviceData) {
      setDevices(deviceData as Array<{
        Device: string;
        DeviceName: string;
        DeviceType: string;
        gltf: string;
        direction: string;
        height: string;
        lat: string;
        lon: string;
        model: string;
        Division: string;
        Controller?: string | null }>);
    }
}

  let map: maplibregl.Map; // map変数をスコープ外で定義

  async function renderMap() {

    console.log("controller=", controller);

    let lon, lat;

    if (controller === "Mutsu01") {
      lon = 140.302994;
      lat = 35.353503;
    } else if (controller === "Koura01") {
      lon = 136.275547;
      lat = 35.201848;
    } else {
      lon = 0;
      lat = 0;
    }

    //const map = new maplibregl.Map({
    map = new maplibregl.Map({
      container: 'map',
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
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#e0dfdf',
            },
          },
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
          },
        ],
      },
      //center: [140.302994, 35.353503],
      center: [lon, lat],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    // マウス操作で回転と角度変更を有効にする
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
      
    // カスタムハンドラーを作成して回転の感度を調整
    map.on('mousemove', (e) => {
      if (e.originalEvent.buttons === 2) { // 右クリック
        const rotationSpeed = 0.5; // 回転速度を調整
        map.rotateTo(map.getBearing() + e.originalEvent.movementX * rotationSpeed);
      }
    });
      
    // NavigationControlの追加
    const nav = new maplibregl.NavigationControl({
      showCompass: true, // コンパスを表示
      visualizePitch: true, // ピッチ（角度）を表示
    });
    map.addControl(nav, 'top-left');

    map.on('load', () => {

      divisionLists.forEach((division, index) => {
        addGeoJsonLayerToMap(map, division, index);  
      })//endEach

    });


    // 3Dモデルを表示するためのカスタムレイヤーを作成
    deviceLists.forEach((device, index) => {
      const worldOrigin: [number, number] = [Number(device.lon), Number(device.lat)];
      const worldAltitude = Number(device.height);
      //const worldRotate = [Math.PI / 2, 0, 0];
      const worldRotate = JSON.parse(device.direction);

      const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
      const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

      const worldMatrix = BABYLON.Matrix.Compose(
        new BABYLON.Vector3(worldScale, worldScale, worldScale),
        BABYLON.Quaternion.FromEulerAngles(worldRotate[0], worldRotate[1], worldRotate[2]),
        new BABYLON.Vector3(worldOriginMercator.x, worldOriginMercator.y, worldOriginMercator.z)
      );

      const customLayer: maplibregl.CustomLayerInterface = {
        id: `3d-model-${index}`, // カスタムレイヤーの ID を一意にするための識別子
        //id: '3d-model',
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

        // URLから.gltfファイルを読み込む
        console.log("DeviceType=", device.DeviceType);
        BABYLON.SceneLoader.LoadAssetContainerAsync(
          'https://pckk-device.s3.ap-southeast-2.amazonaws.com/',
          `${device.DeviceType}Model.glb`, // ← ここを動的に
          //'sample.gltf',

          scene
        ).then((modelContainer) => {
          modelContainer.addAllToScene();

          //const rootMesh = modelContainer.createRootMesh();
          //const rootMesh2 = rootMesh.clone();
          //rootMesh2.position.x = 25;
          //rootMesh2.position.z = 25;
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

      // 3Dモデルを地図に追加
      map.on('style.load', () => {
        if (!map.getLayer('3d-model')) {
          map.addLayer(customLayer);
        }
      });

      return () => {
        map.remove();
      };

    }); //endEach

  }

  return <div id="map" style={{ height: '80vh', width: '80%' }} />;

}


*/


"use client";

import { useState, useEffect } from "react";
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

import { addGeoJsonLayerToMap } from '../utils/addGeoJsonLayerToMap';

import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

import { useController } from "@/app/context/ControllerContext"; // ← 追加

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {

  const { controller } = useController(); // ← Sidebarで選択されたcontrollerを取得

  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; Geojson: string ;Controller?: string | null }>>([]);
  const [deviceLists, setDevices] = useState<Array<{
    Device: string;
    DeviceName: string;
    DeviceType: string;
    gltf: string;
    direction: string;
    height: string;
    lat: string;
    lon: string;
    model: string;
    Division: string;
    Controller?: string | null }>>([]);
  
  console.log('divisionLists（State直後）=', divisionLists);

  useEffect(() => {
    async function fetchData() {
        await listPost();
    }
    fetchData();
  }, [controller]);


  //divisionLists の状態が更新された後に renderMap 関数を呼び出す
  useEffect(() => {
    if (divisionLists.length > 0) {
      renderMap();
    }
  }, [divisionLists]);


  async function listPost() {

    const { data: divisionData, errors: divisionErrors } = await client.queries.listDivision({
      Controller: controller,
    });

    const { data: deviceData, errors: deviceErrors } = await client.queries.listDevice({
      Controller: controller,
    });

    if (divisionData) {
      setPosts(divisionData as Array<{ Division: string; DivisionName: string; Geojson: string; Controller?: string | null }>);
    }

    if (deviceData) {
      setDevices(deviceData as Array<{
        Device: string;
        DeviceName: string;
        DeviceType: string;
        gltf: string;
        direction: string;
        height: string;
        lat: string;
        lon: string;
        model: string;
        Division: string;
        Controller?: string | null }>);
    }
}

  let map: maplibregl.Map; // map変数をスコープ外で定義

  async function renderMap() {

    console.log("controller=", controller);

    let lon, lat;

    if (controller === "Mutsu01") {
      lon = 140.302994;
      lat = 35.353503;
    } else if (controller === "Koura01") {
      lon = 136.275547;
      lat = 35.201848;
    } else {
      lon = 0;
      lat = 0;
    }

    //const map = new maplibregl.Map({
    map = new maplibregl.Map({
      container: 'map',
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
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#e0dfdf',
            },
          },
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
          },
        ],
      },
      //center: [140.302994, 35.353503],
      center: [lon, lat],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    // マウス操作で回転と角度変更を有効にする
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
      
    // カスタムハンドラーを作成して回転の感度を調整
    map.on('mousemove', (e) => {
      if (e.originalEvent.buttons === 2) { // 右クリック
        const rotationSpeed = 0.5; // 回転速度を調整
        map.rotateTo(map.getBearing() + e.originalEvent.movementX * rotationSpeed);
      }
    });
      
    // NavigationControlの追加
    const nav = new maplibregl.NavigationControl({
      showCompass: true, // コンパスを表示
      visualizePitch: true, // ピッチ（角度）を表示
    });
    map.addControl(nav, 'top-left');

    map.on('load', () => {

      divisionLists.forEach((division, index) => {
        addGeoJsonLayerToMap(map, division, index);  
      })//endEach

    });


    // 3Dモデルを表示するためのカスタムレイヤーを作成
    deviceLists.forEach((device, index) => {
      const worldOrigin: [number, number] = [Number(device.lon), Number(device.lat)];
      const worldAltitude = Number(device.height);
      const worldRotate = JSON.parse(device.direction);

      const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
      const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

      const worldMatrix = BABYLON.Matrix.Compose(
        new BABYLON.Vector3(worldScale, worldScale, worldScale),
        BABYLON.Quaternion.FromEulerAngles(worldRotate[0], worldRotate[1], worldRotate[2]),
        new BABYLON.Vector3(worldOriginMercator.x, worldOriginMercator.y, worldOriginMercator.z)
      );


      const customLayer: maplibregl.CustomLayerInterface = {
        id: `3d-model-${index}`, // カスタムレイヤーの ID を一意にするための識別子
        //id: '3d-model',
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
        camera.minZ = 0.001; // ←小さいオブジェクトを正しく描画できるようにするための調整。

        const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), scene);
        light.intensity = 0.7;

        new BABYLON.AxesViewer(scene, 5); // 軸のサイズを小さく。デフォルトは10。

        // URLから.gltfファイルを読み込む
        console.log("DeviceType=", device.DeviceType);
        BABYLON.SceneLoader.LoadAssetContainerAsync(
          'https://pckk-device.s3.ap-southeast-2.amazonaws.com/',
          `${device.DeviceType}Model.glb`, // ←ファイル名を動的に

          scene
        ).then((modelContainer) => {
          modelContainer.addAllToScene();

          // モデル内のメッシュに対して回転を適用
          modelContainer.meshes.forEach((mesh) => {
            mesh.rotation.y = BABYLON.Tools.ToRadians(-45); // Y軸まわりに右回り回転
          });

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

      // 3Dモデルを地図に追加
      map.on('style.load', () => {
        if (!map.getLayer('3d-model')) {
          map.addLayer(customLayer);
        }
      });

      return () => {
        map.remove();
      };

    }); //endEach

  }

  return <div id="map" style={{ height: '80vh', width: '80%' }} />;

}

/*

async function renderMap() {
  initializeMap(); // 地図の初期化と基本設定
  map.on('load', () => {
    divisionLists.forEach((division, index) => {
      addGeoJsonLayerToMap(map, division, index);
    });
    add3DModels(); // deviceListsに基づいて3Dモデルを追加
  });
}

function initializeMap() {
  map = new maplibregl.Map({ ... }); // 地図初期化
  map.dragRotate.enable();
  map.touchZoomRotate.enableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-left');
  map.on('mousemove', ...); // 回転処理
}

function add3DModels() {
  deviceLists.forEach((device, index) => {
    // 各deviceに対する3Dモデル追加処理
  });
}


*/