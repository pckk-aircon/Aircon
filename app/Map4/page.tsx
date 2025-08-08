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



