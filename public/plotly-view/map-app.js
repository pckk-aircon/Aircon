/* =========================================================
 * map-app.js
 *
 * 入力を2系統に対応:
 *  1. standalone mode:
 *     - CSVから Division / Device を読み込む
 *
 *  2. embed mode:
 *     - 親 page.tsx から postMessage で
 *       SET_MASTER / SET_VIEWSTATE / SET_DATA を受け取る
 *
 * page.tsx 側 iframe:
 *   src="/plotly-view/map-index.html?mode=embed"
 *
 * page.tsx -> map-app.js:
 *   { type: "SET_MASTER", divisions: [...], devices: [...] }
 *   { type: "SET_VIEWSTATE", division, startDay, endDay, dataKind }
 *   { type: "SET_DATA", rows: [...] }
 *
 * map-app.js -> page.tsx:
 *   { type: "MAP_READY" }
 *   { type: "DIVISION_CHANGED", division }
 * ========================================================= */

/* =========================================================
 * 起動モード判定
 * ========================================================= */


src="/plotly-view/map-index.html?mode=embed"

const params = new URLSearchParams(window.location.search);
const embedMode = params.get("mode") === "embed";

/* =========================================================
 * グローバル状態
 * ========================================================= */

let currentViewState = {
  division: "",
  startDay: "",
  endDay: "",
  dataKind: "iot",
};

let rawDivisionRows = [];
let rawDeviceRows = [];
let rawIotRows = [];

let divisionRows = [];
let deviceRows = [];
let iotRows = [];

let latestRowsByDevice = new Map();

let mapInitialized = false;
let map = null;

/**
 * 既存の map-app.js 側で使っていた変数名がある場合、
 * ここで互換用に window にも保持しておく。
 */
window.__divisionRows = divisionRows;
window.__deviceRows = deviceRows;
window.__iotRows = iotRows;
window.__latestRowsByDevice = latestRowsByDevice;

/* =========================================================
 * CSVファイルパス
 *
 * 必要に応じて田渕さんの既存パスに合わせて変更してください。
 * ========================================================= */

const CSV_PATHS = {
  divisions: "./Division.csv",
  devices: "./Device.csv",
};

/* =========================================================
 * 初期化
 * ========================================================= */

window.addEventListener("DOMContentLoaded", async () => {
  console.log("[map-app] DOMContentLoaded", {
    embedMode,
    href: window.location.href,
  });

  initMapIfNeeded();
  setupUiEvents();
  setupParentMessageListener();

  notifyReadyToParent();

  if (embedMode) {
    console.log("[map-app] embed mode: CSV loading skipped");
    showStatus("embed mode: parent data waiting...");
    return;
  }

  console.log("[map-app] standalone mode: CSV loading start");
  showStatus("standalone mode: loading CSV...");

  try {
    await loadStandaloneCsvData();
    showStatus("CSV loaded");
    refreshMap();
  } catch (err) {
    console.error("[map-app] CSV load error", err);
    showStatus(`CSV load error: ${getErrorMessage(err)}`);
  }
});

/* =========================================================
 * 親 page.tsx への READY 通知
 * ========================================================= */

function notifyReadyToParent() {
  if (!window.parent || window.parent === window) return;

  try {
    window.parent.postMessage(
      {
        type: "MAP_READY",
      },
      window.location.origin
    );

    console.log("[map-app] MAP_READY sent");
  } catch (err) {
    console.error("[map-app] MAP_READY send failed", err);
  }
}

/* =========================================================
 * 親 page.tsx からの postMessage 受信
 * ========================================================= */

function setupParentMessageListener() {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || typeof data !== "object") return;

    switch (data.type) {
      case "SET_MASTER": {
        handleSetMaster(data);
        break;
      }

      case "SET_VIEWSTATE": {
        handleSetViewState(data);
        break;
      }

      case "SET_DATA": {
        handleSetData(data);
        break;
      }

      default:
        break;
    }
  });
}

function handleSetMaster(data) {
  const divisions = Array.isArray(data.divisions) ? data.divisions : [];
  const devices = Array.isArray(data.devices) ? data.devices : [];

  console.log("[map-app] SET_MASTER received", {
    divisions: divisions.length,
    devices: devices.length,
  });

  rawDivisionRows = divisions;
  rawDeviceRows = devices;

  divisionRows = normalizeDivisionRows(rawDivisionRows);
  deviceRows = normalizeDeviceRows(rawDeviceRows);

  publishGlobals();

  rebuildMasterIndexes();
  refreshDivisionSelector();
  refreshMap();

  showStatus(
    `master received: divisions=${divisionRows.length}, devices=${deviceRows.length}`
  );
}

function handleSetViewState(data) {
  currentViewState = {
    division: String(data.division ?? "").trim(),
    startDay: String(data.startDay ?? "").trim(),
    endDay: String(data.endDay ?? "").trim(),
    dataKind: String(data.dataKind ?? "iot").trim() || "iot",
  };

  console.log("[map-app] SET_VIEWSTATE received", currentViewState);

  syncDivisionSelectorFromViewState();
  refreshMap();

  showStatus(
    `viewState: division=${currentViewState.division}, ${currentViewState.startDay} - ${currentViewState.endDay}, ${currentViewState.dataKind}`
  );
}

function handleSetData(data) {
  const rows = Array.isArray(data.rows) ? data.rows : [];

  console.log("[map-app] SET_DATA received", {
    rows: rows.length,
  });

  rawIotRows = rows;
  iotRows = normalizeIotRows(rawIotRows);

  latestRowsByDevice = buildLatestRowsByDevice(
    filterIotRowsByCurrentDivision(iotRows)
  );

  publishGlobals();

  refreshMap();

  showStatus(
    `data received: rows=${iotRows.length}, latestDevices=${latestRowsByDevice.size}`
  );
}

/* =========================================================
 * standalone CSV 読み込み
 * ========================================================= */

async function loadStandaloneCsvData() {
  const [divisionText, deviceText] = await Promise.all([
    fetchText(CSV_PATHS.divisions),
    fetchText(CSV_PATHS.devices),
  ]);

  rawDivisionRows = parseCsv(divisionText);
  rawDeviceRows = parseCsv(deviceText);

  divisionRows = normalizeDivisionRows(rawDivisionRows);
  deviceRows = normalizeDeviceRows(rawDeviceRows);

  rawIotRows = [];
  iotRows = [];
  latestRowsByDevice = new Map();

  publishGlobals();

  rebuildMasterIndexes();
  refreshDivisionSelector();

  console.log("[map-app] CSV loaded", {
    divisions: divisionRows.length,
    devices: deviceRows.length,
  });
}

async function fetchText(url) {
  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${url} fetch failed: ${res.status} ${res.statusText}`);
  }

  return await res.text();
}

/* =========================================================
 * CSV parser
 *
 * ダブルクォート・カンマ・改行を最低限考慮。
 * 既存で PapaParse 等を使っている場合は差し替えてOK。
 * ========================================================= */

function parseCsv(text) {
  if (!text || typeof text !== "string") return [];

  const rows = [];
  const table = [];

  let field = "";
  let row = [];
  let inQuotes = false;

  const s = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      table.push(row);
      row = [];
      field = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    field += ch;
  }

  row.push(field);
  table.push(row);

  const nonEmptyTable = table.filter((r) =>
    r.some((v) => String(v ?? "").trim() !== "")
  );

  if (nonEmptyTable.length === 0) return [];

  const headers = nonEmptyTable[0].map((h) => String(h ?? "").trim());

  for (let i = 1; i < nonEmptyTable.length; i++) {
    const values = nonEmptyTable[i];
    const obj = {};

    headers.forEach((h, index) => {
      if (!h) return;
      obj[h] = values[index] == null ? "" : String(values[index]).trim();
    });

    rows.push(obj);
  }

  return rows;
}

/* =========================================================
 * 正規化: Division
 * ========================================================= */

function normalizeDivisionRows(rows) {
  return rows
    .filter((row) => row && typeof row === "object")
    .map(normalizeDivisionRow)
    .filter((row) => row.Division);
}

function normalizeDivisionRow(row) {
  const division = pickString(row, [
    "Division",
    "division",
    "DivisionCode",
    "divisionCode",
    "Room",
    "room",
  ]);

  const divisionName =
    pickString(row, [
      "DivisionName",
      "divisionName",
      "Name",
      "name",
      "RoomName",
      "roomName",
    ]) || division;

  const polygonValue = pickFirst(row, [
    "DivisionPolygon",
    "divisionPolygon",
    "Polygon",
    "polygon",
    "Coordinates",
    "coordinates",
  ]);

  const polygon = normalizePolygon(polygonValue);

  return {
    ...row,

    Division: division,
    DivisionName: divisionName,

    /**
     * 既存コードが Polygon / DivisionPolygon のどちらを見ても動くように両方持つ。
     */
    DivisionPolygon: polygon,
    Polygon: polygon,

    Floor: pickString(row, ["Floor", "floor"]),
    Building: pickString(row, ["Building", "building"]),
  };
}

/* =========================================================
 * 正規化: Device
 * ========================================================= */

function normalizeDeviceRows(rows) {
  return rows
    .filter((row) => row && typeof row === "object")
    .map(normalizeDeviceRow)
    .filter((row) => row.Device);
}

function normalizeDeviceRow(row) {
  const device = pickString(row, [
    "Device",
    "device",
    "DeviceCode",
    "deviceCode",
    "DeviceId",
    "deviceId",
  ]);

  const deviceName =
    pickString(row, [
      "DeviceName",
      "deviceName",
      "Name",
      "name",
      "DisplayName",
      "displayName",
    ]) || device;

  const division = pickString(row, [
    "Division",
    "division",
    "DivisionAgg",
    "divisionAgg",
    "Room",
    "room",
  ]);

  const deviceType = pickString(row, [
    "DeviceType",
    "deviceType",
    "Type",
    "type",
  ]);

  const x = pickNumber(row, [
    "X",
    "x",
    "DeviceX",
    "deviceX",
    "PositionX",
    "positionX",
    "MapX",
    "mapX",
  ]);

  const y = pickNumber(row, [
    "Y",
    "y",
    "DeviceY",
    "deviceY",
    "PositionY",
    "positionY",
    "MapY",
    "mapY",
  ]);

  const lat = pickNumber(row, ["Lat", "lat", "Latitude", "latitude"]);
  const lng = pickNumber(row, [
    "Lng",
    "lng",
    "Lon",
    "lon",
    "Longitude",
    "longitude",
  ]);

  return {
    ...row,

    Device: device,
    DeviceName: deviceName,
    Division: division,
    DeviceType: deviceType,

    X: x,
    Y: y,
    Lat: lat,
    Lng: lng,
  };
}

/* =========================================================
 * 正規化: IoT rows
 * ========================================================= */

function normalizeIotRows(rows) {
  return rows
    .filter((row) => row && typeof row === "object")
    .map(normalizeIotRow);
}

function normalizeIotRow(row) {
  const device = pickString(row, [
    "Device",
    "device",
    "DeviceCode",
    "deviceCode",
    "DeviceName",
    "deviceName",
  ]);

  const deviceName =
    pickString(row, [
      "DeviceName",
      "deviceName",
      "Name",
      "name",
      "DisplayName",
      "displayName",
    ]) || device;

  const division = pickString(row, [
    "Division",
    "division",
    "DivisionAgg",
    "divisionAgg",
  ]);

  const divisionName =
    pickString(row, ["DivisionName", "divisionName"]) || division;

  const ts =
    normalizeDateTime(
      pickFirst(row, [
        "DeviceDatetime",
        "deviceDatetime",
        "DatetimeAgg",
        "datetimeAgg",
        "DeviceTimestamp",
        "deviceTimestamp",
        "Timestamp",
        "timestamp",
      ])
    ) || null;

  return {
    ...row,

    Device: device,
    DeviceName: deviceName,
    Division: division,
    DivisionAgg: pickString(row, ["DivisionAgg", "divisionAgg"]) || division,
    DivisionName: divisionName,

    DeviceDatetime: ts,
    DatetimeAgg: normalizeDateTime(pickFirst(row, ["DatetimeAgg"])) || ts,
    DeviceTimestamp:
      normalizeDateTime(pickFirst(row, ["DeviceTimestamp"])) || ts,

    ActualTemp: toNumberOrNull(pickFirst(row, ["ActualTemp", "actualTemp"])),
    ActualHumidity: toNumberOrNull(
      pickFirst(row, ["ActualHumidity", "actualHumidity"])
    ),
    ActivePower: toNumberOrNull(
      pickFirst(row, ["ActivePower", "activePower"])
    ),
    ApparentPower: toNumberOrNull(
      pickFirst(row, ["ApparentPower", "apparentPower"])
    ),
    CumulativeEnergy: toNumberOrNull(
      pickFirst(row, ["CumulativeEnergy", "cumulativeEnergy"])
    ),
    EnergyDeltaPerEffectiveMinute: toNumberOrNull(
      pickFirst(row, [
        "EnergyDeltaPerEffectiveMinute",
        "energyDeltaPerEffectiveMinute",
      ])
    ),
    WtTemp: toNumberOrNull(pickFirst(row, ["WtTemp", "wtTemp"])),
  };
}

/* =========================================================
 * 最新IoT値を Device ごとに抽出
 * ========================================================= */

function buildLatestRowsByDevice(rows) {
  const map = new Map();

  for (const row of rows) {
    const device = String(row.Device ?? "").trim();
    if (!device) continue;

    const ts = getRowTimestamp(row);
    const prev = map.get(device);

    if (!prev) {
      map.set(device, row);
      continue;
    }

    const prevTs = getRowTimestamp(prev);

    if (compareTimestamp(ts, prevTs) >= 0) {
      map.set(device, row);
    }
  }

  return map;
}

function filterIotRowsByCurrentDivision(rows) {
  const selectedDivision = String(currentViewState.division ?? "").trim();

  if (!selectedDivision) return rows;

  return rows.filter((row) => {
    const div = String(row.Division ?? "").trim();
    const divAgg = String(row.DivisionAgg ?? "").trim();

    return div === selectedDivision || divAgg === selectedDivision;
  });
}

function getRowTimestamp(row) {
  return (
    normalizeDateTime(row.DeviceDatetime) ||
    normalizeDateTime(row.DatetimeAgg) ||
    normalizeDateTime(row.DeviceTimestamp) ||
    ""
  );
}

function compareTimestamp(a, b) {
  const aa = String(a ?? "");
  const bb = String(b ?? "");

  if (aa === bb) return 0;
  if (!aa) return -1;
  if (!bb) return 1;

  return aa > bb ? 1 : -1;
}

/* =========================================================
 * Map 初期化
 *
 * ここは既存 map-app.js の初期化処理に合わせて調整してください。
 * maplibre-gl を使っている前提で、存在する場合だけ初期化します。
 * ========================================================= */

function initMapIfNeeded() {
  if (mapInitialized) return;
  mapInitialized = true;

  const container =
    document.getElementById("map") ||
    document.getElementById("maplibre-map") ||
    document.querySelector("[data-map-container]");

  if (!container) {
    console.warn(
      "[map-app] map container not found. Rendering functions will be skipped."
    );
    return;
  }

  if (!window.maplibregl) {
    console.warn(
      "[map-app] window.maplibregl not found. Please load maplibre-gl in map-index.html."
    );
    return;
  }

  try {
    map = new window.maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#f8fafc",
            },
          },
        ],
      },
      center: [0, 0],
      zoom: 1,
    });

    map.addControl(new window.maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      console.log("[map-app] map loaded");
      refreshMap();
    });
  } catch (err) {
    console.error("[map-app] map initialize error", err);
  }
}

/* =========================================================
 * UIイベント
 * ========================================================= */

function setupUiEvents() {
  const select =
    document.getElementById("divisionSelect") ||
    document.getElementById("division-select") ||
    document.querySelector("[data-division-select]");

  if (select) {
    select.addEventListener("change", () => {
      const division = String(select.value ?? "").trim();

      currentViewState = {
        ...currentViewState,
        division,
      };

      latestRowsByDevice = buildLatestRowsByDevice(
        filterIotRowsByCurrentDivision(iotRows)
      );

      publishGlobals();
      refreshMap();

      notifyDivisionChangedToParent(division);
    });
  }
}

function refreshDivisionSelector() {
  const select =
    document.getElementById("divisionSelect") ||
    document.getElementById("division-select") ||
    document.querySelector("[data-division-select]");

  if (!select) return;

  const currentValue = String(currentViewState.division ?? "").trim();

  select.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "全Division";
  select.appendChild(emptyOption);

  for (const d of divisionRows) {
    const option = document.createElement("option");
    option.value = d.Division;
    option.textContent = d.DivisionName || d.Division;
    select.appendChild(option);
  }

  select.value = currentValue;
}

function syncDivisionSelectorFromViewState() {
  const select =
    document.getElementById("divisionSelect") ||
    document.getElementById("division-select") ||
    document.querySelector("[data-division-select]");

  if (!select) return;

  select.value = String(currentViewState.division ?? "").trim();
}

function notifyDivisionChangedToParent(division) {
  if (!window.parent || window.parent === window) return;

  try {
    window.parent.postMessage(
      {
        type: "DIVISION_CHANGED",
        division,
      },
      window.location.origin
    );

    console.log("[map-app] DIVISION_CHANGED sent", division);
  } catch (err) {
    console.error("[map-app] DIVISION_CHANGED send failed", err);
  }
}

/* =========================================================
 * 描画更新
 *
 * 既存の描画関数がある場合は、この refreshMap 内から呼ぶ形にすると、
 * 入力がCSVでもAmplifyでも同じ描画経路になります。
 * ========================================================= */

function refreshMap() {
  latestRowsByDevice = buildLatestRowsByDevice(
    filterIotRowsByCurrentDivision(iotRows)
  );

  publishGlobals();

  console.log("[map-app] refreshMap", {
    divisions: divisionRows.length,
    devices: deviceRows.length,
    iotRows: iotRows.length,
    latestDevices: latestRowsByDevice.size,
    viewState: currentViewState,
  });

  renderSummary();
  renderDivisionListFallback();
  renderDeviceListFallback();

  /**
   * 既存 map-app.js に以下のような関数がある場合は自動で呼びます。
   * 既存名に合わせて必要ならここを変更してください。
   */
  callIfFunction("renderDivisions", divisionRows);
  callIfFunction("renderDevices", getVisibleDevicesWithLatestValues());
  callIfFunction("updateDeviceValuesOnMap", latestRowsByDevice);
  callIfFunction("renderMap", {
    divisions: divisionRows,
    devices: getVisibleDevicesWithLatestValues(),
    iotRows,
    latestRowsByDevice,
    viewState: currentViewState,
  });
  callIfFunction("updateMap", {
    divisions: divisionRows,
    devices: getVisibleDevicesWithLatestValues(),
    iotRows,
    latestRowsByDevice,
    viewState: currentViewState,
  });

  /**
   * このファイル自身でも最低限 MapLibre source/layer を更新します。
   * 既存描画がある場合は不要ですが、害が少ないように安全に実行しています。
   */
  updateMapLibreLayers();
}

function getVisibleDevicesWithLatestValues() {
  const selectedDivision = String(currentViewState.division ?? "").trim();

  return deviceRows
    .filter((device) => {
      if (!selectedDivision) return true;
      return String(device.Division ?? "").trim() === selectedDivision;
    })
    .map((device) => {
      const latest = latestRowsByDevice.get(device.Device);

      return {
        ...device,
        latest,
        ActualTemp: latest?.ActualTemp ?? null,
        ActualHumidity: latest?.ActualHumidity ?? null,
        ActivePower: latest?.ActivePower ?? null,
        ApparentPower: latest?.ApparentPower ?? null,
        CumulativeEnergy: latest?.CumulativeEnergy ?? null,
        WtTemp: latest?.WtTemp ?? null,
        DeviceDatetime:
          latest?.DeviceDatetime ??
          latest?.DatetimeAgg ??
          latest?.DeviceTimestamp ??
          null,
      };
    });
}

/* =========================================================
 * MapLibre 最低限描画
 *
 * 既存の Babylon.js / deck.gl / MapLibre 描画がある場合は
 * このブロックは使わなくてもOKです。
 * ========================================================= */

function updateMapLibreLayers() {
  if (!map) return;
  if (!map.loaded()) return;

  const divisionFeatureCollection = buildDivisionFeatureCollection();
  const deviceFeatureCollection = buildDeviceFeatureCollection();

  upsertGeoJsonSource("divisions-source", divisionFeatureCollection);
  upsertGeoJsonSource("devices-source", deviceFeatureCollection);

  if (!map.getLayer("divisions-fill")) {
    map.addLayer({
      id: "divisions-fill",
      type: "fill",
      source: "divisions-source",
      paint: {
        "fill-color": "#93c5fd",
        "fill-opacity": 0.25,
      },
    });
  }

  if (!map.getLayer("divisions-line")) {
    map.addLayer({
      id: "divisions-line",
      type: "line",
      source: "divisions-source",
      paint: {
        "line-color": "#2563eb",
        "line-width": 2,
      },
    });
  }

  if (!map.getLayer("devices-circle")) {
    map.addLayer({
      id: "devices-circle",
      type: "circle",
      source: "devices-source",
      paint: {
        "circle-radius": 6,
        "circle-color": "#ef4444",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }

  fitToAvailableFeatures(divisionFeatureCollection, deviceFeatureCollection);
}

function upsertGeoJsonSource(sourceId, data) {
  if (!map) return;

  const source = map.getSource(sourceId);

  if (source && typeof source.setData === "function") {
    source.setData(data);
    return;
  }

  map.addSource(sourceId, {
    type: "geojson",
    data,
  });
}

function buildDivisionFeatureCollection() {
  const features = [];

  for (const division of divisionRows) {
    const polygon = normalizePolygon(
      division.DivisionPolygon ?? division.Polygon
    );

    if (!polygon) continue;

    const coordinates = normalizePolygonToGeoJsonCoordinates(polygon);
    if (!coordinates) continue;

    features.push({
      type: "Feature",
      properties: {
        Division: division.Division,
        DivisionName: division.DivisionName,
      },
      geometry: {
        type: "Polygon",
        coordinates,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

function buildDeviceFeatureCollection() {
  const features = [];

  for (const device of getVisibleDevicesWithLatestValues()) {
    const point = getDevicePoint(device);
    if (!point) continue;

    features.push({
      type: "Feature",
      properties: {
        Device: device.Device,
        DeviceName: device.DeviceName,
        Division: device.Division,
        DeviceType: device.DeviceType,
        ActualTemp: device.ActualTemp,
        ActualHumidity: device.ActualHumidity,
        ActivePower: device.ActivePower,
        DeviceDatetime: device.DeviceDatetime,
      },
      geometry: {
        type: "Point",
        coordinates: point,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

function getDevicePoint(device) {
  const lng = toNumberOrNull(device.Lng);
  const lat = toNumberOrNull(device.Lat);

  if (lng != null && lat != null) {
    return [lng, lat];
  }

  const x = toNumberOrNull(device.X);
  const y = toNumberOrNull(device.Y);

  if (x != null && y != null) {
    return [x, y];
  }

  return null;
}

function fitToAvailableFeatures(...collections) {
  if (!map) return;

  const coords = [];

  for (const collection of collections) {
    for (const feature of collection.features ?? []) {
      collectCoordinates(feature.geometry, coords);
    }
  }

  if (coords.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of coords) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return;
  }

  if (minX === maxX && minY === maxY) {
    map.setCenter([minX, minY]);
    map.setZoom(16);
    return;
  }

  map.fitBounds(
    [
      [minX, minY],
      [maxX, maxY],
    ],
    {
      padding: 40,
      duration: 0,
    }
  );
}

function collectCoordinates(geometry, out) {
  if (!geometry) return;

  if (geometry.type === "Point") {
    out.push(geometry.coordinates);
    return;
  }

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates ?? []) {
      for (const coord of ring ?? []) {
        out.push(coord);
      }
    }
    return;
  }

  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates ?? []) {
      for (const ring of polygon ?? []) {
        for (const coord of ring ?? []) {
          out.push(coord);
        }
      }
    }
  }
}

/* =========================================================
 * fallback DOM 描画
 *
 * map-index.html に以下があれば表示されます:
 *   #status
 *   #summary
 *   #divisionList
 *   #deviceList
 * ========================================================= */

function showStatus(message) {
  const el =
    document.getElementById("status") ||
    document.getElementById("map-status") ||
    document.querySelector("[data-status]");

  if (el) {
    el.textContent = message;
  }

  console.log("[map-app status]", message);
}

function renderSummary() {
  const el =
    document.getElementById("summary") ||
    document.getElementById("map-summary") ||
    document.querySelector("[data-summary]");

  if (!el) return;

  el.textContent =
    `Division=${currentViewState.division || "ALL"} / ` +
    `divisions=${divisionRows.length} / ` +
    `devices=${deviceRows.length} / ` +
    `iotRows=${iotRows.length} / ` +
    `latestDevices=${latestRowsByDevice.size}`;
}

function renderDivisionListFallback() {
  const el =
    document.getElementById("divisionList") ||
    document.getElementById("division-list") ||
    document.querySelector("[data-division-list]");

  if (!el) return;

  el.innerHTML = "";

  const selectedDivision = String(currentViewState.division ?? "").trim();

  const visible = selectedDivision
    ? divisionRows.filter((d) => d.Division === selectedDivision)
    : divisionRows;

  for (const d of visible) {
    const item = document.createElement("div");
    item.textContent = `${d.DivisionName || d.Division} (${d.Division})`;
    item.style.padding = "4px 0";
    el.appendChild(item);
  }
}

function renderDeviceListFallback() {
  const el =
    document.getElementById("deviceList") ||
    document.getElementById("device-list") ||
    document.querySelector("[data-device-list]");

  if (!el) return;

  el.innerHTML = "";

  const devices = getVisibleDevicesWithLatestValues();

  for (const d of devices) {
    const item = document.createElement("div");

    const temp =
      d.ActualTemp == null || d.ActualTemp === ""
        ? "-"
        : `${Number(d.ActualTemp).toFixed(1)}℃`;

    const power =
      d.ActivePower == null || d.ActivePower === ""
        ? "-"
        : `${Number(d.ActivePower).toFixed(1)}`;

    item.textContent =
      `${d.DeviceName || d.Device} (${d.Device})` +
      ` / Division=${d.Division || "-"}` +
      ` / Temp=${temp}` +
      ` / ActivePower=${power}`;

    item.style.padding = "4px 0";
    el.appendChild(item);
  }
}

/* =========================================================
 * master index
 * ========================================================= */

let divisionByCode = new Map();
let deviceByCode = new Map();

function rebuildMasterIndexes() {
  divisionByCode = new Map();
  deviceByCode = new Map();

  for (const d of divisionRows) {
    if (d.Division) {
      divisionByCode.set(d.Division, d);
    }
  }

  for (const d of deviceRows) {
    if (d.Device) {
      deviceByCode.set(d.Device, d);
    }
  }

  window.__divisionByCode = divisionByCode;
  window.__deviceByCode = deviceByCode;
}

/* =========================================================
 * utility
 * ========================================================= */

function publishGlobals() {
  window.__currentViewState = currentViewState;
  window.__rawDivisionRows = rawDivisionRows;
  window.__rawDeviceRows = rawDeviceRows;
  window.__rawIotRows = rawIotRows;

  window.__divisionRows = divisionRows;
  window.__deviceRows = deviceRows;
  window.__iotRows = iotRows;
  window.__latestRowsByDevice = latestRowsByDevice;
}

function callIfFunction(name, ...args) {
  const fn = window[name];

  if (typeof fn !== "function") return;

  try {
    fn(...args);
  } catch (err) {
    console.error(`[map-app] ${name} failed`, err);
  }
}

function pickFirst(row, keys) {
  for (const key of keys) {
    if (row == null) continue;

    const value = row[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function pickString(row, keys) {
  const value = pickFirst(row, keys);
  if (value == null) return "";

  return String(value).trim();
}

function pickNumber(row, keys) {
  return toNumberOrNull(pickFirst(row, keys));
}

function toNumberOrNull(value) {
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const s = String(value)
    .trim()
    .replace(/^'+/, "")
    .replace(/^[\"']|[\"']$/g, "")
    .replace(/[−ー―]/g, "-")
    .replace(/,/g, "");

  if (!s) return null;

  const n = Number(s);

  return Number.isFinite(n) ? n : null;
}

function normalizeDateTime(value) {
  if (value == null) return null;

  let s = String(value).trim();
  if (!s) return null;

  if (s.includes(" ") && !s.includes("T")) {
    s = s.replace(" ", "T");
  }

  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) &&
    !/[zZ]$|[+\-]\d{2}:\d{2}$/.test(s)
  ) {
    s += "+09:00";
  }

  return s;
}

function normalizePolygon(value) {
  if (value == null || value === "") return null;

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object") {
    return value;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  return null;
}

function normalizePolygonToGeoJsonCoordinates(value) {
  const polygon = normalizePolygon(value);
  if (!polygon) return null;

  /**
   * GeoJSON Polygon:
   * [
   *   [
   *     [lng, lat],
   *     [lng, lat],
   *     ...
   *   ]
   * ]
   */
  if (
    Array.isArray(polygon) &&
    Array.isArray(polygon[0]) &&
    Array.isArray(polygon[0][0]) &&
    typeof polygon[0][0][0] !== "undefined"
  ) {
    return ensureClosedPolygonCoordinates(polygon);
  }

  /**
   * 単純な点配列:
   * [
   *   [x, y],
   *   [x, y],
   *   ...
   * ]
   */
  if (
    Array.isArray(polygon) &&
    Array.isArray(polygon[0]) &&
    typeof polygon[0][0] !== "undefined" &&
    typeof polygon[0][1] !== "undefined"
  ) {
    return ensureClosedPolygonCoordinates([polygon]);
  }

  /**
   * { coordinates: [...] } 形式
   */
  if (polygon && Array.isArray(polygon.coordinates)) {
    return normalizePolygonToGeoJsonCoordinates(polygon.coordinates);
  }

  /**
   * { points: [...] } 形式
   */
  if (polygon && Array.isArray(polygon.points)) {
    return normalizePolygonToGeoJsonCoordinates(polygon.points);
  }

  return null;
}

function ensureClosedPolygonCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return null;

  return coordinates.map((ring) => {
    const normalizedRing = ring
      .map((p) => {
        if (!Array.isArray(p)) return null;

        const x = toNumberOrNull(p[0]);
        const y = toNumberOrNull(p[1]);

        if (x == null || y == null) return null;

        return [x, y];
      })
      .filter(Boolean);

    if (normalizedRing.length === 0) return normalizedRing;

    const first = normalizedRing[0];
    const last = normalizedRing[normalizedRing.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
      normalizedRing.push([...first]);
    }

    return normalizedRing;
  });
}

function getErrorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

/* =========================================================
 * デバッグ用
 * ========================================================= */

window.mapAppDebug = {
  getState() {
    return {
      embedMode,
      currentViewState,
      rawDivisionRows,
      rawDeviceRows,
      rawIotRows,
      divisionRows,
      deviceRows,
      iotRows,
      latestRowsByDevice,
      divisionByCode,
      deviceByCode,
    };
  },

  refreshMap,

  setViewState(next) {
    currentViewState = {
      ...currentViewState,
      ...next,
    };

    refreshMap();
  },
};
