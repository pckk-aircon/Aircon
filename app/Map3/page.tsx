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



/*

"use client"; // 追加

import React, { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

interface CustomLayer extends maplibregl.CustomLayerInterface {
    engine?: BABYLON.Engine;
    scene?: BABYLON.Scene;
    camera?: BABYLON.Camera;
    map?: maplibregl.Map; // 追加
}

const MapWith3DModel: React.FC = () => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!mapContainerRef.current || !canvasRef.current) return;

        // WebGL2コンテキストを作成
        const gl = canvasRef.current.getContext("webgl2", { antialias: true });
        if (!gl) {
            console.error("WebGL2 コンテキストの作成に失敗しました");
            return;
        }

        // Maplibre GL の設定
        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: 'https://api.maptiler.com/maps/basic/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
            zoom: 18,
            center: [148.9819, -35.3981],
            pitch: 60
        });

        // ワールド座標の設定
        const worldOrigin: [number, number] = [148.9819, -35.39847];
        const worldAltitude = 0;
        const worldRotate: [number, number, number] = [Math.PI / 2, 0, 0];

        const worldOriginMercator = maplibregl.MercatorCoordinate.fromLngLat(worldOrigin, worldAltitude);
        const worldScale = worldOriginMercator.meterInMercatorCoordinateUnits();

        const worldMatrix = BABYLON.Matrix.Compose(
            new BABYLON.Vector3(worldScale, worldScale, worldScale),
            BABYLON.Quaternion.FromEulerAngles(...worldRotate),
            new BABYLON.Vector3(
                worldOriginMercator.x,
                worldOriginMercator.y,
                worldOriginMercator.z
            )
        );

        // カスタムレイヤー
        const customLayer: CustomLayer = {
            id: '3d-model',
            type: 'custom',
            renderingMode: '3d',
            onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
                this.engine = new BABYLON.Engine(gl, true, { useHighPrecisionMatrix: true }, true);
                this.scene = new BABYLON.Scene(this.engine);
                this.scene.autoClear = false;
                this.scene.detachControl();

                this.scene.beforeRender = () => {
                    this.engine?.wipeCaches(true);
                };

                this.camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), this.scene);
                const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), this.scene);
                light.intensity = 0.7;

                new BABYLON.AxesViewer(this.scene, 10);

                BABYLON.SceneLoader.LoadAssetContainerAsync(
                    'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/34M_17.gltf',
                    '',
                    this.scene
                ).then((modelContainer) => {
                    modelContainer.addAllToScene();
                    const rootMesh = modelContainer.createRootMesh();
                    const rootMesh2 = rootMesh.clone();
                    rootMesh2.position.x = 25;
                    rootMesh2.position.z = 25;
                });

                this.map = map;
            },
            render(gl, args) {
                if (!this.camera) return;

                const projectionData = args as any; // 型を一時的に適用
                const cameraMatrix = BABYLON.Matrix.FromArray(projectionData.defaultProjectionData?.mainMatrix || []);
                const wvpMatrix = worldMatrix.multiply(cameraMatrix);

                this.camera.freezeProjectionMatrix(wvpMatrix);
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
import 'babylonjs-loaders';

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
            style: 'https://api.maptiler.com/maps/basic/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
            zoom: 18,
            center: [148.9819, -35.3981],
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

                // GLTFのJSONデータをベタ書き
                const gltfData = {
                    "asset": {
                        "version": "2.0"
                    },
                    "scenes": [
                        {
                            "nodes": [0]
                        }
                    ],
                    "nodes": [
                        {
                            "mesh": 0
                        }
                    ],
                    "meshes": [
                        {
                            "primitives": [
                                {
                                    "attributes": {
                                        "POSITION": 0
                                    },
                                    "indices": 1
                                }
                            ]
                        }
                    ],
                    "buffers": [
                        {
                            "uri": "data:application/octet-stream;base64,...", // バイナリデータをBase64エンコードしたもの
                            "byteLength": 1024
                        }
                    ],
                    "bufferViews": [
                        {
                            "buffer": 0,
                            "byteOffset": 0,
                            "byteLength": 512,
                            "target": 34962
                        },
                        {
                            "buffer": 0,
                            "byteOffset": 512,
                            "byteLength": 512,
                            "target": 34963
                        }
                    ],
                    "accessors": [
                        {
                            "bufferView": 0,
                            "byteOffset": 0,
                            "componentType": 5126,
                            "count": 24,
                            "type": "VEC3",
                            "max": [1.0, 1.0, 1.0],
                            "min": [-1.0, -1.0, -1.0]
                        },
                        {
                            "bufferView": 1,
                            "byteOffset": 0,
                            "componentType": 5123,
                            "count": 36,
                            "type": "SCALAR"
                        }
                    ]
                };

                BABYLON.SceneLoader.ImportMesh("", "", "data:application/json;base64," + btoa(JSON.stringify(gltfData)), this.scene, (meshes) => {
                    meshes.forEach(mesh => {
                        mesh.position.x = 25;
                        mesh.position.z = 25;
                    });
                });

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
