/*

"use client";

import React, { useEffect, useRef } from 'react';
import maplibregl, {
  Map,
  MercatorCoordinate,
  CustomLayerInterface
} from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const ThreeDModelMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL',
      zoom: 18,
      center: [140.302994, 35.353503],
      pitch: 60,
      canvasContextAttributes: { antialias: true }
    });

    const modelRotate: [number, number, number] = [Math.PI / 2, 0, 0];

    const baseLayer: CustomLayerInterface = {
      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',
      onAdd(map, gl) {},
      render(gl, args) {}
    };

    const customLayer = Object.assign(baseLayer, {
      camera: new THREE.Camera(),
      scene: new THREE.Scene(),
      renderer: undefined as unknown as THREE.WebGLRenderer,
      map: map,
      onAdd(map: Map, gl: WebGLRenderingContext) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        const directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(0, -70, 100).normalize();
        this.scene.add(directionalLight);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff);
        directionalLight2.position.set(0, 70, 100).normalize();
        this.scene.add(directionalLight2);

        const modelUrl = "AirconModel.glb";
        const fullModelUrl = "https://pckk-device.s3.ap-southeast-2.amazonaws.com/" + modelUrl;

        const loader = new GLTFLoader();
        loader.load(
          fullModelUrl,
          (gltf) => {
            const originalModel = gltf.scene;

            // 表示したい地点の配列
            const locations: [number, number][] = [
              [140.302994, 35.353503],
              [140.303500, 35.353800],
              [140.304000, 35.354100]
              // 必要に応じて追加
            ];

            locations.forEach((lngLat) => {
              const mercator = MercatorCoordinate.fromLngLat(lngLat, 0);

              const model = originalModel.clone();
              model.position.set(mercator.x, mercator.y, mercator.z);
              model.scale.setScalar(mercator.meterInMercatorCoordinateUnits());
              model.rotation.set(modelRotate[0], modelRotate[1], modelRotate[2]);

              this.scene.add(model);
            });
          },
          undefined,
          (error) => {
            console.error('モデルの読み込みに失敗しました:', error);
          }
        );

        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });
        this.renderer.autoClear = false;
      },
      render(gl: WebGLRenderingContext, args: any) {
        const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
        this.camera.projectionMatrix = m;
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        this.map.triggerRepaint();
      }
    });

    map.on('style.load', () => {
      map.addLayer(customLayer);
    });

    return () => map.remove();
  }, []);

  return <div ref={mapContainerRef} style={{ width: '100%', height: '100vh' }} />;
};

export default ThreeDModelMap;

*/


"use client";

import React, { useEffect, useRef } from "react";
import maplibregl, {
  Map,
  MercatorCoordinate,
  CustomLayerInterface,
} from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const ThreeDModelMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style:
        "https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL",
      center: [140.302994, 35.353503],
      zoom: 18,
      pitch: 60,
      canvasContextAttributes: { antialias: true },
    });

    const modelRotate: [number, number, number] = [Math.PI / 2, 0, 0];

    const customLayer: CustomLayerInterface & {
      camera: THREE.Camera;
      scene: THREE.Scene;
      renderer: THREE.WebGLRenderer;
    } = {
      id: "3d-model",
      type: "custom",
      renderingMode: "3d",
      camera: new THREE.Camera(),
      scene: new THREE.Scene(),
      renderer: new THREE.WebGLRenderer(),

      onAdd(map: Map, gl: WebGLRenderingContext) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
        light1.position.set(0, -70, 100).normalize();
        this.scene.add(light1);

        const light2 = new THREE.DirectionalLight(0xffffff, 0.6);
        light2.position.set(0, 70, 100).normalize();
        this.scene.add(light2);

        const loader = new GLTFLoader();
        const modelUrl =
          "https://pckk-device.s3.ap-southeast-2.amazonaws.com/AirconModel.glb";

        loader.load(
          modelUrl,
          (gltf) => {
            const originalModel = gltf.scene;

            const locations: [number, number][] = [
              [140.302994, 35.353503],
              [140.303500, 35.353800],
              [140.304000, 35.354100],
            ];

            locations.forEach((lngLat) => {
              const mercator = MercatorCoordinate.fromLngLat(lngLat, 0);
              const scale = mercator.meterInMercatorCoordinateUnits();

              const model = originalModel.clone();
              model.matrixAutoUpdate = false;

              const translation = new THREE.Matrix4().makeTranslation(
                mercator.x,
                mercator.y,
                mercator.z
              );
              const rotationX = new THREE.Matrix4().makeRotationX(modelRotate[0]);
              const rotationY = new THREE.Matrix4().makeRotationY(modelRotate[1]);
              const rotationZ = new THREE.Matrix4().makeRotationZ(modelRotate[2]);
              const scaleMatrix = new THREE.Matrix4().makeScale(
                scale,
                -scale,
                scale
              );

              model.matrix = new THREE.Matrix4()
                .multiply(translation)
                .multiply(rotationX)
                .multiply(rotationY)
                .multiply(rotationZ)
                .multiply(scaleMatrix);

              this.scene.add(model);
            });
          },
          undefined,
          (error) => {
            console.error("モデル読み込みエラー:", error);
          }
        );

        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true,
        });
        this.renderer.autoClear = false;
      },

      render(gl: WebGLRenderingContext, matrix: any) {
        const m = new THREE.Matrix4().fromArray(matrix.defaultProjectionData.mainMatrix);
        this.camera.projectionMatrix = m;
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        map.triggerRepaint();
      },
    };

    map.on("style.load", () => {
      map.addLayer(customLayer);
    });

    return () => map.remove();
  }, []);

  return <div ref={mapContainerRef} style={{ width: "100%", height: "100vh" }} />;
};

export default ThreeDModelMap;




