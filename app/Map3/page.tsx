
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

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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

    map.on('load', () => {
      divisionLists.forEach((division, index) => {
        addGeoJsonLayerToMap(map, division, index);
      });

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
        const worldPosition = new THREE.Vector3(
          worldOriginMercator.x,
          worldOriginMercator.y,
          worldOriginMercator.z
        );

        const modelUrl = `${device.DeviceType}Model.glb`;

        let renderer: THREE.WebGLRenderer;
        let scene: THREE.Scene;
        let camera: THREE.Camera;

        const customLayer: maplibregl.CustomLayerInterface = {
          id: `3d-model-${device.Device}`,
          type: 'custom',
          renderingMode: '3d',
          onAdd(map, gl) {
            renderer = new THREE.WebGLRenderer({ canvas: gl.canvas, context: gl, antialias: true });
            renderer.autoClear = false;

            scene = new THREE.Scene();
            camera = new THREE.Camera();

            const light = new THREE.DirectionalLight(0xffffff, 0.8);
            light.position.set(0, 0, 100).normalize();
            scene.add(light);

            const loader = new GLTFLoader();
            const modelUrl = "AirconModel.glb";
            loader.load(
              'https://pckk-device.s3.ap-southeast-2.amazonaws.com/' + modelUrl,
              (gltf) => {
                const model = gltf.scene;
                model.position.copy(worldPosition);
                model.scale.setScalar(worldScale);
                model.quaternion.copy(createCombinedQuaternionFromDirection(device.direction));
                scene.add(model);
              },
              undefined,
              (error) => {
                console.error('Failed to load model:', error);
              }
            );
          },
          render(gl, matrix) {
            camera.projectionMatrix.fromArray(matrix.defaultProjectionData.mainMatrix);
            renderer.state.reset();
            renderer.render(scene, camera);
            map.triggerRepaint();
          }
        };

        map.addLayer(customLayer);
      }
    });
  }

  return <div id="map" style={{ height: '80vh', width: '80%' }} />;
}

function createCombinedQuaternionFromDirection(directionRaw: string): THREE.Quaternion {
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
    return new THREE.Quaternion();
  }

  const [x, y, z] = direction;

  const xRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), x);
  const yRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), y);
  const zRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), z);

  return xRot.multiply(yRot).multiply(zRot);
}
