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
      style: 'https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL',//APIキー
      zoom: 18,
      //center: [148.9819, -35.3981],
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

        BABYLON.SceneLoader.LoadAssetContainerAsync(
          'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
          //'file:///C:/Users/kiyoshi.tabuchi/Desktop/GIS/34M_17.gltf',
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

  return <div ref={mapContainer} style={{ width: '80%', height: '200%' }} />;
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
      //center: [148.9819, -35.3981],
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

        BABYLON.SceneLoader.LoadAssetContainerAsync(
          //'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
          //'https://pckk-device.s3.ap-southeast-2.amazonaws.com/34M_17.gltf',
          'https://pckk-device.s3.ap-southeast-2.amazonaws.com/34M_17.gltf?response-content-disposition=inline&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEDgaDmFwLXNvdXRoZWFzdC0yIkcwRQIhAMs9IZZChuVReQTvs6qcH56dTNT072BZyPfZSQZUzO8LAiAMRdjwJy4yeVr1t9dkv1%2FS5vXcuPnlZB0uo7I7jcqhdirfAwjR%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F8BEAAaDDIxMzI2NDg0MDM2OSIMvBGM%2BNk75OO7M%2BsWKrMDL9RMX4rx6jmA%2Bh6ycSQcvZl9yvkZWS3q%2F6cTn8dTxGwLeL4hdUCaP%2BQvEGvf6v4Zx3mUY4oKlPdegcvS4SH3Zf4%2F5KjSwI2JNPcTBhtaNSZlMnZoVBiAZbkCpTehQQg6xwjHBHEVjUoUjw%2FqP%2FGkwFlI9KT7NsgCCDVIZofr65d6Ebt72ahcIRfkR8jV4xzZXujN6NkgsTpT2VvDXvrUF4W%2FvNiyltHAhimR%2FQWnUb0ZQPUN3QoNUgeUTPAUocjA%2FW4JVFTaxQhvVnsPyOvkNpwxjCf6Eqes%2BDCJ0lOORdKe8leGjymaHHs4FQQGwF%2Fh00q2qENT%2BP7E04DX8YI7LMDHVJgR5xf2LkezxBiy0cT8f1qZYW98U%2BIXqxTVXNfb0I3ZI23gX5l0FBOG%2BeuWH3pKAMiuaYx7Pqe5H3C2t%2B9jMGp88A6gIB3In5YL5ltsizp60xntG5rzQyDMAfZEnh%2Bquczu4HMtr2nBGDOfCHcUr9wPtjMvc1XL0FRNxqC20Zd6jn0jFpxC9Uy1by3%2FcZGhQEoEmTc0TzzggdSmxjRpxXsy8aaEiI6o5%2By33zggEOsRMLDE0cAGOt4CBw4w6a1uk1cOUjwWYVt1qzY4iRagTfFObLqeEKW7K2HjiqHbiYKhlZuum4m5E3UfKnZXM3nImRTHNQVoArwq0bmXAhTyE4j2138QNjsQoLxeitv4EJVN7NNgRpydymSotuQhziGa%2FqiJzn0UAKVi8xiVlGaISolJmrqAOHf9d1845F00v%2Baiqy5B6gF1ygVBfRsPWIRaJkinHbtAvfGlVmSMi4%2B9bV1TTjSkCxOJKiT7N2p17V2XTMjNWq3i7SND0b7J5QKjcYC15q4RCwK79c1j2MNDTH%2BTzBHfgEgZa2rli%2FE4pTPhQ0B2CBCwFxDj7tb6wrrUM8JpjO5N0b4B2%2BTcXWgmg%2BImWMjeosNr%2B9S7zi76BbMSuFpzw7eWGK5A4fDTKzRfCmA886yDiGb9UD9XD1MTWdXHD99zh2pIwXaG79j3RlcoER%2B3ACEBKnxv3IaizZqqEbksAXLZVQ4%3D&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIATDJ4TG2YVUNJ2NZJ%2F20250502%2Fap-southeast-2%2Fs3%2Faws4_request&X-Amz-Date=20250502T073050Z&X-Amz-Expires=14400&X-Amz-SignedHeaders=host&X-Amz-Signature=87512b2baa37359afe5a8047baaeff568d9f6912d86fc8f52450d13265df78c4',
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

  return <div ref={mapContainer} style={{ width: '80%', height: '200%' }} />;
};

export default MapWith3DModel;

