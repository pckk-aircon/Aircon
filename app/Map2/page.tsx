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
  lat: string | null;
  lon: string | null;
  height: string | null;
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
            item !== null &&
            item !== undefined &&
            item.lat !== undefined &&
            item.lon !== undefined &&
            item.height !== undefined &&
            item.direction !== undefined &&
            !isNaN(Number(item.lat)) &&
            !isNaN(Number(item.lon)) &&
            !isNaN(Number(item.height))        
        );


        console.log('filteredDeviceData====',filteredDeviceData)

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

      //const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), scene);
      //light.intensity = 0.7;
      const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
      light.intensity = 0.5;

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

          //const result = await BABYLON.SceneLoader.LoadAssetContainerAsync(
          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            null,
            //'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
            //'',
            'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/',
            '34M_17.gltf',

            //'https://pckk-device.s3.ap-southeast-2.amazonaws.com/',
            //modelUrl,
            scene
          );

          if (result.meshes.length === 0) {
            console.warn(`No mesh loaded: ${device.DeviceType}`);
          }

          const material = new BABYLON.StandardMaterial("mat", scene);
          material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8); // グレーなど任意の色

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
  lat: string | null;
  lon: string | null;
  height: string | null;
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
            item !== null &&
            item !== undefined &&
            item.lat !== undefined &&
            item.lon !== undefined &&
            item.height !== undefined &&
            item.direction !== undefined &&
            !isNaN(Number(item.lat)) &&
            !isNaN(Number(item.lon)) &&
            !isNaN(Number(item.height))        
        );


        console.log('filteredDeviceData====',filteredDeviceData)

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

      //const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), scene);
      //light.intensity = 0.7;
      const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
      light.intensity = 0.5;

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

          //const result = await BABYLON.SceneLoader.LoadAssetContainerAsync(
          const result = await BABYLON.SceneLoader.ImportMeshAsync(
            null,
            //'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
            //'',
            'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/',
            '34M_17.gltf',

            //'https://pckk-device.s3.ap-southeast-2.amazonaws.com/',
            //modelUrl,
            scene
          );

          if (result.meshes.length === 0) {
            console.warn(`No mesh loaded: ${device.DeviceType}`);
          }

          const material = new BABYLON.StandardMaterial("mat", scene);
          material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8); // グレーなど任意の色

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