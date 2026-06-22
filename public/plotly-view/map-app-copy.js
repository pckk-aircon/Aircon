(() => {
  "use strict";

  // =========================================================
  // Guard
  // =========================================================
  if (typeof maplibregl === "undefined") {
    throw new Error("maplibregl が読み込まれていません");
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
    // map-index.html 側に <input id="divisionCsvInput" type="file" accept=".csv" />
    // がある想定
    divisionCsvInput:
      document.getElementById("divisionCsvInput") ||
      document.getElementById("fileInput")
  };

  // =========================================================
  // State
  // =========================================================
  const appState = {
    rows: [],
    latest: new Map(),
    map: null,
    mapLoaded: false,
    divisionGeoJSON: null
  };

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
  // CSV rows → GeoJSON
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

          // 暫定固定値
          // 後でCSVに Height 列を追加すれば可変化できます
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
  // FileReader
  // =========================================================
  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(String(reader.result || ""));
      };

      reader.onerror = () => {
        reject(reader.error);
      };

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
  // Division直方体レイヤー追加/更新
  // =========================================================
  function addDivisionExtrusionLayer(map, geojson) {
    if (!map) return;

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.warn("[MAP] Division GeoJSON が空です");
      return;
    }

    // 既存レイヤー削除
    if (map.getLayer("room-outline")) {
      map.removeLayer("room-outline");
    }

    if (map.getLayer("room-extrusion")) {
      map.removeLayer("room-extrusion");
    }

    // 既存source削除
    if (map.getSource("floorplan")) {
      map.removeSource("floorplan");
    }

    // source追加
    map.addSource("floorplan", {
      type: "geojson",
      data: geojson
    });

    // 直方体本体
    map.addLayer({
      id: "room-extrusion",
      type: "fill-extrusion",
      source: "floorplan",
      paint: {
        "fill-extrusion-color": "#66aaff",
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.3
      }
    });

    // 輪郭線
    map.addLayer({
      id: "room-outline",
      type: "line",
      source: "floorplan",
      paint: {
        "line-color": "#1f6feb",
        "line-width": 2
      }
    });

    appState.divisionGeoJSON = geojson;

    console.log("[MAP] Division extrusion layer added", geojson);
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
      style: "https://api.maptiler.com/maps/basic/style.json?key=dQ9hiCWEc6AANyaB1ziN",
      center: [140.303872, 35.353847],
      zoom: 18,
      pitch: 60,
      bearing: 0
    });

    map.addControl(new maplibregl.NavigationControl());

    appState.map = map;

    map.on("load", async () => {
      console.log("[MAP] loaded");

      appState.mapLoaded = true;

      // http(s)起動時のみ division.csv を自動読込
      // file:// ではスキップ
      const autoGeoJSON = await tryAutoLoadDivisionGeoJSON();

      if (autoGeoJSON) {
        addDivisionExtrusionLayer(map, autoGeoJSON);
      }

      postToParentSafe({
        type: "MAP_READY"
      });
    });

    bindTooltip(map);
  }

  // =========================================================
  // CSV input events
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

        addDivisionExtrusionLayer(appState.map, geojson);

      } catch (err) {
        console.error("[MAP] failed to load selected division csv", err);
      }
    });
  }

  // =========================================================
  // Tooltip（最小）
  // =========================================================
  const devices = [
    { name: "センサ１", lon: 140.30348, lat: 35.35404 },
    { name: "センサ２", lon: 140.30349, lat: 35.35395 }
  ];

  function bindTooltip(map) {
    if (!els.tooltip) return;

    map.on("mousemove", (e) => {
      let hit = null;
      let min = Infinity;

      for (const d of devices) {
        const p = map.project([d.lon, d.lat]);

        const dx = p.x - e.point.x;
        const dy = p.y - e.point.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 40 && dist < min) {
          hit = d;
          min = dist;
        }
      }

      if (hit) {
        const latest = appState.latest.get(hit.name);

        els.tooltip.style.display = "block";
        els.tooltip.style.left = e.originalEvent.clientX + 10 + "px";
        els.tooltip.style.top = e.originalEvent.clientY + 10 + "px";

        els.tooltip.innerText =
          latest
            ? `${hit.name}\n${latest.temp ?? "-"}℃`
            : hit.name;

      } else {
        els.tooltip.style.display = "none";
      }
    });
  }

  // =========================================================
  // Render
  // =========================================================
  function render() {
    // 今はtooltipとDivision直方体表示のみ
    // IoT rowsに応じて色や高さを変える場合はここでsource更新する
  }

  // =========================================================
  // Init
  // =========================================================
  function init() {
    bindCsvInput();
    initMap();
    adapter.init();
    adapter.applyUiLock();
  }

  init();

})();