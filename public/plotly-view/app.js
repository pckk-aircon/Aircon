(() => {
  "use strict";

  if (typeof Plotly === "undefined") throw new Error("Plotly missing");

  const MODE = new URLSearchParams(location.search).get("mode") || "standalone";

  const lineDiv = document.getElementById("line");
  const scatterDiv = document.getElementById("scatter");

  let sourceData = [];
  let fields = [];

  let colDivision = null;
  let colDevice = null;

  let pendingViewState = null;

  // =========================================================
  // 超軽量 util（Date禁止）
  // =========================================================

  function getDay(ts) {
    const m = String(ts).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }

  function getHM(ts) {
    const m = String(ts).match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : null;
  }

  function toNum(v) {
    const n = parseFloat(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }

  // =========================================================
  // rows生成（1パス）
  // =========================================================
  function buildRows(view) {
    const out = [];

    for (const r of sourceData) {
      if (view.division && r[colDivision] !== view.division) continue;

      const ts = r.DatetimeAgg || r.DeviceDatetime;
      if (!ts) continue;

      const day = getDay(ts);
      if (day < view.startDay || day > view.endDay) continue;

      const dev = r[colDevice];

      const ap = toNum(r.ActivePower);
      if (Number.isFinite(ap)) {
        out.push({
          dev,
          dt: ts,
          day,
          metric: "ActivePower",
          v: ap,
        });
      }
    }

    return out;
  }

  // =========================================================
  // 線グラフ（最小構成）
  // =========================================================
  function renderLine(rows) {
    const by = new Map();

    for (const r of rows) {
      const k = r.dev;
      if (!by.has(k)) by.set(k, { x: [], y: [] });
      by.get(k).x.push(r.dt);
      by.get(k).y.push(r.v);
    }

    const traces = [];

    for (const [k, v] of by.entries()) {
      traces.push({
        type: "scatter",
        mode: "lines",
        name: k,
        x: v.x,
        y: v.y,
      });
    }

    Plotly.react(lineDiv, traces, {
      margin: { l: 80, r: 20 },
    });
  }

  // =========================================================
  // 描画本体
  // =========================================================
  function renderAll() {
    if (!pendingViewState || !sourceData.length) return;

    const rows = buildRows(pendingViewState);

    renderLine(rows);
  }

  // =========================================================
  // Embed
  // =========================================================
  if (MODE === "embed") {
    window.parent.postMessage({ type: "PLOTLY_READY" }, window.location.origin);

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;

      const msg = event.data;

      if (msg.type === "SET_VIEWSTATE") {
        pendingViewState = msg;
        return; // 描画しない（重要）
      }

      if (msg.type === "SET_DATA") {
        sourceData = msg.rows || [];

        if (sourceData.length === 0) return;

        fields = Object.keys(sourceData[0]);

        colDivision = fields.includes("DivisionAgg") ? "DivisionAgg" : "Division";
        colDevice = fields.includes("Device") ? "Device" : "DeviceName";

        renderAll();
      }
    });
  }

})();