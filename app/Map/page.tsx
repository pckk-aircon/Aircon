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

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {

  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; DivisionGeojson: string ;Controller?: string | null }>>([]);

  useEffect(() => {
    listPost();
    renderMap(); 

  }, []);

  async function listPost() {
    const { data, errors } = await client.queries.listDivision({
      Controller: "Mutsu01",
    });
    console.log('divisionLists（関数内）=', data);
    if (data) {
      setPosts(data as Array<{ Division: string; DivisionName: string; DivisionGeojson: string; Controller?: string | null }>); // 型を明示的にキャストする
    }
  }

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
      center: [140.325250, 35.355518],
      zoom: 15.99,
      pitch: 40,
      bearing: 20,
    });

    map.on('load', () => {
      map.addSource('floorplan', {
        type: 'geojson',
        data: 'https://maplibre.org/maplibre-gl-js/docs/assets/indoor-3d-map.geojson',
        //data: [divisionLists[0].DivisionGeojson],
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