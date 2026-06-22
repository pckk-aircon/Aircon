(() => {
  "use strict";

  // =========================================================
  // DOM
  // =========================================================
  const els = {
    map: document.getElementById("map"),
    tooltip: document.getElementById("tooltip")
  };

  // =========================================================
  // State
  // =========================================================
  const appState = {
    rows: [],
    latest: new Map(),
    map: null
  };

  // =========================================================
  // Adapter（Plotlyと同じ）
  // =========================================================
  const adapter = window.createViewAdapter({

    onRowsLoaded: (rows) => {
      console.log("[MAP] RECV DATA", rows.length);
      setRows(rows);
      render();
    },

    onViewStateChanged: (viewState) => {
      console.log("[MAP] VIEWSTATE", viewState);
      // 今は特に何もしない（Plotlyと同期だけ）
    }

  });

  // =========================================================
  // データ処理（最小）
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
  // Map init
  // =========================================================
  function initMap() {

    const map = new maplibregl.Map({
      container: "map",
      style: "https://api.maptiler.com/maps/basic/style.json?key=dQ9hiCWEc6AANyaB1ziN",
      center: [140.303872, 35.353847],
      zoom: 18,
      pitch: 60
    });

    map.addControl(new maplibregl.NavigationControl());

    appState.map = map;

    map.on("load", () => {
      console.log("[MAP] loaded");

      window.parent.postMessage(
        { type: "MAP_READY" },
        window.location.origin
      );
    });

    bindTooltip(map);
  }

  // =========================================================
  // Tooltip（最小）
  // =========================================================
  const devices = [
    { name: "センサ１", lon: 140.30348, lat: 35.35404 },
    { name: "センサ２", lon: 140.30349, lat: 35.35395 }
  ];

  function bindTooltip(map) {

    map.on("mousemove", (e) => {

      let hit = null;
      let min = Infinity;

      for (const d of devices) {
        const p = map.project([d.lon, d.lat]);

        const dx = p.x - e.point.x;
        const dy = p.y - e.point.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

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
    // 今はtooltipだけなので再描画不要
  }

  // =========================================================
  // Init
  // =========================================================
  function init() {
    initMap();
    adapter.init();
    adapter.applyUiLock();
  }

  init();

})();
