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

    // standalone CSV / parent postMessage のどちらから来たかを管理
    divisionSource: null,
    deviceSource: null,
    rowsSource: null
  };

  // =========================================================
  // Babylon Runtime
  // =========================================================
  const babylonRuntime = {
    layerAdded: false,
    sceneReady: false,

    map: null,
    engine: null,
    scene: null,
    camera: null,

    worldOriginMercator: null,
    worldScale: null,
    worldMatrix: null,

    divisionRoot: null,
    deviceRoot: null,

    // url -> { container, templateRoot }
    modelCache: new Map(),

    // Device CSV読込中に古い非同期処理が残るのを防ぐ
    deviceVersion: 0
  };

  // =========================================================
  // glTF / Babylon 設定
  // =========================================================
  const MODEL_BASE_URL =
    window.__MODEL_BASE_URL__ ||
    "https://pckk-device.s3.ap-southeast-2.amazonaws.com/";

  const deviceTypeToModel = {
    Aircon: "AirconModel.glb",
    AC: "AirconModel.glb",
    AirConditioner: "AirconModel.glb",

    Temp: "TempModel.glb",
    TemperatureSensor: "TempModel.glb"
  };

  // MapLibre / Babylon のワールド基準
  const worldOrigin = [140.303475, 35.35359];
  const worldAltitude = 0;
  const worldRotate = [Math.PI / 2, 0, 0];

  // Device 配置データ
  // [type, lon, lat, height, rot, label, fallbackTemp?]
  let rawDeviceData = [];

  // =========================================================
  // Adapter（Plotlyと同じ構造）
  // =========================================================
  const adapter = window.createViewAdapter({
    onRowsLoaded: (rows) => {
      console.log("[MAP] RECV DATA", rows.length);

      appState.rowsSource = "adapter";

      setRows(rows);
      render();
    },

    onViewStateChanged: (viewState) => {
      console.log("[MAP] VIEWSTATE", viewState);
    }
  });

  // =========================================================
  // IoT rows
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

      if (char === '"' && inQuotes && next === '"') {
        field += '"';
        i++;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(field);
        field = "";
        continue;
      }

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
  // 文字コード対応
  // - UTF-8
  // - Shift_JIS / CP932
  // =========================================================
  function decodeArrayBuffer(buffer) {
    try {
      return new TextDecoder("utf-8", {
        fatal: true
      }).decode(buffer);
    } catch (e) {
      console.warn("[MAP] UTF-8 decode failed → Shift_JISで再読込");
      return new TextDecoder("shift_jis").decode(buffer);
    }
  }

  async function readTextFile(file) {
    const buffer = await file.arrayBuffer();
    return decodeArrayBuffer(buffer);
  }

  async function fetchTextSmart(url) {
    const res = await fetch(url, {
      cache: "no-store"
    });

    if (!res.ok) {
      throw new Error(`fetch failed: ${url}, status=${res.status}`);
    }

    const buffer = await res.arrayBuffer();
    return decodeArrayBuffer(buffer);
  }

  // =========================================================
  // DivisionOutline文字列 / 配列 → GeoJSON coordinates
  // =========================================================
  function parseDivisionOutline(value) {
    if (!value) return null;

    // Amplify / AppSync / DynamoDB から配列として来た場合
    if (Array.isArray(value)) {
      return value;
    }

    let s = String(value).trim();

    // CSV由来で外側に余分な " が付く場合を吸収
    s = s.replace(/^"|"$/g, "");

    // CSV保存時のエスケープ吸収
    s = s
      .replace(/\\\[/g, "[")
      .replace(/\\\]/g, "]")
      .replace(/\\"/g, '"');

    try {
      const parsed = JSON.parse(s);

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
  // CSV rows / parent rows → Division GeoJSON
  // =========================================================
  function buildDivisionGeoJSONFromRows(rows) {
    const features = [];

    for (const r of rows || []) {
      const division = String(
        r.Division ||
        r.division ||
        r.DivisionName ||
        r.divisionName ||
        r.name ||
        ""
      ).trim();

      const outline =
        r.DivisionOutline ??
        r.divisionOutline ??
        r.DivisionPolygon ??
        r.divisionPolygon ??
        r.Polygon ??
        r.polygon;

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
          height: Number(r.Height ?? r.height ?? 7)
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
  // Device rows → rawDeviceData
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
        r.deviceType ||
        ""
      ).trim();

      const lon = parseNumberValue(
        r.lon ??
        r.Lon ??
        r.Longitude ??
        r.longitude,
        NaN
      );

      const lat = parseNumberValue(
        r.lat ??
        r.Lat ??
        r.Latitude ??
        r.latitude,
        NaN
      );

      const height = parseNumberValue(
        r.height ??
        r.Height,
        0
      );

      const rot = parseRotationValue(
        r.rot ??
        r.Rot ??
        r.Rotation ??
        r.rotation,
        0
      );

      const label = String(
        r.DeviceName ||
        r.deviceName ||
        r.Device ||
        r.device ||
        r.label ||
        r.Label ||
        ""
      ).trim();

      const fallbackTempRaw =
        r.fallbackTemp ??
        r.FallbackTemp ??
        r.ActualTemp ??
        r.actualTemp ??
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
      (deviceData || []).reduce((acc, device, index) => {
        const [type, lon, lat, height, rot, label, fallbackTemp] = device;
        const url = deviceTypeToModel[type];

        if (!url) {
          console.warn("[MAP] unknown device type:", type);
          return acc;
        }

        if (!acc[url]) {
          acc[url] = {
            url,
            devices: []
          };
        }

        acc[url].devices.push({
          index,
          type,
          lon,
          lat,
          height,
          rot,
          label,
          fallbackTemp
        });

        return acc;
      }, {})
    );
  }

  // =========================================================
  // File loaders
  // =========================================================
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

  async function tryAutoLoadDivisionGeoJSON() {
    if (window.location.protocol === "file:") {
      console.warn(
        "[MAP] file:// のため fetch('./division.csv') はスキップします。CSVボタンから読み込んでください。"
      );
      return null;
    }

    try {
      const text = await fetchTextSmart("./division.csv");
      const rows = parseCsv(text);
      const geojson = buildDivisionGeoJSONFromRows(rows);

      console.log("[MAP] division geojson from fetch", geojson);

      return geojson;

    } catch (e) {
      console.warn("[MAP] division.csv auto fetch error:", e);
      return null;
    }
  }

  async function tryAutoLoadDeviceData() {
    if (window.location.protocol === "file:") {
      console.warn(
        "[MAP] file:// のため fetch('./device.csv') はスキップします。Device CSVボタンから読み込んでください。"
      );
      return null;
    }

    try {
      const text = await fetchTextSmart("./device.csv");
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
  // Division GeoJSON state
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
  function lngLatToBabylonVector(lon, lat, y) {
    const offset =
      maplibregl.MercatorCoordinate.fromLngLat(
        [lon, lat],
        worldAltitude
      );

    const dx =
      (offset.x - babylonRuntime.worldOriginMercator.x) /
      babylonRuntime.worldScale;

    const dz =
      (offset.y - babylonRuntime.worldOriginMercator.y) /
      babylonRuntime.worldScale;

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

    if (
      points.length >= 2 &&
      isSamePoint2D(points[0], points[points.length - 1])
    ) {
      points.pop();
    }

    return points;
  }

  // =========================================================
  // Babylon root helpers
  // =========================================================
  function disposeNode(node) {
    if (!node) return;

    try {
      node.dispose(false, true);
    } catch (e) {
      console.warn("[MAP] dispose skipped:", e);
    }
  }

  function createRootNode(name) {
    return new BABYLON.TransformNode(
      name,
      babylonRuntime.scene
    );
  }

  function ensureBabylonSceneReady() {
    return (
      babylonRuntime.sceneReady &&
      babylonRuntime.scene &&
      babylonRuntime.worldOriginMercator &&
      babylonRuntime.worldScale
    );
  }

  // =========================================================
  // Materials
  // =========================================================
  function createDivisionBoxMaterial(name) {
    const mat = new BABYLON.StandardMaterial(
      name,
      babylonRuntime.scene
    );

    mat.diffuseColor = new BABYLON.Color3(0.25, 0.55, 1.0);
    mat.emissiveColor = new BABYLON.Color3(0.02, 0.08, 0.16);
    mat.alpha = 0.18;
    mat.backFaceCulling = false;
    mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;

    return mat;
  }

  function createEdgeMaterial(name) {
    const mat = new BABYLON.StandardMaterial(
      name,
      babylonRuntime.scene
    );

    const color = new BABYLON.Color3(1.0, 0.68, 0.0);

    mat.diffuseColor = color;
    mat.emissiveColor = color;
    mat.alpha = 1.0;
    mat.backFaceCulling = false;

    return mat;
  }

  // =========================================================
  // Division mesh
  // =========================================================
  function createTubeLine(name, path, radius, material, parent) {
    if (!path || path.length < 2) return null;

    const mesh = BABYLON.MeshBuilder.CreateTube(
      name,
      {
        path,
        radius,
        tessellation: 8,
        updatable: false
      },
      babylonRuntime.scene
    );

    mesh.material = material;
    mesh.parent = parent;
    mesh.alwaysSelectAsActiveMesh = true;

    return mesh;
  }

  function createDivisionBoxEdges(
    bottomPoints,
    topPoints,
    featureIndex,
    divisionName,
    height,
    parent
  ) {
    const n = bottomPoints.length;

    if (n < 3) return;

    const edgeRadius = 0.035;
    const edgeMaterial = createEdgeMaterial(
      `division-edge-mat-${featureIndex}`
    );

    const bottomLoop = bottomPoints.map(p => p.clone());
    bottomLoop.push(bottomPoints[0].clone());

    const topLoop = topPoints.map(p => p.clone());
    topLoop.push(topPoints[0].clone());

    const bottomEdge = createTubeLine(
      `division-bottom-edge-${featureIndex}`,
      bottomLoop,
      edgeRadius,
      edgeMaterial,
      parent
    );

    const topEdge = createTubeLine(
      `division-top-edge-${featureIndex}`,
      topLoop,
      edgeRadius,
      edgeMaterial,
      parent
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
        `division-vertical-edge-${featureIndex}-${i}`,
        [
          bottomPoints[i].clone(),
          topPoints[i].clone()
        ],
        edgeRadius,
        edgeMaterial,
        parent
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

  function createDivisionBoxMesh(feature, featureIndex, parent) {
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
        0
      )
    );

    const topPoints = outerRing.map(([lon, lat]) =>
      lngLatToBabylonVector(
        lon,
        lat,
        height
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

    // 床面
    // 注意: 凹形ポリゴンの場合は三角形ファンでは崩れる可能性あり
    for (let i = 1; i < n - 1; i++) {
      indices.push(bottomIdx[0], bottomIdx[i + 1], bottomIdx[i]);
    }

    // 天井面
    for (let i = 1; i < n - 1; i++) {
      indices.push(topIdx[0], topIdx[i], topIdx[i + 1]);
    }

    // 壁面
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
      babylonRuntime.scene
    );

    vertexData.applyToMesh(mesh);

    mesh.material = createDivisionBoxMaterial(
      `division-box-mat-${featureIndex}`
    );

    mesh.parent = parent;
    mesh.alwaysSelectAsActiveMesh = true;

    mesh.metadata = {
      type: "DivisionBox",
      division: divisionName,
      height
    };

    createDivisionBoxEdges(
      bottomPoints,
      topPoints,
      featureIndex,
      divisionName,
      height,
      parent
    );

    console.log("[MAP] Division Babylon box created:", divisionName);
  }

  function rebuildDivisionMeshes() {
    if (!ensureBabylonSceneReady()) {
      console.warn("[MAP] Babylon scene not ready. Division rebuild skipped.");
      return;
    }

    disposeNode(babylonRuntime.divisionRoot);

    babylonRuntime.divisionRoot = createRootNode("division-root");

    const geojson = appState.divisionGeoJSON;

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.warn("[MAP] Division GeoJSON がないためBabylon直方体は作成しません");
      return;
    }

    geojson.features.forEach((feature, featureIndex) => {
      createDivisionBoxMesh(
        feature,
        featureIndex,
        babylonRuntime.divisionRoot
      );
    });

    console.log("[MAP] Division meshes rebuilt");
  }

  // =========================================================
  // Device model cache
  // =========================================================
  async function getModelTemplate(url) {
    if (babylonRuntime.modelCache.has(url)) {
      return babylonRuntime.modelCache.get(url);
    }

    const container =
      await BABYLON.SceneLoader.LoadAssetContainerAsync(
        MODEL_BASE_URL,
        url,
        babylonRuntime.scene
      );

    const templateRoot = container.createRootMesh();

    container.addAllToScene();

    templateRoot.setEnabled(false);

    const cached = {
      container,
      templateRoot
    };

    babylonRuntime.modelCache.set(url, cached);

    console.log("[MAP] model cached:", url);

    return cached;
  }

  function setMetadataRecursive(mesh, metadata) {
    mesh.metadata = metadata;

    mesh.getChildMeshes().forEach(child => {
      child.metadata = metadata;
    });
  }

  async function rebuildDeviceMeshes() {
    if (!ensureBabylonSceneReady()) {
      console.warn("[MAP] Babylon scene not ready. Device rebuild skipped.");
      return;
    }

    const currentVersion = ++babylonRuntime.deviceVersion;

    disposeNode(babylonRuntime.deviceRoot);

    babylonRuntime.deviceRoot = createRootNode("device-root");

    if (!rawDeviceData || rawDeviceData.length === 0) {
      console.warn("[MAP] Device data が空のためDevice meshは作成しません");
      return;
    }

    const modelConfigs = buildModelConfigs(rawDeviceData);

    for (let modelIndex = 0; modelIndex < modelConfigs.length; modelIndex++) {
      const { url, devices } = modelConfigs[modelIndex];

      let cached;

      try {
        cached = await getModelTemplate(url);
      } catch (err) {
        console.error("[MAP] model load failed:", url, err);
        continue;
      }

      // 読込中に別のCSV/parent dataが読み込まれた場合、古い処理を破棄
      if (currentVersion !== babylonRuntime.deviceVersion) {
        console.warn("[MAP] stale device rebuild skipped:", url);
        return;
      }

      const templateRoot = cached.templateRoot;

      devices.forEach((device, i) => {
        const {
          type,
          lon,
          lat,
          height,
          rot,
          label
        } = device;

        const pos = lngLatToBabylonVector(
          lon,
          lat,
          height
        );

        const mesh = templateRoot.clone(
          `device-${modelIndex}-instance-${i}`
        );

        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.rotation.y = rot;
        mesh.parent = babylonRuntime.deviceRoot;
        mesh.setEnabled(true);

        setMetadataRecursive(mesh, {
          type,
          label
        });
      });
    }

    console.log("[MAP] Device meshes rebuilt:", rawDeviceData.length);
  }

  function rebuildBabylonContent() {
    rebuildDivisionMeshes();
    rebuildDeviceMeshes();
  }

  // =========================================================
  // Babylon custom layer
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

    babylonRuntime.worldOriginMercator = worldOriginMercator;
    babylonRuntime.worldScale = worldScale;
    babylonRuntime.worldMatrix = worldMatrix;

    return {
      id: "babylon-device-layer",
      type: "custom",
      renderingMode: "3d",

      onAdd(map, gl) {
        console.log("[MAP] Babylon layer onAdd");

        babylonRuntime.map = map;

        this.map = map;

        babylonRuntime.engine = new BABYLON.Engine(
          gl,
          true,
          {
            useHighPrecisionMatrix: true
          },
          true
        );

        babylonRuntime.scene = new BABYLON.Scene(
          babylonRuntime.engine
        );

        const scene = babylonRuntime.scene;

        scene.autoClear = false;
        scene.preventDefaultOnPointerDown = false;
        scene.preventDefaultOnPointerUp = false;

        scene.beforeRender = () => {
          babylonRuntime.engine.wipeCaches(true);
        };

        babylonRuntime.camera = new BABYLON.Camera(
          "Camera",
          new BABYLON.Vector3(0, 0, 0),
          scene
        );

        const light = new BABYLON.HemisphericLight(
          "light1",
          new BABYLON.Vector3(0, 0, 100),
          scene
        );

        light.intensity = 0.9;

        babylonRuntime.divisionRoot = createRootNode("division-root");
        babylonRuntime.deviceRoot = createRootNode("device-root");

        scene.attachControl(map.getCanvas(), true);

        babylonRuntime.sceneReady = true;

        // 現在保持している Division / Device を生成
        // CSV由来でも parent postMessage由来でも同じ入口
        rebuildBabylonContent();
      },

      render(gl, args) {
        if (!babylonRuntime.scene || !babylonRuntime.camera) {
          return;
        }

        const cameraMatrix =
          BABYLON.Matrix.FromArray(
            args.defaultProjectionData.mainMatrix
          );

        const wvpMatrix =
          babylonRuntime.worldMatrix.multiply(cameraMatrix);

        babylonRuntime.camera.freezeProjectionMatrix(wvpMatrix);

        babylonRuntime.scene.render(false);

        this.map.triggerRepaint();
      },

      onRemove() {
        try {
          babylonRuntime.sceneReady = false;

          disposeNode(babylonRuntime.divisionRoot);
          disposeNode(babylonRuntime.deviceRoot);

          babylonRuntime.modelCache.forEach(({ container }) => {
            try {
              container.dispose();
            } catch (e) {
              console.warn("[MAP] model container dispose skipped:", e);
            }
          });

          babylonRuntime.modelCache.clear();

          babylonRuntime.scene?.dispose();
          babylonRuntime.engine?.dispose();

        } catch (e) {
          console.warn("[MAP] Babylon layer dispose skipped:", e);
        }
      }
    };
  }

  function addBabylonLayerOnce(map) {
    if (!map) return;

    if (map.getLayer("babylon-device-layer")) {
      console.log("[MAP] Babylon layer already exists");
      return;
    }

    map.addLayer(createBabylonLayer());

    babylonRuntime.layerAdded = true;

    console.log("[MAP] Babylon layer added once");
  }

  // =========================================================
  // parent postMessage receiver
  // - Amplify / Next.js page.tsx から Division / Device / IoT rows を受け取る
  // - standalone CSV機能はそのまま維持
  // =========================================================
  function applyDivisionRowsFromParent(rows) {
    appState.divisionSource = "parent";

    const geojson = buildDivisionGeoJSONFromRows(rows || []);

    console.log("[MAP] division rows from parent", rows);
    console.log("[MAP] division geojson from parent", geojson);

    setDivisionGeoJSON(geojson);

    if (!appState.map || !appState.mapLoaded) {
      console.warn("[MAP] map is not ready yet. Division will be applied after layer ready.");
      return;
    }

    if (ensureBabylonSceneReady()) {
      rebuildDivisionMeshes();
    } else {
      addBabylonLayerOnce(appState.map);
    }
  }

  function applyDeviceRowsFromParent(rows) {
    appState.deviceSource = "parent";

    const devices = buildDeviceDataFromRows(rows || []);

    console.log("[MAP] device rows from parent", rows);
    console.log("[MAP] device data from parent", devices);

    rawDeviceData = devices;

    if (!appState.map || !appState.mapLoaded) {
      console.warn("[MAP] map is not ready yet. Device will be applied after layer ready.");
      return;
    }

    if (ensureBabylonSceneReady()) {
      rebuildDeviceMeshes();
    } else {
      addBabylonLayerOnce(appState.map);
    }
  }

  function applyIotRowsFromParent(rows) {
    appState.rowsSource = "parent";

    console.log("[MAP] iot rows from parent", rows?.length || 0);

    setRows(rows || []);
    render();
  }

  function bindParentMessages() {
    window.addEventListener("message", (event) => {
      const data = event.data;

      if (!data || typeof data !== "object") {
        return;
      }

      switch (data.type) {
        case "MAP_SET_DIVISIONS": {
          applyDivisionRowsFromParent(data.rows || []);
          break;
        }

        case "MAP_SET_DEVICES": {
          applyDeviceRowsFromParent(data.rows || []);
          break;
        }

        case "MAP_SET_IOT_ROWS": {
          applyIotRowsFromParent(data.rows || []);
          break;
        }

        case "MAP_SET_ALL": {
          if (Array.isArray(data.divisions)) {
            applyDivisionRowsFromParent(data.divisions);
          }

          if (Array.isArray(data.devices)) {
            applyDeviceRowsFromParent(data.devices);
          }

          if (Array.isArray(data.rows)) {
            applyIotRowsFromParent(data.rows);
          }

          break;
        }

        default:
          break;
      }
    });
  }

  // =========================================================
  // postMessage safe
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

      const autoGeoJSON = await tryAutoLoadDivisionGeoJSON();

      if (
        autoGeoJSON &&
        appState.divisionSource !== "parent"
      ) {
        appState.divisionSource = "auto-csv";
        setDivisionGeoJSON(autoGeoJSON);
      }

      const autoDeviceData = await tryAutoLoadDeviceData();

      if (
        autoDeviceData &&
        autoDeviceData.length > 0 &&
        appState.deviceSource !== "parent"
      ) {
        appState.deviceSource = "auto-csv";
        rawDeviceData = autoDeviceData;
      }

      // custom layerは一度だけ追加
      addBabylonLayerOnce(map);

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

        appState.divisionSource = "file-csv";

        if (!appState.map) {
          console.warn("[MAP] map is not ready yet");
          setDivisionGeoJSON(geojson);
          return;
        }

        if (!appState.mapLoaded) {
          console.warn("[MAP] map style is not loaded yet");
          setDivisionGeoJSON(geojson);
          return;
        }

        setDivisionGeoJSON(geojson);

        // layer全体は消さず、Divisionだけ差分更新
        if (ensureBabylonSceneReady()) {
          rebuildDivisionMeshes();
        } else {
          addBabylonLayerOnce(appState.map);
        }

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

        appState.deviceSource = "file-csv";
        rawDeviceData = devices;

        if (!appState.map) {
          console.warn("[MAP] map is not ready yet");
          return;
        }

        if (!appState.mapLoaded) {
          console.warn("[MAP] map style is not loaded yet");
          return;
        }

        // layer全体は消さず、Deviceだけ差分更新
        if (ensureBabylonSceneReady()) {
          rebuildDeviceMeshes();
        } else {
          addBabylonLayerOnce(appState.map);
        }

      } catch (err) {
        console.error("[MAP] failed to load selected device csv", err);
      }
    });
  }

  // =========================================================
  // Tooltip
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

        if (hit.type === "Temp" || hit.type === "TemperatureSensor") {
          const temp =
            Number.isFinite(latest?.temp)
              ? latest.temp
              : hit.fallbackTemp;

          if (temp != null && Number.isFinite(Number(temp))) {
            text = `${hit.label}\n${Number(temp)}℃`;
          }
        }

        if (
          hit.type === "Aircon" ||
          hit.type === "AC" ||
          hit.type === "AirConditioner"
        ) {
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
    // - 温度に応じてDeviceモデル色を変える
    // - Division色をIoT rowsで更新する
    // - Aircon稼働状態をモデルに反映する
    // 場合は、babylonRuntime.scene 内の対象Meshだけ更新する。
  }

  // =========================================================
  // Init
  // =========================================================
  function init() {
    bindCsvInput();
    bindDeviceCsvInput();

    // Amplify / Next.js iframe埋め込み用
    bindParentMessages();

    initMap();

    // 既存adapterも維持
    adapter.init();
    adapter.applyUiLock();
  }

  init();

})();
