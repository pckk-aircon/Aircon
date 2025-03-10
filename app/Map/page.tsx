//https://zenn.dev/mapbox_japan/articles/21a276dbc52e7c
//を改変。
/*
"use client";
import { FC, useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
//import Map, { ViewState } from "react-map-gl/maplibre";
import Map, { ViewState } from "react-map-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const InitialViewState: Partial<ViewState> = {
  longitude: -87.61694,
  latitude: 41.86625,
  zoom: 15,
  pitch: 40, // マップの初期ピッチ (傾き)
  bearing: 20, // マップの初期ベアリング (回転)
};

const MAX_PITCH = 85 as const; // マップの最大ピッチ角度
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

      map.on('load', () => {
        // NavigationControlの追加
        const navControl = new maplibregl.NavigationControl({});
        map.addControl(navControl, "top-right");

        // 3D建物の追加
        map.addSource("buildings", {
          type: "geojson",
          data: "https://docs.mapbox.com/mapbox-gl-js/assets/indoor-3d-map.geojson",
        });

        map.addLayer({
          id: "3d-buildings",
          source: "buildings",
          type: "fill-extrusion",
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.6,
          },
        });
      });
    }
  }, []);

  return (
    <div ref={mapContainerRef} style={{ width: "100vw", height: "100vh", position: "relative" }} />
  );
};

export default TerrainMap;
*/


"use client";
import { FC, useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import Map, { ViewState } from "react-map-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const InitialViewState: Partial<ViewState> = {
  longitude: -87.61694,
  latitude: 41.86625,
  zoom: 15,
  pitch: 40,
  bearing: 20,
};

const MAX_PITCH = 85 as const;
const MAX_ZOOM = 30 as const;
const MIN_ZOOM = 1 as const;

const TerrainMap: FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  let hoveredBuildingId: number | null = null;

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

      map.on('load', () => {
        const navControl = new maplibregl.NavigationControl({});
        map.addControl(navControl, "top-right");

        map.addSource("buildings", {
          type: "geojson",
          data: "https://docs.mapbox.com/mapbox-gl-js/assets/indoor-3d-map.geojson",
        });

        map.addLayer({
          id: "3d-buildings",
          source: "buildings",
          type: "fill-extrusion",
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.6,
          },
        });

        map.on('mousemove', '3d-buildings', (e) => {
          if (e.features && e.features.length > 0) {
            if (hoveredBuildingId !== null) {
              map.setFeatureState(
                { source: 'buildings', id: hoveredBuildingId },
                { hover: false }
              );
            }
            const featureId = e.features[0].id;
            if (typeof featureId === 'number') {
              hoveredBuildingId = featureId;
              map.setFeatureState(
                { source: 'buildings', id: hoveredBuildingId },
                { hover: true }
              );
            }
          }
        });

        map.on('mouseleave', '3d-buildings', () => {
          if (hoveredBuildingId) {
            map.setFeatureState(
              { source: 'buildings', id: hoveredBuildingId },
              { hover: false }
            );
          }
          hoveredBuildingId = null;
        });
      });
    }
  }, []);

  return (
    <div ref={mapContainerRef} style={{ width: "100vw", height: "100vh", position: "relative" }} />
  );
};

export default TerrainMap;
