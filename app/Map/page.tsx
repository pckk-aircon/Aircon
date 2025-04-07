//https://zenn.dev/mapbox_japan/articles/21a276dbc52e7c
//を改変。
/*


"use client";
import React, { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function App() {
  useEffect(() => {
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
      center: [-87.61694, 41.86625],
      zoom: 15.99,
      pitch: 40,
      bearing: 20,
    });

    map.on('load', () => {
      map.addSource('floorplan', {
        type: 'geojson',
        data: 'https://maplibre.org/maplibre-gl-js/docs/assets/indoor-3d-map.geojson',
      });

      map.addLayer({
        id: 'room-extrusion',
        type: 'fill-extrusion',
        source: 'floorplan',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base_height'],
          'fill-extrusion-opacity': 0.5,
        },
      });
    });
  }, []);

  return <div id="map" style={{ height: '100vh' }} />;
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

  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; DivisionGeojson: string ;Controller?: string | null }>>([]);
  console.log('divisionLists（State直後）=', divisionLists);

  const divisionNames = divisionLists.map(divisionLists => divisionLists.DivisionName);
  const divisionGeojsons = divisionLists.map(divisionLists => divisionLists.DivisionGeojson);
  console.log('DivisionGeojson（State直後）=', divisionNames[0]); 
  console.log('divisionGeojsons（State直後）=', divisionGeojsons[0]); 


  useEffect(() => {
    async function fetchData() {
        await listPost();
    }
    fetchData();
  }, []);

  async function listPost() {
    const { data, errors } = await client.queries.listDivision({
      Controller: "Mutsu01",
    });
    console.log('data（関数内）=', data);
    if (data) {
      setPosts(data as Array<{ Division: string; DivisionName: string; DivisionGeojson: string; Controller?: string | null }>); // 型を明示的にキャストする
    }

    renderMap();

  }

  async function renderMap() {

    // データが存在しない場合はローディング表示やスキップ
    if (divisionLists.length === 0) {
      console.log("return");
      return <div>Loading...</div>;
    }
   
    console.log('DivisionGeojson（renderMap内）=', divisionNames[0]); 
    console.log('divisionGeojsons（renderMap内）=', divisionGeojsons[0]);

    const buildingData: FeatureCollection<Geometry, GeoJsonProperties> = {
      "type": "FeatureCollection",
      "features": [
        { 
          "type": "Feature", 
          "properties": { 
            "level": 1, 
            "name": "outer-walls", 
            "height": 6, 
            "base_height": 0, 
            "color": "transparent"
          }, 
          "geometry": { 
            "type": "Polygon", 
            "coordinates": [
              [
                [140.30278407246294,35.3536506960797],
                [140.3028859586707,35.353561867136904],
                [140.30279109909793,35.35349309627546],
                [140.3029544683622,35.35335412164743],
                [140.30308270445295,35.35344868172962],
                [140.30303878798242,35.35349166354854],
                [140.30326539696347,35.353659292423814],
                [140.30329174684482,35.35364066701038],
                [140.3033163400674,35.35366359059552],
                [140.30334093328997,35.35364639790731],
                [140.30337079648882,35.35367218693828],
                [140.30334971658374,35.35368937962103],
                [140.3036044321032,35.35387993161025],
                [140.3035499756818,35.353928644076575],
                [140.30353592241175,35.35392148048041],
                [140.30349903257797,35.35395156757994],
                [140.30353943572925,35.35397878923173],
                [140.3034111996402,35.3540833775981],
                [140.30328472020983,35.35398308738647],
                [140.30331107009107,35.35396302932918],
                [140.3031933739545,35.35387706617017],
                [140.30314243085064,35.35392434591894],
                [140.30304757127618,35.35385270992512],
                [140.30311081099296,35.35380256469101],
                [140.30308270445295,35.35377964114534],
                [140.30301946473617,35.353828353672114],
                [140.30278407246294,35.35364783063146]
              ]
            ]
          } 
        },
      ] 
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
      zoom: 15.99,
      pitch: 40,
      bearing: 20,
    });

    map.on('load', () => {
      map.addSource('floorplan', {
        type: 'geojson',
        //data: 'https://maplibre.org/maplibre-gl-js/docs/assets/indoor-3d-map.geojson',
        data: buildingData,
      });

      map.addLayer({
        id: 'room-extrusion',
        type: 'fill-extrusion',
        source: 'floorplan',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base_height'],
          'fill-extrusion-opacity': 0.5,
        },
      });
    });

  }

  return <div id="map" style={{ height: '100vh' }} />;
}