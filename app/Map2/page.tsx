"use client";

import { useState, useEffect, useRef } from "react";
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

type DivisionType = NonNullable<Schema["Division"]["type"]>;
type DeviceType = NonNullable<Schema["Device"]["type"]>;

Amplify.configure(outputs);
const client = generateClient<Schema>();

export default function App() {
  const { controller } = useController();
  const [divisionLists, setPosts] = useState<DivisionType[]>([]);
  const [deviceLists, setDevices] = useState<DeviceType[]>([]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null); // DOM 用
  const mapRef = useRef<maplibregl.Map | null>(null); // MapLibre 用

  useEffect(() => {
    async function fetchData() {
      await listPost();
    }
    fetchData();
  }, [controller]);

  useEffect(() => {
    if (divisionLists.length > 0 && deviceLists.length > 0) {
      renderMap();
    }
  }, [divisionLists, deviceLists]);

  async function listPost() {
    const { data: divisionData } = await client.queries.listDivision({ Controller: controller });
    const { data: deviceData } = await client.queries.listDevice({ Controller: controller });

    if (divisionData) {
      const filteredDivisionData = divisionData.filter(
        (item): item is DivisionType =>
          item !== null &&
          item !== undefined &&
          item.DivisionName !== undefined &&
          item.Geojson !== undefined
      );
      setPosts(filteredDivisionData);
    }

    if (deviceData) {
      const filteredDeviceData = deviceData.filter(item => item !== null && item !== undefined);
      setDevices(filteredDeviceData);
    }
  }

  async function renderMap() {
    let lon = 0, lat = 0;
    if (controller === "Mutsu01") {
      lon = 140.302994;
      lat = 35.353503;
    } else if (controller === "Koura01") {
      lon = 136.275547;
      lat = 35.201848;
    }

    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
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
        if (division.DivisionName && division.Geojson) {
          addGeoJsonLayerToMap(map, {
            Division: division.Division,
            DivisionName: division.DivisionName,
            Geojson: division.Geojson,
          }, index);
        }
      });

      const canvas = map.getCanvas();
      const gl = canvas.getContext('webgl2');
      if (!gl) {
        console.error('WebGL2 context を取得できませんでした。');
        return;
      }

      const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true });
      renderer.autoClear = false;

      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      const loader = new GLTFLoader();

      for (const device of deviceLists.slice(0, 4)) {
        const lon = Number(device.lon);
        const lat = Number(device.lat);
        const height = Number(device.height);
        if (isNaN(lon) || isNaN(lat) || isNaN(height)) continue;

        const mercator = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], height);
        const scale = mercator.meterInMercatorCoordinateUnits();

        loader.load(
          `https://pckk-device.s3.ap-southeast-2.amazonaws.com/${device.DeviceType}Model.glb`,
          gltf => {
            const model = gltf.scene;
            model.scale.set(scale, scale, scale);
            model.position.set(mercator.x, mercator.y, mercator.z);
            scene.add(model);
          },
          undefined,
          error => {
            console.error(`モデルの読み込みに失敗しました: ${device.DeviceType}`, error);
          }
        );
      }



      const customLayer: maplibregl.CustomLayerInterface = {
        id: 'threejs-layer',
        type: 'custom',
        renderingMode: '3d',
        onAdd() {},
        render(gl: WebGLRenderingContext, matrix: any) {
          const m = new THREE.Matrix4().fromArray(matrix.defaultProjectionData.mainMatrix);
          camera.projectionMatrix = m;
          renderer.state.reset();
          renderer.render(scene, camera);
          map.triggerRepaint();
        }
      };


      map.addLayer(customLayer);
    });

    mapRef.current = map;
  }

  return <div id="map" style={{ height: '80vh', width: '80%' }} ref={mapContainerRef} />;
}
