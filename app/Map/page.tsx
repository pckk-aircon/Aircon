/*


"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { addGeoJsonLayerToMap } from '../utils/addGeoJsonLayerToMap';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

import { useController } from "@/app/context/ControllerContext";

Amplify.configure(outputs);
const client = generateClient<Schema>();

interface Division {
  Division: string;
  DivisionName: string;
  Geojson: string;
  Controller?: string | null;
}

interface Device {
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
  Controller?: string | null;
}

export default function App(): JSX.Element {
  const { controller } = useController();

  const [divisionLists, setDivisionLists] = useState<Division[]>([]);
  const [deviceLists, setDeviceLists] = useState<Device[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data: divisionData } = await client.queries.listDivision({ Controller: controller });
      const { data: deviceData } = await client.queries.listDevice({ Controller: controller });

      if (divisionData) {
        const filteredDivisionData = divisionData.filter(
          (item): item is Division =>
            item?.DivisionName !== undefined && item?.Geojson !== undefined
        );
        setDivisionLists(filteredDivisionData);
      }

      if (deviceData) {
        const filteredDeviceData = deviceData.filter(
          (item): item is Device =>
            item !== null && item !== undefined &&
            item.lat !== undefined && item.lon !== undefined && item.height !== undefined
        );
        setDeviceLists(filteredDeviceData);
      }
    }

    fetchData();
  }, [controller]);

  useEffect(() => {
    if (divisionLists.length > 0) {
      renderMap();
    }
  }, [divisionLists]);

  function renderMap(): void {
    let lon = 0, lat = 0;
    if (controller === "Mutsu01") {
      lon = 140.302994;
      lat = 35.353503;
    } else if (controller === "Koura01") {
      lon = 136.275547;
      lat = 35.201848;
    }

    const map = new maplibregl.Map({
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
          { id: 'background', type: 'background', paint: { 'background-color': '#e0dfdf' } },
          { id: 'simple-tiles', type: 'raster', source: 'raster-tiles' },
        ],
      },
      center: [lon, lat],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();

    const nav = new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true });
    map.addControl(nav, 'top-left');

    map.on('load', async () => {
      divisionLists.forEach((division, index) => {
        addGeoJsonLayerToMap(map, division, index);
      });

      const gl = (map.getCanvas() as HTMLCanvasElement).getContext('webgl2');
      if (!gl) return;

      const engine = new BABYLON.Engine(gl, true, {
        preserveDrawingBuffer: true,
        useHighPrecisionMatrix: true
      }, true);
      const scene = new BABYLON.Scene(engine);
      scene.autoClear = false;
      scene.detachControl();

      const camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), scene);
      camera.minZ = 0.001;

      const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), scene);
      light.intensity = 0.7;

      new BABYLON.AxesViewer(scene, 5);

      for (const device of deviceLists.slice(0, 4)) {
        const lon = Number(device.lon);
        const lat = Number(device.lat);
        const height = Number(device.height);

        if (
          device.lon == null || device.lat == null || device.height == null ||
          isNaN(lon) || isNaN(lat) || isNaN(height)
        ) {
          console.warn(`Invalid coordinates or height:`, device);
          continue;
        }

        const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], height);
        const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

        if (!worldScale || isNaN(worldScale)) {
          console.warn(`Invalid scale value:`, worldScale);
          continue;
        }

        const worldRotate = createCombinedQuaternionFromDirection(device.direction);

        const worldPosition = new BABYLON.Vector3(
          worldOriginMercator.x,
          worldOriginMercator.y,
          worldOriginMercator.z
        );

        const worldMatrix = BABYLON.Matrix.Compose(
          new BABYLON.Vector3(worldScale, worldScale, worldScale),
          worldRotate,
          worldPosition
        );

        const modelUrl = `${device.DeviceType}Model.glb`;

        try {
          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            null,
            'https://pckk-device.s3.ap-southeast-2.amazonaws.com/',
            modelUrl,
            scene
          );

          if (result.meshes.length === 0) {
            console.warn(`No mesh loaded: ${device.DeviceType}`);
          }

          result.meshes.forEach(mesh => {
            mesh.alwaysSelectAsActiveMesh = true;
            mesh.computeWorldMatrix(true);
            mesh.freezeWorldMatrix();
            mesh.setPivotMatrix(BABYLON.Matrix.Identity());
            mesh.setAbsolutePosition(worldPosition);
          });

          const customLayer: maplibregl.CustomLayerInterface = {
            id: `3d-model-${device.Device}`,
            type: 'custom',
            renderingMode: '3d',
            onAdd() {},
            render(gl: WebGLRenderingContext, args: any) {
              const cameraMatrix = BABYLON.Matrix.FromArray(args.defaultProjectionData.mainMatrix);
              const wvpMatrix = worldMatrix.multiply(cameraMatrix);
              camera.freezeProjectionMatrix(wvpMatrix);
              scene.render(false);
              map.triggerRepaint();
            }
          };

          map.addLayer(customLayer);
        } catch (error) {
          console.error(`Failed to load model: ${device.DeviceType}`, error);
        }
      }
    });
  }

  return <div id="map" style={{ height: '80vh', width: '80%' }} />;
}

function createCombinedQuaternionFromDirection(directionRaw: string): BABYLON.Quaternion {
  let direction: [number, number, number] = [0, 0, 0];

  try {
    if (!directionRaw || typeof directionRaw !== 'string') {
      throw new Error("directionRaw is null, undefined, or not a string");
    }

    if (!directionRaw.trim().startsWith("[")) {
      directionRaw = `[${directionRaw}]`;
    }

    const parsed = JSON.parse(directionRaw);

    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      typeof parsed[0] === 'number' &&
      typeof parsed[1] === 'number' &&
      typeof parsed[2] === 'number'
    ) {
      direction = [parsed[0], parsed[1], parsed[2]];
    } else {
      console.warn("Invalid direction format, using default [0,0,0]");
    }
  } catch (error) {
    console.error("Failed to parse direction:", error);
    return BABYLON.Quaternion.Identity();
  }

  const [x, y, z] = direction;

  const xRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, x);
  const yRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, y);
  const zRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, z);

  return xRot.multiply(yRot).multiply(zRot);
}


*/


"use client";

import { useEffect, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import maplibregl from "maplibre-gl";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

Amplify.configure(outputs);
const client = generateClient<Schema>();

interface Device {
  Device: string;
  DeviceType: string;
  direction: string;
  height: string;
  lat: string;
  lon: string;
}

export default function BabylonMap(): JSX.Element {
  const [deviceLists, setDeviceLists] = useState<Device[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    async function fetchDevices() {
      const { data } = await client.queries.listDevice({});
      if (data) {
        const filtered = data.filter(
          (d): d is Device =>
            typeof d?.lat === "string" &&
            typeof d?.lon === "string" &&
            typeof d?.height === "string" &&
            !isNaN(Number(d.lat)) &&
            !isNaN(Number(d.lon))
        );
        setDeviceLists(filtered);
      }
    }
    fetchDevices();
  }, []);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: "map",
      style: "https://demotiles.maplibre.org/style.json",
      center: [140.302994, 35.353503],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });

    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

    const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.minZ = 0.001;

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    map.on("load", () => {
      deviceLists.forEach(async (device) => {
        const lon = Number(device.lon);
        const lat = Number(device.lat);
        const height = Number(device.height);

        const mercator = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], height);
        const scale = mercator.meterInMercatorCoordinateUnits();
        const position = new BABYLON.Vector3(mercator.x, mercator.y, mercator.z);

        try {
          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            null,
            "https://pckk-device.s3.ap-southeast-2.amazonaws.com/",
            `${device.DeviceType}Model.glb`,
            scene
          );

          result.meshes.forEach((mesh) => {
            mesh.setAbsolutePosition(position);
            mesh.scaling = new BABYLON.Vector3(scale, scale, scale);
          });

          // カメラをモデルに合わせて移動
          camera.setTarget(position);
          camera.position = new BABYLON.Vector3(position.x, position.y + 5, position.z - 10);
        } catch (error) {
          console.error("モデルの読み込みに失敗しました:", error);
        }
      });

      engine.runRenderLoop(() => {
        scene.render();
      });
    });

    return () => {
      engine.dispose();
    };
  }, [deviceLists]);

  return (
    <>
      <div
        id="map"
        style={{
          height: "100vh",
          width: "100vw",
          position: "absolute",
          zIndex: 1,
        }}
      ></div>

      <canvas
        ref={canvasRef}
        id="babylonCanvas"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 2,
          backgroundColor: "transparent",
        }}
      ></canvas>
    </>
  );
}






function createCombinedQuaternionFromDirection(directionRaw: string): BABYLON.Quaternion {
  let direction: [number, number, number] = [0, 0, 0];

  try {
    if (!directionRaw || typeof directionRaw !== 'string') {
      throw new Error("directionRaw is null, undefined, or not a string");
    }

    if (!directionRaw.trim().startsWith("[")) {
      directionRaw = `[${directionRaw}]`;
    }

    const parsed = JSON.parse(directionRaw);

    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      typeof parsed[0] === 'number' &&
      typeof parsed[1] === 'number' &&
      typeof parsed[2] === 'number'
    ) {
      direction = [parsed[0], parsed[1], parsed[2]];
    } else {
      console.warn("Invalid direction format, using default [0,0,0]");
    }
  } catch (error) {
    console.error("Failed to parse direction:", error);
    return BABYLON.Quaternion.Identity();
  }

  const [x, y, z] = direction;

  const xRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, x);
  const yRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, y);
  const zRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, z);

  return xRot.multiply(yRot).multiply(zRot);
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


