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

const MapWith3DModel: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      style: 'https://api.maptiler.com/maps/basic/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
      zoom: 18,
      center: [148.9819, -35.3981],
      pitch: 60,
      canvasContextAttributes: { antialias: true }
    });

    const worldOrigin: [number, number] = [148.9819, -35.39847];
    const worldAltitude = 0;
    const worldRotate = [Math.PI / 2, 0, 0];

    const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
    const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

    const worldMatrix = BABYLON.Matrix.Compose(
      new BABYLON.Vector3(worldScale, worldScale, worldScale),
      BABYLON.Quaternion.FromEulerAngles(worldRotate[0], worldRotate[1], worldRotate[2]),
      new BABYLON.Vector3(worldOriginMercator.x, worldOriginMercator.y, worldOriginMercator.z)
    );

    const customLayer = {
      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',
      engine: null as BABYLON.Engine | null,
      scene: null as BABYLON.Scene | null,
      camera: null as BABYLON.Camera | null,
      map: null as maplibregl.Map | null, // カンマを追加

      onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
        this.engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.autoClear = false;
        this.scene.detachControl();

        this.scene.beforeRender = () => {
          if (this.engine) {
            this.engine.wipeCaches(true);
          }
        };

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
      render(gl: WebGLRenderingContext, args: any) {
        const cameraMatrix = BABYLON.Matrix.FromArray(args.defaultProjectionData.mainMatrix);
        const wvpMatrix = worldMatrix.multiply(cameraMatrix);

        if (this.camera) {
          this.camera.freezeProjectionMatrix(wvpMatrix);
        }
        if (this.scene) {
          this.scene.render(false);
        }
        if (this.map) {
          this.map.triggerRepaint();
        }
      }
    };

    map.on('style.load', () => {
      map.addLayer(customLayer);
    });

    return () => {
      map.remove();
    };
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
};

export default MapWith3DModel;
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

const MapWith3DModel: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current!,
      style: 'https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL',//APIキー
      zoom: 18,
      center: [148.9819, -35.3981],
      pitch: 60,
      canvasContextAttributes: { antialias: true }
    });

    const worldOrigin: [number, number] = [148.9819, -35.39847];
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

        BABYLON.SceneLoader.LoadAssetContainerAsync(
          'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
          '',
          scene
        ).then((modelContainer) => {
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
  }, []);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
};

export default MapWith3DModel;




