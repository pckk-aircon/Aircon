/*

"use client"; // 追加

import React, { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import * as BABYLON from 'babylonjs';

interface CustomLayer extends maplibregl.CustomLayerInterface {
    engine?: BABYLON.Engine;
    scene?: BABYLON.Scene;
    camera?: BABYLON.Camera;
    map?: maplibregl.Map;
}

const MapWith3DModel: React.FC = () => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!mapContainerRef.current || !canvasRef.current) return;

        const gl = canvasRef.current.getContext("webgl2", { antialias: true });
        if (!gl) {
            console.error("WebGL2 コンテキストの作成に失敗しました");
            return;
        }

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: 'https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL', // APIキー
            zoom: 18,
            center: [140.302994, 35.353503],
            pitch: 60
        });

        const customLayer: CustomLayer = {
            id: '3d-model',
            type: 'custom',
            renderingMode: '3d',
            
            onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
                this.engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
                this.scene = new BABYLON.Scene(this.engine);
                this.scene.autoClear = false;
                this.scene.detachControl();

                this.camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), this.scene);
                const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), this.scene);
                light.intensity = 0.7;

                new BABYLON.AxesViewer(this.scene, 10);

                // シンプルな3Dボックスを作成（GLTFの代わり）
                const box = BABYLON.MeshBuilder.CreateBox("box", { size: 10 }, this.scene);
                box.position.x = 25;
                box.position.z = 25;

                this.map = map;
            },
            render(gl, args) {
                if (!this.camera) return;
                this.scene?.render(false);
                this.map?.triggerRepaint();
            }
        };

        map.on('style.load', () => {
            map.addLayer(customLayer);
        });

        return () => map.remove();
    }, []);

    return (
        <>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div ref={mapContainerRef} style={{ height: '100vh', width: '100%' }} />
        </>
    );
};

export default MapWith3DModel;

*/



"use client"; // 追加

import React, { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import * as BABYLON from 'babylonjs';

interface CustomLayer extends maplibregl.CustomLayerInterface {
    engine?: BABYLON.Engine;
    scene?: BABYLON.Scene;
    camera?: BABYLON.Camera;
    map?: maplibregl.Map;
}

const MapWith3DModel: React.FC = () => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!mapContainerRef.current || !canvasRef.current) return;

        const gl = canvasRef.current.getContext("webgl2", { antialias: true });
        if (!gl) {
            console.error("WebGL2 コンテキストの作成に失敗しました");
            return;
        }

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: 'https://api.maptiler.com/maps/basic/style.json?key=rtAeicf6fB2vbuvHChpL', // APIキー
            zoom: 18,
            center: [140.302994, 35.353503],
            pitch: 60
        });

        const customLayer: CustomLayer = {
            id: '3d-model',
            type: 'custom',
            renderingMode: '3d',

            onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
                this.engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
                this.scene = new BABYLON.Scene(this.engine);
                this.scene.autoClear = false;
                this.scene.detachControl();

                this.camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), this.scene);
                const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), this.scene);
                light.intensity = 0.7;

                new BABYLON.AxesViewer(this.scene, 10);

                // シンプルな3Dボックスを作成（GLTFの代わり）
                const box = BABYLON.MeshBuilder.CreateBox("box", { size: 10 }, this.scene);
                box.position.x = 25;
                box.position.z = 25;

                this.map = map;
            },
            render(gl, args) {
                if (!this.camera) return;
                this.scene?.render(false);
                this.map?.triggerRepaint();
            }
        };

        map.on('style.load', () => {
            map.addLayer(customLayer);
        });

        return () => map.remove();
    }, []);

    return (
        <>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div ref={mapContainerRef} style={{ height: '100vh', width: '100%' }} />
        </>
    );
};

export default MapWith3DModel;