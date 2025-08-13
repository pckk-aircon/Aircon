/*


"use client";

import { useEffect, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import maplibregl from "maplibre-gl";
import * as BABYLON from "babylonjs";
import "babylonjs-loaders";

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
  DeviceType: string;
  direction: string;
  height: string;
  lat: string;
  lon: string;
}

export default function BabylonMap(): JSX.Element {

  const { controller } = useController();
  const [divisionLists, setDivisionLists] = useState<Division[]>([]);
  const [deviceLists, setDeviceLists] = useState<Device[]>([]);
  const [logMessage, setLogMessage] = useState<string>("初期化中...");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);


  useEffect(() => {
  async function fetchDevices() {
    try {
      setLogMessage("データ取得前");
      const { data } = await client.queries.listDevice({});
      setLogMessage("データ取得中");
      console.log("取得データ:", data);
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
        setLogMessage(`デバイス ${filtered.length} 件を取得しました`);
      } else {
        setLogMessage("デバイス情報の取得に失敗しました（データなし）");
      }
    } catch (error) {
      console.error("API呼び出しエラー:", error);
      setLogMessage("デバイス情報の取得に失敗しました（APIエラー）");
    }
  }
  fetchDevices();
}, []);


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
    const map = new maplibregl.Map({
      container: "map",
      style: "https://demotiles.maplibre.org/style.json",
      center: [140.302994, 35.353503],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    const canvas = canvasRef.current;
    if (!canvas) {
      setLogMessage("Canvas が見つかりません");
      return;
    }

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      premultipliedAlpha: true, // 修正点: trueに変更
    });

    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // 透明背景

    const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.minZ = 0.001;

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // デバッグレイヤーは無効化（必要に応じて有効化）
    // scene.debugLayer.show({ embedMode: true });

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
            mesh.scaling = new BABYLON.Vector3(scale * 10, scale * 10, scale * 10);
            mesh.isVisible = true;
          });

          camera.setTarget(position);
          camera.position = new BABYLON.Vector3(position.x, position.y + 10, position.z - 20);

          setLogMessage(`モデル ${device.DeviceType} を読み込みました`);
        } catch (error) {
          setLogMessage(`モデルの読み込みに失敗しました: ${error}`);
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
          zIndex: 0, // 修正点: 地図を最背面に
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
          zIndex: 1, // 修正点: 地図より前面だがUIより背面
          backgroundColor: "transparent",
        }}
      ></canvas>

      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "10px",
          zIndex: 9999,
          fontSize: "14px",
        }}
      >
        {logMessage}
      </div>
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
  DeviceType: string;
  direction: string;
  height: string;
  lat: string;
  lon: string;
}

export default function BabylonMap(): JSX.Element {

  const { controller } = useController();
  const [divisionLists, setDivisionLists] = useState<Division[]>([]);
  const [deviceLists, setDeviceLists] = useState<Device[]>([]);
  const [logMessage, setLogMessage] = useState<string>("初期化中...");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);


  useEffect(() => {
  async function fetchDevices() {
    try {
      setLogMessage("データ取得前");
      const { data } = await client.queries.listDevice({});
      setLogMessage("データ取得中");
      console.log("取得データ:", data);
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
        setLogMessage(`デバイス ${filtered.length} 件を取得しました`);
      } else {
        setLogMessage("デバイス情報の取得に失敗しました（データなし）");
      }
    } catch (error) {
      console.error("API呼び出しエラー:", error);
      setLogMessage("デバイス情報の取得に失敗しました（APIエラー）");
    }
  }
  fetchDevices();
}, []);


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
    const map = new maplibregl.Map({
      container: "map",
      style: "https://demotiles.maplibre.org/style.json",
      center: [140.302994, 35.353503],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    const canvas = canvasRef.current;
    if (!canvas) {
      setLogMessage("Canvas が見つかりません");
      return;
    }

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      premultipliedAlpha: true, // 修正点: trueに変更
    });

    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // 透明背景

    const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.minZ = 0.001;

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // デバッグレイヤーは無効化（必要に応じて有効化）
    // scene.debugLayer.show({ embedMode: true });

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
            mesh.scaling = new BABYLON.Vector3(scale * 10, scale * 10, scale * 10);
            mesh.isVisible = true;
          });

          camera.setTarget(position);
          camera.position = new BABYLON.Vector3(position.x, position.y + 10, position.z - 20);

          setLogMessage(`モデル ${device.DeviceType} を読み込みました`);
        } catch (error) {
          setLogMessage(`モデルの読み込みに失敗しました: ${error}`);
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
          zIndex: 0, // 修正点: 地図を最背面に
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
          zIndex: 1, // 修正点: 地図より前面だがUIより背面
          backgroundColor: "transparent",
        }}
      ></canvas>

      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "10px",
          zIndex: 9999,
          fontSize: "14px",
        }}
      >
        {logMessage}
      </div>
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


