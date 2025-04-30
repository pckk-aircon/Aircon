//https://zenn.dev/mapbox_japan/articles/21a276dbc52e7c
//を改変。
/*

"use client";

import { useState, useEffect } from "react";
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

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {

  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; Geojson: string ;Controller?: string | null }>>([]);
  console.log('divisionLists（State直後）=', divisionLists);

  useEffect(() => {
    async function fetchData() {
        await listPost();
    }
    fetchData();
  }, []);


  //divisionLists の状態が更新された後に renderMap 関数を呼び出す
  useEffect(() => {
    if (divisionLists.length > 0) {
      renderMap();
    }
  }, [divisionLists]);

  async function listPost() {
    const { data, errors } = await client.queries.listDivision({
      Controller: "Mutsu01",
    });
    console.log('data（関数内）=', data);
    //divisionLists の状態を更新
    if (data) {
      setPosts(data as Array<{ Division: string; DivisionName: string; Geojson: string; Controller?: string | null }>); // 型を明示的にキャストする
    }
  }


  let map; // map変数をスコープ外で定義

  async function renderMap() {

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
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#e0dfdf',
            },
          },
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
          },
        ],
      },
      center: [140.302994, 35.353503],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    // マウス操作で回転と角度変更を有効にする
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
      
    // カスタムハンドラーを作成して回転の感度を調整
    map.on('mousemove', (e) => {
      if (e.originalEvent.buttons === 2) { // 右クリック
        const rotationSpeed = 0.5; // 回転速度を調整
        map.rotateTo(map.getBearing() + e.originalEvent.movementX * rotationSpeed);
      }
    });
      
    // NavigationControlの追加
    const nav = new maplibregl.NavigationControl({
      showCompass: true, // コンパスを表示
      visualizePitch: true, // ピッチ（角度）を表示
    });
    map.addControl(nav, 'top-left');

    map.on('load', () => {

      divisionLists.forEach((division, index) => {
        //JSON.parseを使って文字列をGeoJSONオブジェクトに変換
        const geojsonData = JSON.parse(division.Geojson);
        const sourceId = `floorplan-${index}`; // ユニークなIDを生成
        const layerId = `room-extrusion-${index}`; // ユニークなIDを生成

        console.log("index=", index);
        console.log("sourceId=", sourceId);
        console.log('geojsonData（renderMap内）=', geojsonData);

        map.addSource(sourceId, {
          type: 'geojson',
          data: geojsonData,
        });

        map.addLayer({
          id: layerId,
          type: 'fill-extrusion',
          source: sourceId,
          paint: {

            'fill-extrusion-color': [
              'case',
              ['==', ['geometry-type'], 'Polygon'], '#add8e6', // 底面をLightBlueに設定
              '#00008b' // 側面をDeepBlueに設定
            ],

            //'fill-extrusion-color': [
              //'case',
              //['==', ['geometry-type'], 'Polygon'],['get', 'color'], // 底面の色をGeoJSONのcolorプロパティから取得
              //['rgba', 
                //['get', 'color_r'], // 赤成分
                //['get', 'color_g'], // 緑成分
                //['get', 'color_b'], // 青成分
                //0.3 // 透過率30%
              //] // 側面の色を底面の色の透過率30%で設定
            //],

            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base_height'],
            'fill-extrusion-opacity': 0.6,
          },
        });
      
      })//endEach

    });
  
  }

  return <div id="map" style={{ height: '80vh', width: '80%' }} />;

}


*/

"use client";

import { useState, useEffect } from "react";
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

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {

  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; Geojson: string ;Controller?: string | null }>>([]);
  console.log('divisionLists（State直後）=', divisionLists);

  useEffect(() => {
    async function fetchData() {
        await listPost();
    }
    fetchData();
  }, []);


  //divisionLists の状態が更新された後に renderMap 関数を呼び出す
  useEffect(() => {
    if (divisionLists.length > 0) {
      renderMap();
    }
  }, [divisionLists]);

  async function listPost() {
    const { data, errors } = await client.queries.listDivision({
      Controller: "Mutsu01",
    });
    console.log('data（関数内）=', data);
    //divisionLists の状態を更新
    if (data) {
      setPosts(data as Array<{ Division: string; DivisionName: string; Geojson: string; Controller?: string | null }>); // 型を明示的にキャストする
    }
  }


  let map; // map変数をスコープ外で定義

  async function renderMap() {

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
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#e0dfdf',
            },
          },
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
          },
        ],
      },
      center: [140.302994, 35.353503],
      zoom: 17,
      pitch: 30,
      bearing: 30,
    });

    // マウス操作で回転と角度変更を有効にする
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();
      
    // カスタムハンドラーを作成して回転の感度を調整
    map.on('mousemove', (e) => {
      if (e.originalEvent.buttons === 2) { // 右クリック
        const rotationSpeed = 0.5; // 回転速度を調整
        map.rotateTo(map.getBearing() + e.originalEvent.movementX * rotationSpeed);
      }
    });
      
    // NavigationControlの追加
    const nav = new maplibregl.NavigationControl({
      showCompass: true, // コンパスを表示
      visualizePitch: true, // ピッチ（角度）を表示
    });
    map.addControl(nav, 'top-left');

    map.on('load', () => {

      divisionLists.forEach((division, index) => {
        //JSON.parseを使って文字列をGeoJSONオブジェクトに変換
        const geojsonData = JSON.parse(division.Geojson);
        const sourceId = `floorplan-${index}`; // ユニークなIDを生成
        const layerId = `room-extrusion-${index}`; // ユニークなIDを生成

        console.log("index=", index);
        console.log("sourceId=", sourceId);
        console.log('geojsonData（renderMap内）=', geojsonData);

        map.addSource(sourceId, {
          type: 'geojson',
          data: geojsonData,
        });

        map.addLayer({
          id: layerId,
          type: 'fill-extrusion',
          source: sourceId,
          paint: {

            'fill-extrusion-color': [
              'case',
              ['==', ['geometry-type'], 'Polygon'], '#add8e6', // 底面をLightBlueに設定
              '#00008b' // 側面をDeepBlueに設定
            ],

            //'fill-extrusion-color': [
              //'case',
              //['==', ['geometry-type'], 'Polygon'],['get', 'color'], // 底面の色をGeoJSONのcolorプロパティから取得
              //['rgba', 
                //['get', 'color_r'], // 赤成分
                //['get', 'color_g'], // 緑成分
                //['get', 'color_b'], // 青成分
                //0.3 // 透過率30%
              //] // 側面の色を底面の色の透過率30%で設定
            //],

            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base_height'],
            'fill-extrusion-opacity': 0.6,
          },
        });
      
      })//endEach

    });
  
  }

  return <div id="map" style={{ height: '80vh', width: '80%' }} />;

}
