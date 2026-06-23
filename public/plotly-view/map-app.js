(() => {
  "use strict";

  // =========================================================
  // Guard
  // =========================================================
  if (typeof maplibregl === "undefined") {
    throw new Error("maplibregl が読み込まれていません");
  }

  if (typeof BABYLON === "undefined") {
    throw new Error("BABYLON が読み込まれていません");
  }

  // =========================================================
  // Fallback Adapter（standalone / file:// 用）
  // =========================================================
  if (typeof window.createViewAdapter !== "function") {
    console.warn("[MAP] createViewAdapter not found → standalone mode");

    window.createViewAdapter = function () {
      return {
        init: () => {
          console.log("[adapter] standalone");
        },
        applyUiLock: () => {
          // standaloneでは何もしない
        }
      };
    };
  }

  // =========================================================
  // DOM
  // =========================================================
  const els = {
    map: document.getElementById("map"),
    tooltip: document.getElementById("tooltip"),

    // Division CSV読込用
    divisionCsvInput:
      document.getElementById("divisionCsvInput") ||
      document.getElementById("fileInput"),

    // Device CSV読込用
    deviceCsvInput:
      document.getElementById("deviceCsvInput")
  };

  // =========================================================
  // State
  // =========================================================
  const appState = {
    rows: [],
    latest: new Map(),
    map: null,
    mapLoaded: false,
    divisionGeoJSON: null,
    babylonLayerAdded: false
  };

  // =========================================================
  // glTF / Babylon 設定
  // =========================================================

  // glTF の取得元
  const MODEL_BASE_URL =
    "https://pckk-device.s3.ap-southeast-2.amazonaws.com/";

  const deviceTypeToModel = {
    Aircon: "AirconModel.glb",
    Temp: "TempModel.glb"
  };

  // MapLibre / Babylon のワールド基準
  const worldOrigin = [140.303475, 35.35359];
  const worldAltitude = 0;
  const worldRotate = [Math.PI / 2, 0, 0];

  // Device 配置データ
  // CSVから読み込む
  // [type, lon, lat, height, rot, label, fallbackTemp?]
  let rawDeviceData = [];

  // =========================================================
  // Adapter（Plotlyと同じ構造）
  // =========================================================
  const adapter = window.createViewAdapter({
    onRowsLoaded: (rows) => {
      console.log("[MAP] RECV DATA", rows.length);
      setRows(rows);
      render();
    },

    onViewStateChanged: (viewState) => {
      console.log("[MAP] VIEWSTATE", viewState);
      // 今は特に何もしない
    }
  });

  // =========================================================
  // データ処理（IoT rows）
  // =========================================================
  function setRows(rows) {
    appState.rows = rows || [];

    const latest = new Map();

    for (const r of appState.rows) {
      const dev = r.DeviceName || r.Device;
      const ts = r.DatetimeAgg || r.DeviceDatetime;

      if (!dev || !ts) continue;

      const prev = latest.get(dev);

      if (!prev || ts > prev.ts) {
        latest.set(dev, {
          ts,
          temp: Number(r.ActualTemp),
          power: Number(r.ActivePower)
        });
      }
    }

    appState.latest = latest;
  }

  // =========================================================
  // CSV Parser
  // - quoted field対応
  // - DivisionOutlineのようにカンマを含むJSON文字列も対応
  // =========================================================
  function parseCsv(text) {
    const normalized = String(text || "")
      .replace(/^\uFEFF/, "")
      .trim();

    if (!normalized) return [];

    const rows = [];

    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      const next = normalized[i + 1];

      // "" → " として扱う
      if (char === '"' && inQuotes && next === '"') {
        field += '"';
        i++;
        continue;
      }

      // quote開始/終了
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      // field区切り
      if (char === "," && !inQuotes) {
        row.push(field);
        field = "";
        continue;
      }

      // 行区切り
      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") {
          i++;
        }

        row.push(field);
        field = "";

        if (row.some(v => String(v).trim() !== "")) {
          rows.push(row);
        }

        row = [];
        continue;
      }

      field += char;
    }

    row.push(field);

    if (row.some(v => String(v).trim() !== "")) {
      rows.push(row);
    }

    if (rows.length <= 1) {
      return [];
    }

    const headers = rows[0].map(h => String(h || "").trim());

    return rows.slice(1).map(cols => {
      const obj = {};

      headers.forEach((h, i) => {
        obj[h] = cols[i] ?? "";
      });

      return obj;
    });
  }

  // =========================================================
  // DivisionOutline文字列 → GeoJSON coordinates
  // =========================================================
  function parseDivisionOutline(value) {
    if (!value) return null;

    let s = String(value).trim();

    // 前後にダブルクォートが残った場合の保険
    s = s.replace(/^"|"$/g, "");

    // CSVやExcel経由で \[ \] になった場合の保険
    s = s
      .replace(/\\\[/g, "[")
      .replace(/\\\]/g, "]")
      .replace(/\\"/g, '"');

    try {
      const parsed = JSON.parse(s);

      // 期待形:
      // [
      //   [
      //     [lon, lat],
      //     [lon, lat],
      //     ...
      //   ]
      // ]
      if (!Array.isArray(parsed)) {
        console.warn("[MAP] DivisionOutline is not array:", parsed);
        return null;
      }

      return parsed;

    } catch (e) {
      console.warn("[MAP] DivisionOutline JSON parse error:", value, e);
      return null;
    }
  }

  // =========================================================
  // CSV rows → Division GeoJSON
  // =========================================================
  function buildDivisionGeoJSONFromRows(rows) {
    const features = [];

    for (const r of rows || []) {
      const division = r.Division;
      const outline = r.DivisionOutline;

      if (!division || !outline) {
        continue;
      }

      const coordinates = parseDivisionOutline(outline);

      if (!coordinates) {
        continue;
      }

      features.push({
        type: "Feature",
        properties: {
          Division: division,
          name: division,

          // CSVに Height 列があればそれを使用
          height: Number(r.Height || 7)
        },
        geometry: {
          type: "Polygon",
          coordinates
        }
      });
    }

    return {
      type: "FeatureCollection",
      features
    };
  }

  // =========================================================
  // Device CSV rows → rawDeviceData
  // =========================================================
  function parseNumberValue(value, fallback = 0) {
    const n = Number(String(value ?? "").trim());

    return Number.isFinite(n) ? n : fallback;
  }

  function parseRotationValue(value, fallback = 0) {
    const s = String(value ?? "").trim();

    if (!s) return fallback;

    const direct = Number(s);

    if (Number.isFinite(direct)) {
      return direct;
    }

    // CSVの rot に "Math.PI * 2.1 / 8" のような値が入る想定
    // evalは使わず、Math.PI と数値・演算子だけを許可する
    const allowed = s.replace(/\s+/g, "");

    if (!/^[0-9+\-*/().MathPI]+$/.test(allowed)) {
      console.warn("[MAP] invalid rot expression:", value);
      return fallback;
    }

    try {
      const expr = allowed.replace(/Math\.PI/g, String(Math.PI));

      const result = Function(`"use strict"; return (${expr});`)();

      return Number.isFinite(result) ? result : fallback;

    } catch (e) {
      console.warn("[MAP] rot parse error:", value, e);
      return fallback;
    }
  }

  function buildDeviceDataFromRows(rows) {
    const devices = [];

    for (const r of rows || []) {
      const type = String(
        r.type ||
        r.Type ||
        r.DeviceType ||
        ""
      ).trim();

      const lon = parseNumberValue(
        r.lon ||
        r.Lon ||
        r.Longitude,
        NaN
      );

      const lat = parseNumberValue(
        r.lat ||
        r.Lat ||
        r.Latitude,
        NaN
      );

      const height = parseNumberValue(
        r.height ||
        r.Height,
        0
      );

      const rot = parseRotationValue(
        r.rot ||
        r.Rot ||
        r.Rotation,
        0
      );

      const label = String(
        r.DeviceName ||
        r.deviceName ||
        r.label ||
        r.Label ||
        ""
      ).trim();

      const fallbackTempRaw =
        r.fallbackTemp ??
        r.FallbackTemp ??
        r.ActualTemp ??
        "";

      const fallbackTemp =
        fallbackTempRaw === ""
          ? null
          : parseNumberValue(fallbackTempRaw, null);

      if (!type || !Number.isFinite(lon) || !Number.isFinite(lat) || !label) {
        console.warn("[MAP] invalid device row skipped:", r);
        continue;
      }

      if (!deviceTypeToModel[type]) {
        console.warn("[MAP] unknown device type skipped:", r);
        continue;
      }

      devices.push([
        type,
        lon,
        lat,
        height,
        rot,
        label,
        fallbackTemp
      ]);
    }

    return devices;
  }

  function buildModelConfigs(deviceData) {
    return Object.values(
      (deviceData || []).reduce((acc, [type, lon, lat, height, rot]) => {
        const url = deviceTypeToModel[type];

        if (!url) {
          console.warn("[MAP] unknown device type:", type);
          return acc;
        }

        if (!acc[url]) {
          acc[url] = {
            url,
            positions: []
          };
        }

        acc[url].positions.push([lon, lat, height, rot]);

        return acc;
      }, {})
    );
  }

  // =========================================================
  // FileReader
  // =========================================================

  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const result = reader.result;

        // UTF-8で読んでみる
        let text = String(result || "");

        // 文字化け判定（簡易）
        if (text.includes("�")) {
          console.warn("[MAP] UTF-8 読込で文字化け検出 → Shift_JISで再読込");

          const reader2 = new FileReader();

          reader2.onload = () => {
            resolve(String(reader2.result || ""));
          };

          reader2.onerror = () => reject(reader2.error);

          reader2.readAsText(file, "shift_jis");
        } else {
          resolve(text);
        }
      };

      reader.onerror = () => reject(reader.error);

      reader.readAsText(file, "utf-8");
    });
  }

  async function loadDivisionGeoJSONFromFile(file) {
    const text = await readTextFile(file);
    const rows = parseCsv(text);

    console.log("[MAP] division csv rows", rows);

    const geojson = buildDivisionGeoJSONFromRows(rows);

    console.log("[MAP] division geojson from file", geojson);

    return geojson;
  }

  async function loadDeviceDataFromFile(file) {
    const text = await readTextFile(file);
    const rows = parseCsv(text);

    console.log("[MAP] device csv rows", rows);

    const devices = buildDeviceDataFromRows(rows);

    console.log("[MAP] device data from file", devices);

    return devices;
  }

  // =========================================================
  // 任意: http(s)起動時のみ ./division.csv 自動読込
  // file:// ではCORSになるためスキップ
  // =========================================================
  async function tryAutoLoadDivisionGeoJSON() {
    if (window.location.protocol === "file:") {
      console.warn(
        "[MAP] file:// のため fetch('./division.csv') はスキップします。CSVボタンから読み込んでください。"
      );
      return null;
    }

    try {
      const res = await fetch("./division.csv", {
        cache: "no-store"
      });

      if (!res.ok) {
        console.warn("[MAP] division.csv auto fetch failed:", res.status);
        return null;
      }

      const text = await res.text();
      const rows = parseCsv(text);
      const geojson = buildDivisionGeoJSONFromRows(rows);

      console.log("[MAP] division geojson from fetch", geojson);

      return geojson;

    } catch (e) {
      console.warn("[MAP] division.csv auto fetch error:", e);
      return null;
    }
  }

  // =========================================================
  // 任意: http(s)起動時のみ ./device.csv 自動読込
  // file:// ではCORSになるためスキップ
  // =========================================================
  async function tryAutoLoadDeviceData() {
    if (window.location.protocol === "file:") {
      console.warn(
        "[MAP] file:// のため fetch('./device.csv') はスキップします。Device CSVボタンから読み込んでください。"
      );
      return null;
    }

    try {
      const res = await fetch("./device.csv", {
        cache: "no-store"
      });

      if (!res.ok) {
        console.warn("[MAP] device.csv auto fetch failed:", res.status);
        return null;
      }

      const text = await res.text();
      const rows = parseCsv(text);
      const devices = buildDeviceDataFromRows(rows);

      console.log("[MAP] device data from fetch", devices);

      return devices;

    } catch (e) {
      console.warn("[MAP] device.csv auto fetch error:", e);
      return null;
    }
  }

  // =========================================================
  // MapLibre source/layer は使わず、Division情報だけ保持する
  // =========================================================
  function setDivisionGeoJSON(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.warn("[MAP] Division GeoJSON が空です");
      appState.divisionGeoJSON = null;
      return;
    }

    appState.divisionGeoJSON = geojson;

    console.log("[MAP] Division GeoJSON set for Babylon", geojson);
  }

  // =========================================================
  // Babylon座標変換
  // =========================================================
  function lngLatToBabylonVector(lon, lat, y, worldOriginMercator, worldScale) {
    const offset =
      maplibregl.MercatorCoordinate.fromLngLat(
        [lon, lat],
        worldAltitude
      );

    const dx =
      (offset.x - worldOriginMercator.x) / worldScale;

    const dz =
      (offset.y - worldOriginMercator.y) / worldScale;

    // 既存Device配置と同じ座標系
    return new BABYLON.Vector3(dx, y, -dz);
  }

  function isSamePoint2D(a, b) {
    if (!a || !b) return false;

    return (
      Math.abs(Number(a[0]) - Number(b[0])) < 1e-12 &&
      Math.abs(Number(a[1]) - Number(b[1])) < 1e-12
    );
  }

  function normalizeRing(ring) {
    if (!Array.isArray(ring)) return [];

    const points = ring
      .filter(p =>
        Array.isArray(p) &&
        Number.isFinite(Number(p[0])) &&
        Number.isFinite(Number(p[1]))
      )
      .map(p => [Number(p[0]), Number(p[1])]);

    if (points.length >= 2 && isSamePoint2D(points[0], points[points.length - 1])) {
      points.pop();
    }

    return points;
  }

  // =========================================================
  // Babylon Division 直方体メッシュ作成
  // - floor / ceiling / walls を1メッシュ化
  // - 輪郭は Tube で別途描画
  // =========================================================
  function createDivisionBoxMesh(scene, feature, featureIndex, worldOriginMercator, worldScale) {
    const geometry = feature.geometry;

    if (!geometry || geometry.type !== "Polygon") {
      console.warn("[MAP] Polygon以外のgeometryはスキップします:", geometry);
      return;
    }

    const outerRing = normalizeRing(geometry.coordinates?.[0]);

    if (outerRing.length < 3) {
      console.warn("[MAP] Division polygon points are insufficient:", feature);
      return;
    }

    const height = Number(feature.properties?.height || 7);
    const divisionName =
      feature.properties?.Division ||
      feature.properties?.name ||
      `division-${featureIndex}`;

    const bottomPoints = outerRing.map(([lon, lat]) =>
      lngLatToBabylonVector(
        lon,
        lat,
        0,
        worldOriginMercator,
        worldScale
      )
    );

    const topPoints = outerRing.map(([lon, lat]) =>
      lngLatToBabylonVector(
        lon,
        lat,
        height,
        worldOriginMercator,
        worldScale
      )
    );

    const positions = [];
    const indices = [];

    function addVertex(v) {
      positions.push(v.x, v.y, v.z);
      return positions.length / 3 - 1;
    }

    const bottomIdx = bottomPoints.map(addVertex);
    const topIdx = topPoints.map(addVertex);

    const n = bottomPoints.length;

    // ---------------------------------------------------------
    // 床面
    // 注意:
    // ここはシンプルな三角形ファンです。
    // 凹形ポリゴンや自己交差ポリゴンでは表示が崩れる可能性があります。
    // 矩形・凸形のDivisionでは問題なく使えます。
    // ---------------------------------------------------------
    for (let i = 1; i < n - 1; i++) {
      indices.push(bottomIdx[0], bottomIdx[i + 1], bottomIdx[i]);
    }

    // ---------------------------------------------------------
    // 天井面
    // ---------------------------------------------------------
    for (let i = 1; i < n - 1; i++) {
      indices.push(topIdx[0], topIdx[i], topIdx[i + 1]);
    }

    // ---------------------------------------------------------
    // 壁面
    // ---------------------------------------------------------
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;

      const b1 = bottomIdx[i];
      const b2 = bottomIdx[next];
      const t1 = topIdx[i];
      const t2 = topIdx[next];

      indices.push(b1, b2, t2);
      indices.push(b1, t2, t1);
    }

    const normals = [];

    BABYLON.VertexData.ComputeNormals(
      positions,
      indices,
      normals
    );

    const vertexData = new BABYLON.VertexData();

    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;

    const mesh = new BABYLON.Mesh(
      `division-box-${featureIndex}`,
      scene
    );

    vertexData.applyToMesh(mesh);

    const mat = new BABYLON.StandardMaterial(
      `division-box-mat-${featureIndex}`,
      scene
    );

    mat.diffuseColor = new BABYLON.Color3(0.25, 0.55, 1.0);
    mat.emissiveColor = new BABYLON.Color3(0.02, 0.08, 0.16);
    mat.alpha = 0.18;
    mat.backFaceCulling = false;
    mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;

    mesh.material = mat;
    mesh.alwaysSelectAsActiveMesh = true;

    mesh.metadata = {
      type: "DivisionBox",
      division: divisionName,
      height
    };

    createDivisionBoxEdges(
      scene,
      bottomPoints,
      topPoints,
      featureIndex,
      divisionName,
      height
    );

    console.log("[MAP] Division Babylon box created:", divisionName);
  }

  // =========================================================
  // Division 直方体の輪郭線
  // - 床外周
  // - 天井外周
  // - 縦線
  // =========================================================
  function createTubeLine(scene, name, path, radius, color) {
    if (!path || path.length < 2) return null;

    const mesh = BABYLON.MeshBuilder.CreateTube(
      name,
      {
        path,
        radius,
        tessellation: 8,
        updatable: false
      },
      scene
    );

    const mat = new BABYLON.StandardMaterial(
      `${name}-mat`,
      scene
    );

    mat.diffuseColor = color;
    mat.emissiveColor = color;
    mat.alpha = 1.0;
    mat.backFaceCulling = false;

    mesh.material = mat;
    mesh.alwaysSelectAsActiveMesh = true;

    return mesh;
  }

  function createDivisionBoxEdges(
    scene,
    bottomPoints,
    topPoints,
    featureIndex,
    divisionName,
    height
  ) {
    const n = bottomPoints.length;

    if (n < 3) return;

    const edgeColor = new BABYLON.Color3(1.0, 0.46, 0.0);
    const edgeRadius = 0.035;

    const bottomLoop = bottomPoints.map(p => p.clone());
    bottomLoop.push(bottomPoints[0].clone());

    const topLoop = topPoints.map(p => p.clone());
    topLoop.push(topPoints[0].clone());

    const bottomEdge = createTubeLine(
      scene,
      `division-bottom-edge-${featureIndex}`,
      bottomLoop,
      edgeRadius,
      edgeColor
    );

    const topEdge = createTubeLine(
      scene,
      `division-top-edge-${featureIndex}`,
      topLoop,
      edgeRadius,
      edgeColor
    );

    if (bottomEdge) {
      bottomEdge.metadata = {
        type: "DivisionBottomEdge",
        division: divisionName,
        height
      };
    }

    if (topEdge) {
      topEdge.metadata = {
        type: "DivisionTopEdge",
        division: divisionName,
        height
      };
    }

    for (let i = 0; i < n; i++) {
      const verticalEdge = createTubeLine(
        scene,
        `division-vertical-edge-${featureIndex}-${i}`,
        [
          bottomPoints[i].clone(),
          topPoints[i].clone()
        ],
        edgeRadius,
        edgeColor
      );

      if (verticalEdge) {
        verticalEdge.metadata = {
          type: "DivisionVerticalEdge",
          division: divisionName,
          height
        };
      }
    }
  }

  function createDivisionBoxes(scene, worldOriginMercator, worldScale) {
    const geojson = appState.divisionGeoJSON;

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.warn("[MAP] Division GeoJSON がないためBabylon直方体は作成しません");
      return;
    }

    geojson.features.forEach((feature, featureIndex) => {
      createDivisionBoxMesh(
        scene,
        feature,
        featureIndex,
        worldOriginMercator,
        worldScale
      );
    });
  }

  // =========================================================
  // Babylon.js custom layer 作成
  // =========================================================
  function createBabylonLayer() {
    const worldOriginMercator =
      maplibregl.MercatorCoordinate.fromLngLat(
        worldOrigin,
        worldAltitude
      );

    const worldScale =
      worldOriginMercator.meterInMercatorCoordinateUnits();

    const worldMatrix = BABYLON.Matrix.Compose(
      new BABYLON.Vector3(worldScale, worldScale, worldScale),
      BABYLON.Quaternion.FromEulerAngles(...worldRotate),
      new BABYLON.Vector3(
        worldOriginMercator.x,
        worldOriginMercator.y,
        worldOriginMercator.z
      )
    );

    return {
      id: "babylon-device-layer",
      type: "custom",
      renderingMode: "3d",

      onAdd(map, gl) {
        console.log("[MAP] Babylon layer onAdd");

        this.map = map;

        this.engine = new BABYLON.Engine(
          gl,
          true,
          {
            useHighPrecisionMatrix: true
          },
          true
        );

        this.scene = new BABYLON.Scene(this.engine);

        this.scene.autoClear = false;
        this.scene.preventDefaultOnPointerDown = false;
        this.scene.preventDefaultOnPointerUp = false;

        this.scene.beforeRender = () => {
          this.engine.wipeCaches(true);
        };

        this.camera = new BABYLON.Camera(
          "Camera",
          new BABYLON.Vector3(0, 0, 0),
          this.scene
        );

        const light = new BABYLON.HemisphericLight(
          "light1",
          new BABYLON.Vector3(0, 0, 100),
          this.scene
        );

        light.intensity = 0.9;

        // =========================
        // Division 直方体をBabylonで描画
        // =========================
        createDivisionBoxes(
          this.scene,
          worldOriginMercator,
          worldScale
        );

        // =========================
        // glTF Device モデル配置
        // =========================
        const modelConfigs = buildModelConfigs(rawDeviceData);

        modelConfigs.forEach(({ url, positions }, modelIndex) => {
          BABYLON.SceneLoader.LoadAssetContainerAsync(
            MODEL_BASE_URL,
            url,
            this.scene
          )
            .then((container) => {
              const rootMesh = container.createRootMesh();

              container.addAllToScene();

              positions.forEach(([lon, lat, height, rot], i) => {
                const offset =
                  maplibregl.MercatorCoordinate.fromLngLat(
                    [lon, lat],
                    worldAltitude
                  );

                const dx =
                  (offset.x - worldOriginMercator.x) / worldScale;

                const dz =
                  (offset.y - worldOriginMercator.y) / worldScale;

                const mesh = rootMesh.clone(
                  `device-${modelIndex}-instance-${i}`
                );

                mesh.position.set(dx, height, -dz);
                mesh.rotation.y = rot;

                const match = rawDeviceData.find(d =>
                  Math.abs(d[1] - lon) < 1e-9 &&
                  Math.abs(d[2] - lat) < 1e-9 &&
                  Math.abs(d[3] - height) < 1e-9 &&
                  Math.abs(d[4] - rot) < 1e-9
                );

                const type = match?.[0] ?? "";
                const label = match?.[5] ?? "ラベル未設定";

                mesh.metadata = {
                  type,
                  label
                };

                // 子メッシュにも metadata を付与
                mesh.getChildMeshes().forEach(child => {
                  child.metadata = {
                    type,
                    label
                  };
                });
              });

              // 元の root は非表示
              rootMesh.setEnabled(false);

              console.log("[MAP] model loaded:", url);
            })
            .catch(err => {
              console.error("[MAP] model load failed:", url, err);
            });
        });

        // MapLibre の canvas を Babylon に紐付ける
        this.scene.attachControl(map.getCanvas(), true);
      },

      render(gl, args) {
        const cameraMatrix =
          BABYLON.Matrix.FromArray(
            args.defaultProjectionData.mainMatrix
          );

        const wvpMatrix = worldMatrix.multiply(cameraMatrix);

        this.camera.freezeProjectionMatrix(wvpMatrix);
        this.scene.render(false);

        this.map.triggerRepaint();
      },

      onRemove() {
        try {
          this.scene?.dispose();
          this.engine?.dispose();
        } catch (e) {
          console.warn("[MAP] Babylon layer dispose skipped:", e);
        }
      }
    };
  }

  function removeBabylonLayer(map) {
    if (!map) return;

    if (map.getLayer("babylon-device-layer")) {
      map.removeLayer("babylon-device-layer");
    }

    appState.babylonLayerAdded = false;

    console.log("[MAP] Babylon layer removed");
  }

  function addBabylonLayer(map) {
    if (!map) return;

    const hasDeviceData =
      rawDeviceData &&
      rawDeviceData.length > 0;

    const hasDivisionData =
      appState.divisionGeoJSON &&
      appState.divisionGeoJSON.features &&
      appState.divisionGeoJSON.features.length > 0;

    if (!hasDeviceData && !hasDivisionData) {
      console.warn("[MAP] Device data / Division data が空のため Babylon layer は追加しません");
      return;
    }

    if (map.getLayer("babylon-device-layer")) {
      console.log("[MAP] Babylon layer already exists");
      return;
    }

    map.addLayer(createBabylonLayer());

    appState.babylonLayerAdded = true;

    console.log("[MAP] Babylon layer added");
  }

  function reloadBabylonLayer(map) {
    if (!map) return;

    removeBabylonLayer(map);
    addBabylonLayer(map);
  }

  // 既存コードとの互換用
  function addBabylonDeviceLayer(map) {
    addBabylonLayer(map);
  }

  function reloadBabylonDeviceLayer(map) {
    reloadBabylonLayer(map);
  }

  // =========================================================
  // postMessage safe
  // - file:// standaloneでは origin が null になりやすいので安全化
  // =========================================================
  function postToParentSafe(message) {
    if (!window.parent || window.parent === window) {
      return;
    }

    const targetOrigin =
      window.location.protocol === "file:"
        ? "*"
        : window.location.origin;

    try {
      window.parent.postMessage(message, targetOrigin);
    } catch (e) {
      console.warn("[MAP] postMessage skipped:", e);
    }
  }

  // =========================================================
  // Map init
  // =========================================================
  function initMap() {
    const map = new maplibregl.Map({
      container: "map",
      style:
        "https://api.maptiler.com/maps/basic/style.json?key=dQ9hiCWEc6AANyaB1ziN",
      center: [140.303872, 35.353847],
      zoom: 18,
      pitch: 60,
      bearing: 0,
      maxPitch: 89,

      // Babylon custom layer 用
      canvasContextAttributes: {
        antialias: true
      }
    });

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true
      })
    );

    appState.map = map;

    map.on("load", async () => {
      console.log("[MAP] loaded");

      appState.mapLoaded = true;

      // http(s)起動時のみ division.csv を自動読込
      // file:// ではスキップ
      const autoGeoJSON = await tryAutoLoadDivisionGeoJSON();

      if (autoGeoJSON) {
        setDivisionGeoJSON(autoGeoJSON);
      }

      // http(s)起動時のみ device.csv を自動読込
      // file:// ではスキップ
      const autoDeviceData = await tryAutoLoadDeviceData();

      if (autoDeviceData && autoDeviceData.length > 0) {
        rawDeviceData = autoDeviceData;
      }

      // Division直方体 / Device glTF をBabylonで描画
      addBabylonLayer(map);

      postToParentSafe({
        type: "MAP_READY"
      });
    });

    bindTooltip(map);
  }

  // =========================================================
  // Division CSV input events
  // =========================================================
  function bindCsvInput() {
    if (!els.divisionCsvInput) {
      console.warn(
        '[MAP] CSV入力が見つかりません。map-index.html に <input id="divisionCsvInput" type="file" accept=".csv" /> を追加してください。'
      );
      return;
    }

    els.divisionCsvInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];

      if (!file) return;

      try {
        console.log("[MAP] selected division csv", file.name);

        const geojson = await loadDivisionGeoJSONFromFile(file);

        if (!appState.map) {
          console.warn("[MAP] map is not ready yet");
          return;
        }

        if (!appState.mapLoaded) {
          console.warn("[MAP] map style is not loaded yet");
          return;
        }

        setDivisionGeoJSON(geojson);

        // Division直方体を更新するため Babylon layer を再作成
        reloadBabylonLayer(appState.map);

      } catch (err) {
        console.error("[MAP] failed to load selected division csv", err);
      }
    });
  }

  // =========================================================
  // Device CSV input events
  // =========================================================
  function bindDeviceCsvInput() {
    if (!els.deviceCsvInput) {
      console.warn(
        '[MAP] Device CSV入力が見つかりません。map-index.html に <input id="deviceCsvInput" type="file" accept=".csv" /> を追加してください。'
      );
      return;
    }

    els.deviceCsvInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];

      if (!file) return;

      try {
        console.log("[MAP] selected device csv", file.name);

        const devices = await loadDeviceDataFromFile(file);

        rawDeviceData = devices;

        if (!appState.map) {
          console.warn("[MAP] map is not ready yet");
          return;
        }

        if (!appState.mapLoaded) {
          console.warn("[MAP] map style is not loaded yet");
          return;
        }

        // Device配置を更新するため Babylon layer を再作成
        reloadBabylonLayer(appState.map);

      } catch (err) {
        console.error("[MAP] failed to load selected device csv", err);
      }
    });
  }

  // =========================================================
  // Tooltip
  // - Device glTF の位置に合わせて MapLibre 側の project 座標で判定
  // - IoT rows の最新温度があればそれを表示
  // =========================================================
  function bindTooltip(map) {
    if (!els.tooltip) return;

    const hoverRadiusPx = 60;

    function findHoveredDevice(point) {
      let nearest = null;
      let nearestDist = Infinity;

      for (const d of rawDeviceData) {
        const [type, lon, lat, height, rot, label, fallbackTemp = null] = d;

        const screen = map.project([lon, lat]);

        // 高さ分だけ見た目の位置を少し上に補正
        // pitchやzoomによって完全一致ではないが、実用上のhover補正
        const adjustedY = screen.y - height * 5;

        const dx = screen.x - point.x;
        const dy = adjustedY - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < hoverRadiusPx && dist < nearestDist) {
          nearest = {
            type,
            lon,
            lat,
            height,
            rot,
            label,
            fallbackTemp,
            screen: {
              x: screen.x,
              y: adjustedY
            },
            dist
          };

          nearestDist = dist;
        }
      }

      return nearest;
    }

    map.on("mousemove", (e) => {
      const hit = findHoveredDevice(e.point);

      if (hit) {
        const latest = appState.latest.get(hit.label);

        let text = hit.label;

        if (hit.type === "Temp") {
          const temp =
            Number.isFinite(latest?.temp)
              ? latest.temp
              : hit.fallbackTemp;

          if (temp != null && Number.isFinite(Number(temp))) {
            text = `${hit.label}\n${Number(temp)}℃`;
          }
        }

        if (hit.type === "Aircon") {
          const latestPower = latest?.power;

          if (Number.isFinite(latestPower)) {
            text = `${hit.label}\n${latestPower} W`;
          }
        }

        els.tooltip.style.display = "block";
        els.tooltip.style.left = e.originalEvent.clientX + 10 + "px";
        els.tooltip.style.top = e.originalEvent.clientY + 10 + "px";
        els.tooltip.innerText = text;

      } else {
        els.tooltip.style.display = "none";
      }
    });

    map.on("mouseout", () => {
      els.tooltip.style.display = "none";
    });
  }

  // =========================================================
  // Render
  // =========================================================
  function render() {
    // 現時点では tooltip が appState.latest を参照するため、
    // rows更新後に特別な再描画処理は不要。
    //
    // 将来:
    // - 温度に応じて TempModel の色を変える
    // - Aircon の稼働状態でモデル色を変える
    // - Division の色を IoT rows で更新する
    // 場合はここで Babylon scene を更新する。
  }

  // =========================================================
  // Init
  // =========================================================
  function init() {
    bindCsvInput();
    bindDeviceCsvInput();
    initMap();
    adapter.init();
    adapter.applyUiLock();
  }

  init();

})();
