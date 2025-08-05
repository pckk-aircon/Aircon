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

export default function App() {
  const { controller } = useController();

  const [divisionLists, setPosts] = useState<Array<{
    Division: string;
    DivisionName: string;
    Geojson: string;
    Controller?: string | null;
  }>>([]);

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
    Controller?: string | null;
  }>>([]);

  useEffect(() => {
    async function fetchData() {
      await listPost();
    }
    fetchData();
  }, [controller]);

  useEffect(() => {
    if (divisionLists.length > 0) {
      renderMap();
    }
  }, [divisionLists]);

  async function listPost() {
    const { data: divisionData } = await client.queries.listDivision({ Controller: controller });
    const { data: deviceData } = await client.queries.listDevice({ Controller: controller });

    if (divisionData) {
      const filteredDivisionData = divisionData.filter(
        (item): item is {
          Division: string;
          DivisionName?: string;
          Geojson?: string;
          Controller?: string | null;
        } => item !== null && item !== undefined
      );
      setPosts(filteredDivisionData as any);
    }

    if (deviceData) {
      const filteredDeviceData = deviceData.filter(
        (item): item is {
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
        } => item !== null && item !== undefined
      );
      setDevices(filteredDeviceData as any);
    }
  }

  let map: maplibregl.Map;

  async function renderMap() {
    let lon = 0, lat = 0;

    if (controller === "Mutsu01") {
      lon = 140.302994;
      lat = 35.353503;
    } else if (controller === "Koura01") {
      lon = 136.275547;
      lat = 35.201848;
    }

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
            paint: { 'background-color': '#e0dfdf' },
          },
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
          },
        ],
      },
      center: [lon, lat],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();

    map.on('mousemove', (e) => {
      if (e.originalEvent.buttons === 2) {
        const rotationSpeed = 0.5;
        map.rotateTo(map.getBearing() + e.originalEvent.movementX * rotationSpeed);
      }
    });

    const nav = new maplibregl.NavigationControl({
      showCompass: true,
      visualizePitch: true,
    });
    map.addControl(nav, 'top-left');

    map.on('load', () => {
      divisionLists.forEach((division, index) => {
        addGeoJsonLayerToMap(map, division, index);
      });
    });

    deviceLists.forEach((device, index) => {
      if (!device.direction || typeof device.direction !== 'string') {
        console.warn(`Invalid direction for device ${device.DeviceName}, skipping.`);
        return;
      }

      const worldOrigin: [number, number] = [Number(device.lon), Number(device.lat)];
      const worldAltitude = Number(device.height);
      const worldRotate = createCombinedQuaternionFromDirection(device.direction);
      const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
      const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

      const worldMatrix = BABYLON.Matrix.Compose(
        new BABYLON.Vector3(worldScale, worldScale, worldScale),
        worldRotate,
        new BABYLON.Vector3(worldOriginMercator.x, worldOriginMercator.y, worldOriginMercator.z)
      );

      const customLayer: maplibregl.CustomLayerInterface = {
        id: `3d-model-${index}`,
        type: 'custom',
        renderingMode: '3d',

        onAdd(map, gl) {
          const engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
          const scene = new BABYLON.Scene(engine);
          scene.autoClear = false;
          scene.detachControl();

          scene.beforeRender = () => {
            engine.wipeCaches(true);
          };

          const camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), scene);
          camera.minZ = 0.001;

          const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), scene);
          light.intensity = 0.7;

          new BABYLON.AxesViewer(scene, 5);

          BABYLON.SceneLoader.LoadAssetContainerAsync(
            'https://pckk-device.s3.ap-southeast-2.amazonaws.com/',
            `${device.DeviceType}Model.glb`,
            scene
          ).then((modelContainer) => {
            modelContainer.addAllToScene();
          });

          (this as any).map = map;
          (this as any).engine = engine;
          (this as any).scene = scene;
          (this as any).camera = camera;
        },

        render(gl, args) {
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
        if (!map.getLayer(`3d-model-${index}`)) {
          map.addLayer(customLayer);
        }
      });
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

export default function App() {
  const { controller } = useController();

  const [divisionLists, setPosts] = useState<Array<{
    Division: string;
    DivisionName: string;
    Geojson: string;
    Controller?: string | null;
  }>>([]);

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
    Controller?: string | null;
  }>>([]);

  useEffect(() => {
    async function fetchData() {
      await listPost();
    }
    fetchData();
  }, [controller]);

  useEffect(() => {
    if (divisionLists.length > 0) {
      renderMap();
    }
  }, [divisionLists]);

  async function listPost() {
    const { data: divisionData } = await client.queries.listDivision({ Controller: controller });
    const { data: deviceData } = await client.queries.listDevice({ Controller: controller });

    if (divisionData) {
      const filteredDivisionData = divisionData.filter(
        (item): item is {
          Division: string;
          DivisionName: string;
          Geojson: string;
          Controller?: string | null;
        } => item?.DivisionName !== undefined && item?.Geojson !== undefined
      );
      setPosts(filteredDivisionData);
    }

    if (deviceData) {
      const filteredDeviceData = deviceData.filter(
        (item): item is {
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
        } => item !== null && item !== undefined
      );
      setDevices(filteredDeviceData);
    }
  }

  let map: maplibregl.Map;

  async function renderMap() {
    let lon = 0, lat = 0;

    if (controller === "Mutsu01") {
      lon = 140.302994;
      lat = 35.353503;
    } else if (controller === "Koura01") {
      lon = 136.275547;
      lat = 35.201848;
    }

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
            paint: { 'background-color': '#e0dfdf' },
          },
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
          },
        ],
      },
      center: [lon, lat],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();

    map.on('mousemove', (e) => {
      if (e.originalEvent.buttons === 2) {
        const rotationSpeed = 0.5;
        map.rotateTo(map.getBearing() + e.originalEvent.movementX * rotationSpeed);
      }
    });

    const nav = new maplibregl.NavigationControl({
      showCompass: true,
      visualizePitch: true,
    });
    map.addControl(nav, 'top-left');

    map.on('load', () => {
      divisionLists.forEach((division, index) => {
        addGeoJsonLayerToMap(map, division, index);
      });
    });

    deviceLists.forEach((device, index) => {
      if (
        !device.direction ||
        typeof device.direction !== 'string' ||
        device.lon == null ||
        device.lat == null ||
        device.height == null
      ) {
        console.warn(`Invalid data for device ${device.DeviceName}, skipping.`);
        return;
      }

      const lon = Number(device.lon);
      const lat = Number(device.lat);
      const height = Number(device.height);

      if (isNaN(lon) || isNaN(lat) || isNaN(height)) {
        console.warn(`Non-numeric coordinates for device ${device.DeviceName}, skipping.`);
        return;
      }

      const worldOrigin: [number, number] = [lon, lat];
      const worldAltitude = height;
      
      console.log("device.direction☆", device.direction);
      const worldRotate = createCombinedQuaternionFromDirection(device.direction);
      const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
      const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

      const worldMatrix = BABYLON.Matrix.Compose(
        new BABYLON.Vector3(worldScale, worldScale, worldScale),
        worldRotate,
        new BABYLON.Vector3(worldOriginMercator.x, worldOriginMercator.y, worldOriginMercator.z)
      );

      const customLayer: maplibregl.CustomLayerInterface = {
        id: `3d-model-${index}`,
        type: 'custom',
        renderingMode: '3d',

        onAdd(map, gl) {
          const engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
          const scene = new BABYLON.Scene(engine);
          scene.autoClear = false;
          scene.detachControl();

          scene.beforeRender = () => {
            engine.wipeCaches(true);
          };

          const camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), scene);
          camera.minZ = 0.001;

          const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), scene);
          light.intensity = 0.7;

          new BABYLON.AxesViewer(scene, 5);

          BABYLON.SceneLoader.LoadAssetContainerAsync(
            'https://pckk-device.s3.ap-southeast-2.amazonaws.com/',
            `${device.DeviceType}Model.glb`,
            scene
          ).then((modelContainer) => {
            modelContainer.addAllToScene();
          });

          (this as any).map = map;
          (this as any).engine = engine;
          (this as any).scene = scene;
          (this as any).camera = camera;
        },

        render(gl, args) {
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
        if (!map.getLayer(`3d-model-${index}`)) {
          map.addLayer(customLayer);
        }
      });
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
    console.log("parsed☆", parsed);

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