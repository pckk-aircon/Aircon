//https://zenn.dev/mapbox_japan/articles/21a276dbc52e7c
//を改変。
/*


"use client";
import { FC, useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import Map, { ViewState } from "react-map-gl";
import * as THREE from "three";

import "maplibre-gl/dist/maplibre-gl.css";

const InitialViewState: Partial<ViewState> = {
  longitude: 140.302994,
  latitude: 35.353503,
  zoom: 15,
  pitch: 40,
  bearing: 20,
};

const buildingData: GeoJSON.FeatureCollection<GeoJSON.Geometry> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "ef6512f46485e27963c248bcc945c3db",
      properties: {
        level: 1,
        name: "outer-walls",
        height: 6,
        base_height: 0,
        color: "transparent",
        stroke: "black",
        "stroke-width": 1,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [140.30278407246294, 35.3536506960797],
            [140.3028859586707, 35.353561867136904],
            [140.30279109909793, 35.35349309627546],
            [140.3029544683622, 35.35335412164743],
            [140.30308270445295, 35.35344868172962],
            [140.30303878798242, 35.35349166354854],
            [140.30326539696347, 35.353659292423814],
            [140.30329174684482, 35.35364066701038],
            [140.3033163400674, 35.35366359059552],
            [140.30334093328997, 35.35364639790731],
            [140.30337079648882, 35.35367218693828],
            [140.30334971658374, 35.35368937962103],
            [140.3036044321032, 35.35387993161025],
            [140.3035499756818, 35.353928644076575],
            [140.30353592241175, 35.35392148048041],
            [140.30349903257797, 35.35395156757994],
            [140.30353943572925, 35.35397878923173],
            [140.3034111996402, 35.3540833775981],
            [140.30328472020983, 35.35398308738647],
            [140.30331107009107, 35.35396302932918],
            [140.3031933739545, 35.35387706617017],
            [140.30314243085064, 35.35392434591894],
            [140.30304757127618, 35.35385270992512],
            [140.30311081099296, 35.35380256469101],
            [140.30308270445295, 35.35377964114534],
            [140.30301946473617, 35.353828353672114],
            [140.30278407246294, 35.35364783063146],
          ],
        ],
      },
    },
  ],
};

const MAX_PITCH = 85 as const;
const MAX_ZOOM = 30 as const;
const MIN_ZOOM = 1 as const;

const TerrainMap: FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mapContainerRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
        center: [InitialViewState.longitude!, InitialViewState.latitude!],
        zoom: InitialViewState.zoom,
        pitch: InitialViewState.pitch,
        bearing: InitialViewState.bearing,
        maxPitch: MAX_PITCH,
        maxZoom: MAX_ZOOM,
        minZoom: MIN_ZOOM,
      });

      map.on("load", () => {
        const navControl = new maplibregl.NavigationControl({
          visualizePitch: true,
        });
        map.addControl(navControl, "top-left");

        map.addSource("buildings", {
          type: "geojson",
          data: buildingData,
        });

        map.addLayer({
          id: "3d-buildings",
          source: "buildings",
          type: "fill-extrusion",
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "base_height"],
            "fill-extrusion-opacity": 0.1,
          },
        });

        // Three.jsの初期化
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(map.getCanvas().width, map.getCanvas().height);
        map.getCanvas().parentNode!.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, map.getCanvas().width / map.getCanvas().height, 0.1, 1000);
        camera.position.set(-4002585.05, 3322656.83, 3690544.34); // 球体の位置から少し離れた位置にカメラを配置
        camera.lookAt(-4002585.05, 3322656.83, 3690534.34); // 球体の位置を向く

        // 赤い球体の作成
        const geometry = new THREE.SphereGeometry(5, 32, 32); // 半径5mで直径10mの球体
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const sphere = new THREE.Mesh(geometry, material);

        // 球体の位置を設定
        sphere.position.set(-4002585.05, 3322656.83, 3690534.34);

        // シーンに追加
        scene.add(sphere);

        // アニメーションループ
        const animate = () => {
          requestAnimationFrame(animate);
          renderer.render(scene, camera);
        };
        animate();

        // マップのリサイズに対応
        map.on('resize', () => {
          renderer.setSize(map.getCanvas().width, map.getCanvas().height);
          camera.aspect = map.getCanvas().width / map.getCanvas().height;
          camera.updateProjectionMatrix();
        });

        // 地図の視点が変わったときにカメラを更新
        map.on('move', () => {
          const center = map.getCenter();
          const zoom = map.getZoom();
          const pitch = map.getPitch();
          const bearing = map.getBearing();

          // カメラの位置と向きを更新
          camera.position.set(center.lng, center.lat, zoom * 100); // 適切な高さに調整
          camera.lookAt(center.lng, center.lat, 0); // 球体の位置を向く
          camera.updateProjectionMatrix();
        });
      });
    }
  }, []);

  return (
    <div ref={mapContainerRef} style={{ width: "80vw", height: "100vh", position: "relative" }} />
  );
};

export default TerrainMap;


*/

"use client";
import { FC, useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import * as THREE from "three";
import { FeatureCollection, Geometry } from "geojson";

import "maplibre-gl/dist/maplibre-gl.css";

const InitialViewState = {
  longitude: 140.302994,
  latitude: 35.353503,
  zoom: 15,
  pitch: 40,
  bearing: 20,
};

const buildingData: FeatureCollection<Geometry> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "ef6512f46485e27963c248bcc945c3db",
      properties: {
        level: 1,
        name: "outer-walls",
        height: 6,
        base_height: 0,
        color: "transparent",
        stroke: "black",
        "stroke-width": 1,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [140.30278407246294, 35.3536506960797],
            [140.3028859586707, 35.353561867136904],
            [140.30279109909793, 35.35349309627546],
            [140.3029544683622, 35.35335412164743],
            [140.30308270445295, 35.35344868172962],
            [140.30303878798242, 35.35349166354854],
            [140.30326539696347, 35.353659292423814],
            [140.30329174684482, 35.35364066701038],
            [140.3033163400674, 35.35366359059552],
            [140.30334093328997, 35.35364639790731],
            [140.30337079648882, 35.35367218693828],
            [140.30334971658374, 35.35368937962103],
            [140.3036044321032, 35.35387993161025],
            [140.3035499756818, 35.353928644076575],
            [140.30353592241175, 35.35392148048041],
            [140.30349903257797, 35.35395156757994],
            [140.30353943572925, 35.35397878923173],
            [140.3034111996402, 35.3540833775981],
            [140.30328472020983, 35.35398308738647],
            [140.30331107009107, 35.35396302932918],
            [140.3031933739545, 35.35387706617017],
            [140.30314243085064, 35.35392434591894],
            [140.30304757127618, 35.35385270992512],
            [140.30311081099296, 35.35380256469101],
            [140.30308270445295, 35.35377964114534],
            [140.30301946473617, 35.353828353672114],
            [140.30278407246294, 35.35364783063146],
          ],
        ],
      },
    },
  ],
};

const MAX_PITCH = 85;
const MAX_ZOOM = 30;
const MIN_ZOOM = 1;

const TerrainMap: FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mapContainerRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style.json",
        center: [InitialViewState.longitude, InitialViewState.latitude],
        zoom: InitialViewState.zoom,
        pitch: InitialViewState.pitch,
        bearing: InitialViewState.bearing,
        maxPitch: MAX_PITCH,
        maxZoom: MAX_ZOOM,
        minZoom: MIN_ZOOM,
      });

      map.on("load", () => {
        const navControl = new maplibregl.NavigationControl({
          visualizePitch: true,
        });
        map.addControl(navControl, "top-left");

        map.addSource("buildings", {
          type: "geojson",
          data: buildingData,
        });

        map.addLayer({
          id: "3d-buildings",
          source: "buildings",
          type: "fill-extrusion",
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "base_height"],
            "fill-extrusion-opacity": 0.1,
          },
        });

        // Three.jsの初期化
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(map.getCanvas().width, map.getCanvas().height);
        map.getCanvas().parentNode!.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, map.getCanvas().width / map.getCanvas().height, 0.1, 1000);
        camera.position.set(0, 0, 100); // 地図の中心にカメラを配置
        camera.lookAt(0, 0, 0); // 球体の位置を向く

        // 緯度経度をThree.jsの座標に変換
        const lngLatToThreeJS = (lng: number, lat: number): THREE.Vector3 => {
          const mercatorCoordinate = maplibregl.MercatorCoordinate.fromLngLat([lng, lat]);
          return new THREE.Vector3(mercatorCoordinate.x, mercatorCoordinate.y, 0);
        };

        // Three.jsの座標を緯度経度に変換
        const threeJSToLngLat = (vector: THREE.Vector3): maplibregl.LngLat => {
          const mercatorCoordinate = new maplibregl.MercatorCoordinate(vector.x, vector.y);
          const lngLat = mercatorCoordinate.toLngLat();
          return lngLat;
        };

        // 赤い球体の作成
        const geometry = new THREE.SphereGeometry(5, 32, 32); // 半径5mで直径10mの球体
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const sphere = new THREE.Mesh(geometry, material);

        // 球体の位置を設定
        const spherePosition = lngLatToThreeJS(140.302994, 35.353503); // 地図の中心の緯度経度
        sphere.position.copy(spherePosition);
        console.log("Sphere position (Three.js coordinates):", sphere.position);

        // 球体の緯度経度をログに出力
        const sphereLngLat = threeJSToLngLat(sphere.position);
        console.log("Sphere position (LngLat):", sphereLngLat);

        // シーンに追加
        scene.add(sphere);

        // アニメーションループ
        const animate = () => {
          requestAnimationFrame(animate);
          renderer.render(scene, camera);
          console.log("Rendering frame");
          console.log("Number of objects in scene:", scene.children.length); // シーン内のオブジェクトの数をログに出力
        };
        animate();

        // マップのリサイズに対応
        map.on('resize', () => {
          renderer.setSize(map.getCanvas().width, map.getCanvas().height);
          camera.aspect = map.getCanvas().width / map.getCanvas().height;
          camera.updateProjectionMatrix();
          console.log("Map resized");
        });

        // 地図の視点が変わったときにカメラを更新
        map.on('move', () => {
          const center = map.getCenter();
          const zoom = map.getZoom();
          const pitch = map.getPitch();
          const bearing = map.getBearing();

          // カメラの位置と向きを更新
          camera.position.set(center.lng, center.lat, zoom * 100); // 適切な高さに調整
          camera.lookAt(center.lng, center.lat, 0); // 球体の位置を向く
          camera.updateProjectionMatrix();
          console.log("Map moved");
          console.log("Camera position after move:", camera.position); // カメラの位置をログに出力
          console.log("Camera lookAt after move:", camera.getWorldDirection(new THREE.Vector3())); // カメラの向きをログに出力
        });
      });
    }
  }, []);

  return (
    <div ref={mapContainerRef} style={{ width: "80vw", height: "100vh", position: "relative" }} />
  );
};

export default TerrainMap;

