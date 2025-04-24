"use client";

import React, { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = 'get_your_own_OpIi9ZULNHzrESv6T2vL';

const MapComponent = () => {
  useEffect(() => {
    const map = new maplibregl.Map({
      style: `https://api.maptiler.com/maps/basic-v2/style.json?key=${MAPTILER_KEY}`,
      center: [-74.0066, 40.7135],
      zoom: 15.5,
      pitch: 45,
      bearing: -17.6,
      container: 'map',
      canvasContextAttributes: { antialias: true }
    });

    map.on('load', () => {
      const layers = map.getStyle().layers;
      let labelLayerId;
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
          labelLayerId = layer.id;
          break;
        }
      }

      map.addSource('openmaptiles', {
        url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}`,
        type: 'vector',
      });

      map.addLayer(
        {
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 15,
          filter: ['!=', ['get', 'hide_3d'], true],
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'render_height'], 0, 'lightgray', 200, 'royalblue', 400, 'lightblue'
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              15, 0, 16, ['get', 'render_height']
            ],
            'fill-extrusion-base': ['case',
              ['>=', ['get', 'zoom'], 16],
              ['get', 'render_min_height'], 0
            ]
          }
        },
        labelLayerId
      );
    });
  }, []);

  return <div id="map" style={{ height: '100%' }} />;
};

export default MapComponent;


