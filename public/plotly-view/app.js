(() => {
  "use strict";

  // =========================================================
  // Guard
  // =========================================================
  if (typeof Plotly === "undefined") throw new Error("Plotly が読み込まれていません");
  if (typeof Papa === "undefined") {
    // embed では Papa が無くても動くが standalone で必要
    console.warn("PapaParse が見つかりません。standalone CSV読込は無効になります。");
  }

  // =========================================================
  // Boot / Mode
  // =========================================================
  function getMode() {
    const p = new URLSearchParams(location.search);
    return p.get("mode") || "standalone";
  }

  const MODE = getMode();
  const DEBUG = false;

  // =========================================================
  // DOM refs
  // =========================================================
  const els = {
    body: document.body,
    debug: document.getElementById("debug"),
    line: document.getElementById("line"),
    scatter: document.getElementById("scatter"),

    divisionSel: document.getElementById("divisionSel"),
    startDaySel: document.getElementById("startDaySel"),
    endDaySel: document.getElementById("endDaySel"),

    fileInput: document.getElementById("fileInput"),
    replotBtn: document.getElementById("replotBtn"),

    tsSel: document.getElementById("tsSel"),
    yLeft1Sel: document.getElementById("yLeft1Sel"),
    yLeft2Sel: document.getElementById("yLeft2Sel"),
    yRight1Sel: document.getElementById("yRight1Sel"),
    yRight2Sel: document.getElementById("yRight2Sel"),

    xModeSel: document.getElementById("xModeSel"),
    grainSel: document.getElementById("grainSel"),

    tpSetTempSel: document.getElementById("tpSetTempSel"),
    colorModeSel: document.getElementById("colorModeSel"),

    badgeTpSetTemp: document.getElementById("badgeTpSetTemp"),
    badgeColDiv: document.getElementById("badgeColDiv"),
    badgeColDevice: document.getElementById("badgeColDevice"),
    badgeColTs: document.getElementById("badgeColTs"),
  };

  // =========================================================
  // Debug
  // =========================================================
  function dbg(msg) {
    const s = String(msg);
    if (els.debug) els.debug.textContent += s + "\n";
    if (DEBUG) console.log(s);
  }

  function clearDbg() {
    if (els.debug) els.debug.textContent = "";
  }

  // =========================================================
  // Const
  // =========================================================
  const TS_ALLOW = ["DatetimeAgg", "DeviceDatetime", "DeviceTimestamp"];

  const DEFAULT_SELECTIONS = {
    iot: {
      left1: ["ActivePower", "ApparentPower"],
      left2: ["ActualTemp"],
      right1: ["CumulativeEnergy"],
      right2: ["ActualHumidity"],
    },
    agg: {
      left1: ["EnergyDelta"],
      left2: [],
      right1: ["WtTemp"],
      right2: [],
    },
  };

  const DISPLAY_NAME_MAP = {
    ActualTemp: "温度",
    ActualHumidity: "湿度",
    ActivePower: "有効電力",
    ApparentPower: "皮相電力",
    CumulativeEnergy: "積算電力量",
    DeviceDatetime: "日時",
    DatetimeAgg: "日時(集約)",
    DeviceTimestamp: "タイムスタンプ",
    EnergyDelta: "消費電力量増分",
    EnergyDeltaPerEffectiveMinute: "消費電力量増分（分単位補正）",
    WtTemp: "外気温",
    TpSetTempDivAvg: "設定温度（power行全空調）",
    TpSetTempAvgOn: "設定温度(On平均)",
  };

  const Y_EXCLUDE = [
    "DivisionAgg",
    "Division",
    "Device",
    "DeviceName",
    "DeviceType",
    "DatetimeAgg",
    "DeviceDatetime",
    "DeviceTimestamp",
  ];

  const CONFIG = {
    colDivisionPreferred: "DivisionAgg",
    colDivisionFallback: "Division",
    colDevicePreferred: "Device",
    colDeviceFallback: "DeviceName",
    colDeviceType: "DeviceType",
  };

  const POWER_ONLY_METRICS = ["WtTemp"];

  const SUM_METRICS_EXACT = ["EnergyDeltaPerEffectiveMinute"];
  const LAST_METRICS_EXACT = ["CumulativeEnergy"];

  const PALETTE = [
    "#1f77b4",
    "#2ca02c",
    "#ff7f0e",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#d62728",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
    "#aec7e8",
    "#ffbb78",
    "#98df8a",
    "#ff9896",
    "#c5b0d5",
    "#c49c94",
    "#f7b6d2",
    "#c7c7c7",
    "#dbdb8d",
    "#9edae5",
  ];

  // =========================================================
  // State
  // =========================================================
  const appState = {
    mode: MODE,

    sourceData: null,
    fields: [],
    currentDataKind: "iot",

    colDivision: null,
    colDevice: null,

    xMode: "A",
    grainMin: 0,

    tpSetTempOn: "ALL",
    colorMode: "day",

    dayColors: {},
    tempColors: {},
    traceColors: {},

    valueMap: null,
    lastLeft1: [],
    lastRight1: [],
    hlLeftIdx: null,
    hlRightIdx: null,

    pendingViewState: null,
    uiEventsBound: false,
  };

  function setAppState(patch) {
    Object.assign(appState, patch);
  }

  // =========================================================
  // Cache
  // sourceData 用の分割キャッシュ
  // =========================================================
  const cache = {
    sourceVersion: 0,

    // ts列ごとの利用可能day
    daysByTsCol: new Map(),

    // division一覧
    divisions: [],

    // 設定温度候補
    tpOptions: null,

    // view前処理
    // key = sourceVersion|division|start|end|dataKind|tsCol|tp
    viewPrep: new Map(),

    // metrics展開後
    // key = prepKey|left1|left2|right1|right2
    expandedRows: new Map(),

    // grain適用後
    // key = expandedKey|grain
    aggregatedRows: new Map(),
  };

  function resetAllCaches() {
    cache.sourceVersion += 1;
    cache.daysByTsCol.clear();
    cache.divisions = [];
    cache.tpOptions = null;
    cache.viewPrep.clear();
    cache.expandedRows.clear();
    cache.aggregatedRows.clear();
  }

  function clearRenderCachesOnly() {
    cache.viewPrep.clear();
    cache.expandedRows.clear();
    cache.aggregatedRows.clear();
  }

  // =========================================================
  // Helper
  // =========================================================
  const disp = (c) => DISPLAY_NAME_MAP[c] ?? c;

  function toNum(v) {
    if (v === null || v === undefined) return NaN;
    let s = String(v).trim();
    if (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "nan") return NaN;
    s = s.replace(/^'+/, "");
    s = s.replace(/^["']|["']$/g, "");
    s = s.replace(/[−ー―]/g, "-");
    s = s.replace(/,/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function pickColumn(fields, a, b) {
    if (fields.includes(a)) return a;
    if (fields.includes(b)) return b;
    return null;
  }

  // rows[0]対策
  function normalizeIncomingRowsAllKeys(rows) {
    if (!rows || rows.length === 0) return [];

    const allKeys = new Set();
    for (const r of rows) {
      if (r && typeof r === "object") {
        Object.keys(r).forEach((k) => allKeys.add(k));
      }
    }

    return rows.map((r, i) => {
      if (i !== 0 || !r || typeof r !== "object") return r;
      const copy = { ...r };
      for (const k of allKeys) {
        if (!(k in copy)) copy[k] = null;
      }
      return copy;
    });
  }

  function normalizeDt(ts) {
    let s = String(ts ?? "").trim();
    if (!s) return "";
    if (!s.includes("T") && s.includes(" ")) s = s.replace(" ", "T");
    return s;
  }

  function parseDateParts(ts) {
    const m = String(ts ?? "").match(/(\d{4}-\d{2}-\d{2}).*?(\d{2}):(\d{2})/);
    if (!m) return null;
    return { day: m[1], hh: m[2], mm: m[3] };
  }

  function getDayFromTs(ts) {
    const p = parseDateParts(ts);
    return p ? p.day : null;
  }

  function getTodHM(ts) {
    const m = String(ts ?? "").match(/(\d{2}):(\d{2})/);
    if (!m) return null;
    return `${m[1]}:${m[2]}`;
  }

  function inDayRange(day) {
    if (!day || !els.startDaySel || !els.endDaySel) return false;
    const s = els.startDaySel.value;
    const e = els.endDaySel.value;
    return s <= day && day <= e;
  }

  function getSelectedValues(sel) {
    if (!sel) return [];
    return Array.from(sel.selectedOptions)
      .map((o) => o.value)
      .filter((v) => v !== "");
  }

  function isMostlyNumericColumn(data, col, sampleN = 200) {
    let seen = 0;
    let ok = 0;

    for (const r of data || []) {
      const v = r[col];
      if (v === null || v === undefined || String(v).trim() === "") continue;
      seen++;
      if (Number.isFinite(toNum(v))) ok++;
      if (seen >= sampleN) break;
    }

    if (seen === 0) return true;
    return ok > 0;
  }

  function detectDataKindFromFields(fields) {
    if (fields.includes("DatetimeAgg") && fields.includes("DivisionAgg")) return "agg";
    if (fields.includes("DeviceDatetime") && fields.includes("Division")) return "iot";
    if (fields.includes("DatetimeAgg")) return "agg";
    if (fields.includes("DeviceDatetime")) return "iot";
    return "iot";
  }

  function pickDivisionColumn(fields, dataKind) {
    if (dataKind === "agg") {
      if (fields.includes("DivisionAgg")) return "DivisionAgg";
      if (fields.includes("Division")) return "Division";
      return null;
    }

    if (fields.includes("Division")) return "Division";
    if (fields.includes("DivisionAgg")) return "DivisionAgg";
    return null;
  }

  function pickDeviceColumn(fields) {
    if (fields.includes("Device")) return "Device";  // ←優先はコード
    if (fields.includes("DeviceName")) return "DeviceName";
   return null;
  }

  function pickTsColumnByDataKind(fields, dataKind) {
    if (dataKind === "agg") {
      if (fields.includes("DatetimeAgg")) return "DatetimeAgg";
      if (fields.includes("DeviceDatetime")) return "DeviceDatetime";
      if (fields.includes("DeviceTimestamp")) return "DeviceTimestamp";
      return "";
    }

    if (fields.includes("DeviceDatetime")) return "DeviceDatetime";
    if (fields.includes("DatetimeAgg")) return "DatetimeAgg";
    if (fields.includes("DeviceTimestamp")) return "DeviceTimestamp";
    return "";
  }

  function normalizeType(s) {
    return String(s ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_\-\/\.]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function isPowerType(raw) {
    const t = normalizeType(raw);
    const tokens = ["power", "pwr", "watt", "electric", "electricity", "電力", "消費電力", "電力量", "電力計"];
    return tokens.some((tok) => t.includes(tok));
  }

  function isAirconType(raw) {
    const t = normalizeType(raw);
    const tokens = ["aircon", "ac", "hvac", "空調", "エアコン", "冷暖房"];
    return tokens.some((tok) => t.includes(tok));
  }

  function buildColorMap(keys) {
    const m = {};
    (keys || []).forEach((k, i) => {
      m[k] = PALETTE[i % PALETTE.length];
    });
    return m;
  }

  function buildDayColors(days) {
    return buildColorMap((days || []).slice());
  }

  function buildTempColors(temps) {
    const labels = (temps || []).map((v) => `${v}℃`);
    return buildColorMap(labels);
  }

  function getTraceColor(key) {
    if (!appState.traceColors[key]) {
      const idx = Object.keys(appState.traceColors).length % PALETTE.length;
      appState.traceColors[key] = PALETTE[idx];
    }
    return appState.traceColors[key];
  }

  function buildTodCategoryArray(rows, stepMinOverride = null) {
    let step = stepMinOverride || 30;

    if (!stepMinOverride) {
      const mins = new Set();
      for (const r of rows || []) {
        const hm = getTodHM(r.tsRaw ?? r.dt);
        if (!hm) continue;
        mins.add(Number(hm.slice(3, 5)));
      }
      const ms = [...mins].sort((a, b) => a - b);

      const is30 = ms.length > 0 && ms.every((m) => m === 0 || m === 30);
      const is10 = ms.length > 0 && ms.every((m) => m % 10 === 0);
      const is5 = ms.length > 0 && ms.every((m) => m % 5 === 0);

      if (is30) step = 30;
      else if (is10) step = 10;
      else if (is5) step = 5;
      else step = 1;
    }

    const arr = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += step) {
        arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return arr;
  }

  function sortXY(xArr, yArr) {
    const pairs = xArr.map((x, i) => ({ x, y: yArr[i] }));
    pairs.sort((a, b) => (a.x > b.x ? 1 : a.x < b.x ? -1 : 0));
    return { x: pairs.map((p) => p.x), y: pairs.map((p) => p.y) };
  }

  // =========================================================
  // Aggregation
  // =========================================================
  function aggMode(metric) {
    const m = String(metric || "");
    if (SUM_METRICS_EXACT.includes(m)) return "sum";
    if (/energydelta/i.test(m)) return "sum";
    if (LAST_METRICS_EXACT.includes(m)) return "last";
    if (/cumulative/i.test(m)) return "last";
    return "mean";
  }

  function fmt2(n) {
    return String(n).padStart(2, "0");
  }

  function parseYMDHM(dtStr) {
    const m = String(dtStr ?? "").match(/(\d{4})-(\d{2})-(\d{2}).*?(\d{2}):(\d{2})/);
    if (!m) return null;
    return {
      y: +m[1],
      mo: +m[2],
      d: +m[3],
      hh: +m[4],
      mm: +m[5],
    };
  }

  function fmtBucketISO(y, mo, d, hh, mm) {
    return `${y}-${fmt2(mo)}-${fmt2(d)}T${fmt2(hh)}:${fmt2(mm)}:00`;
  }

  function floorToBucket(dtStr, grainMin) {
    const p = parseYMDHM(dtStr);
    if (!p) return null;

    const totalMin = p.hh * 60 + p.mm;
    const floored = Math.floor(totalMin / grainMin) * grainMin;

    const hh2 = Math.floor(floored / 60);
    const mm2 = floored % 60;

    return {
      day: `${p.y}-${fmt2(p.mo)}-${fmt2(p.d)}`,
      dtBucket: fmtBucketISO(p.y, p.mo, p.d, hh2, mm2),
    };
  }

  function aggregateRows(rows, grainMin) {
    if (!grainMin || grainMin <= 0) return rows || [];

    const g = new Map();
    for (const r of rows || []) {
      const b = floorToBucket(r.dt, grainMin);
      if (!b) continue;

      const key = `${r.dev}__${r.metric}__${b.dtBucket}`;
      if (!g.has(key)) {
        g.set(key, {
          dev: r.dev,
          metric: r.metric,
          day: b.day,
          dt: b.dtBucket,
          tsRaw: b.dtBucket,
          sum: 0,
          cnt: 0,
          lastVal: NaN,
          lastDt: "",
          tpLast: NaN,
        });
      }

      const o = g.get(key);
      const mode = aggMode(r.metric);

      if (Number.isFinite(r.tp)) o.tpLast = r.tp;

      if (mode === "sum" || mode === "mean") {
        o.sum += r.v;
        o.cnt += 1;
      } else if (mode === "last") {
        if (!o.lastDt || String(r.dt) >= o.lastDt) {
          o.lastDt = String(r.dt);
          o.lastVal = r.v;
        }
      }
    }

    const out = [];
    for (const o of g.values()) {
      const mode = aggMode(o.metric);
      let v = NaN;

      if (mode === "sum") v = o.sum;
      else if (mode === "mean") v = o.cnt ? o.sum / o.cnt : NaN;
      else if (mode === "last") v = o.lastVal;

      if (Number.isFinite(v)) {
        out.push({
          dev: o.dev,
          dt: o.dt,
          day: o.day,
          metric: o.metric,
          v,
          tsRaw: o.tsRaw,
          tp: o.tpLast,
        });
      }
    }

    return out;
  }

  // =========================================================
  // UI builders
  // =========================================================
  function buildDaySelectors(days) {
    if (!els.startDaySel || !els.endDaySel) return;
    const opts = days.map((d) => `<option value="${d}">${d}</option>`).join("");
    els.startDaySel.innerHTML = opts;
    els.endDaySel.innerHTML = opts;
    els.startDaySel.disabled = false;
    els.endDaySel.disabled = false;
    els.startDaySel.value = days[0] || "";
    els.endDaySel.value = days[days.length - 1] || "";
  }

  function buildDivisionSelector(divs) {
    if (!els.divisionSel) return;
    els.divisionSel.innerHTML = divs.map((d) => `<option value="${d}">${d}</option>`).join("");
  }

  function buildColumnSelectors(fields, data) {
    const tsCandidates = TS_ALLOW.filter((c) => fields.includes(c));
    const tsFinal = tsCandidates.length ? tsCandidates : fields.slice(0, 1);

    if (els.tsSel) {
      els.tsSel.innerHTML = tsFinal
        .map((c) => `<option value="${c}">${disp(c)}</option>`)
        .join("");
      els.tsSel.disabled = false;
      els.tsSel.value = pickTsColumnByDataKind(fields, appState.currentDataKind) || tsFinal[0] || "";
    }

    const FORCE_INCLUDE_METRICS = [
      "ActivePower",
      "ApparentPower",
      "CumulativeEnergy",
      "EnergyDeltaPerEffectiveMinute",
      "ActualTemp",
      "ActualHumidity",
      "WtTemp",
    ];

    let yCandidates = fields
      .filter((f) => !tsFinal.includes(f))
      .filter((f) => !Y_EXCLUDE.includes(f))
      .filter((f) => FORCE_INCLUDE_METRICS.includes(f) || isMostlyNumericColumn(data, f));

    if (yCandidates.length === 0) {
      yCandidates = fields.filter((f) => !tsFinal.includes(f));
    }

    function fill(sel, defaults) {
      if (!sel) return;
      sel.innerHTML = yCandidates.map((c) => `<option value="${c}">${disp(c)}</option>`).join("");
      sel.disabled = false;
      for (const opt of sel.options) {
        opt.selected = defaults.includes(opt.value);
      }
    }

    const defaults =
      appState.currentDataKind === "agg"
        ? DEFAULT_SELECTIONS.agg
        : DEFAULT_SELECTIONS.iot;

    fill(els.yLeft1Sel, defaults.left1);
    fill(els.yLeft2Sel, defaults.left2);
    fill(els.yRight1Sel, defaults.right1);
    fill(els.yRight2Sel, defaults.right2);
  }

  function getDaysForTsColumn(tsCol) {
    if (!tsCol) return [];
    const hit = cache.daysByTsCol.get(tsCol);
    if (hit) return hit;

    const days = [
      ...new Set((appState.sourceData || []).map((r) => getDayFromTs(r[tsCol])).filter(Boolean)),
    ].sort();

    cache.daysByTsCol.set(tsCol, days);
    return days;
  }

  function buildTpSetTempOptionsFromData(data) {
    if (!(appState.fields || []).includes("TpSetTempAvgOn")) return null;
    if (!(appState.fields || []).includes(CONFIG.colDeviceType)) return null;

    const set = new Set();
    for (const r of data || []) {
      if (!isAirconType(r[CONFIG.colDeviceType])) continue;
      const v = toNum(r.TpSetTempAvgOn);
      if (Number.isFinite(v)) set.add(v);
    }
    const arr = [...set].sort((a, b) => a - b);
    return arr.length ? arr : null;
  }

  function applyTpSetTempOptions(values) {
    if (!els.tpSetTempSel) return;

    const opts = [`<option value="ALL">すべてを表示</option>`].concat(
      values.map((v) => `<option value="${String(v)}">${String(v)}℃</option>`)
    );

    els.tpSetTempSel.innerHTML = opts.join("");

    const cur = String(appState.tpSetTempOn ?? "ALL");
    const has = cur === "ALL" || values.some((v) => String(v) === cur);
    appState.tpSetTempOn = has ? cur : "ALL";

    els.tpSetTempSel.value = String(appState.tpSetTempOn);
    syncTpBadge();
  }

  function syncTpBadge() {
    if (!els.badgeTpSetTemp || !els.tpSetTempSel) return;
    els.badgeTpSetTemp.textContent =
      els.tpSetTempSel.value === "ALL"
        ? "ALL（フィルタなし）"
        : `TpSetTempAvgOn=${els.tpSetTempSel.value}`;
  }

  function updateColumnBadges() {
    if (els.badgeColDiv) els.badgeColDiv.textContent = appState.colDivision || "-";
    if (els.badgeColDevice) els.badgeColDevice.textContent = appState.colDevice || "-";
    if (els.badgeColTs) els.badgeColTs.textContent = els.tsSel?.value || "-";
  }

  function enableControls() {
    if (els.divisionSel) els.divisionSel.disabled = false;
    if (els.startDaySel) els.startDaySel.disabled = false;
    if (els.endDaySel) els.endDaySel.disabled = false;
    if (els.replotBtn) els.replotBtn.disabled = false;
    if (els.xModeSel) els.xModeSel.disabled = false;
    if (els.grainSel) els.grainSel.disabled = false;
    if (els.tpSetTempSel) els.tpSetTempSel.disabled = false;
    if (els.colorModeSel) els.colorModeSel.disabled = false;
  }

  function rebuildUiFromSourceData() {
    if (!appState.sourceData || !appState.fields?.length) return;

    buildColumnSelectors(appState.fields, appState.sourceData);

    cache.divisions = [
      ...new Set((appState.sourceData || []).map((r) => r[appState.colDivision]).filter(Boolean)),
    ].sort();

    buildDivisionSelector(cache.divisions);

    const tsCol =
      els.tsSel?.value || pickTsColumnByDataKind(appState.fields, appState.currentDataKind);

    const days = getDaysForTsColumn(tsCol);
    if (days.length) buildDaySelectors(days);

    cache.tpOptions = buildTpSetTempOptionsFromData(appState.sourceData);
    if (cache.tpOptions) {
      applyTpSetTempOptions(cache.tpOptions);
    } else if (els.tpSetTempSel) {
      els.tpSetTempSel.value = "ALL";
      appState.tpSetTempOn = "ALL";
      syncTpBadge();
    }

    if (els.divisionSel && cache.divisions.length && !els.divisionSel.value) {
      els.divisionSel.value = cache.divisions[0];
    }

    applyPendingViewStateIfAny();
    updateColumnBadges();
    enableControls();
  }

  // =========================================================
  // View / Render caches
  // =========================================================
  function getCurrentViewPrepKey() {
    const division = String(els.divisionSel?.value || "");
    const startDay = String(els.startDaySel?.value || "");
    const endDay = String(els.endDaySel?.value || "");
    const dataKind = String(appState.currentDataKind || "iot");
    const colTs = String(
      els.tsSel?.value || pickTsColumnByDataKind(appState.fields, appState.currentDataKind) || ""
    );
    const tpSetTempOn = String(els.tpSetTempSel?.value || "ALL");

    return [
      cache.sourceVersion,
      division,
      startDay,
      endDay,
      dataKind,
      colTs,
      tpSetTempOn,
    ].join("|");
  }

  function buildViewPrep() {
    const selectedDivision = String(els.divisionSel?.value || "");
    const startDay = String(els.startDaySel?.value || "");
    const endDay = String(els.endDaySel?.value || "");
    const colTs =
      els.tsSel?.value || pickTsColumnByDataKind(appState.fields, appState.currentDataKind);
    const selectedTp = String(els.tpSetTempSel?.value || "ALL");

    const prepKey = getCurrentViewPrepKey();
    const hit = cache.viewPrep.get(prepKey);
    if (hit) return hit;

    const hasDatetimeAgg = (appState.fields || []).includes("DatetimeAgg");
    const tsAggCol = hasDatetimeAgg ? "DatetimeAgg" : colTs;
    const hasSetTemp = (appState.fields || []).includes("TpSetTempAvgOn");

    const candidateRows = [];
    const dtCounts = hasSetTemp ? new Map() : null;
    const allowedDtSet = selectedTp !== "ALL" && hasSetTemp ? new Set() : null;
    const targetTp = selectedTp === "ALL" ? NaN : Number(selectedTp);

    for (const r of appState.sourceData || []) {
      if (selectedDivision && r[appState.colDivision] !== selectedDivision) continue;

      const dev =
        r.DeviceName && String(r.DeviceName).trim() !== ""
          ? r.DeviceName
          : r.Device;

      if (!dev) continue;

      const dtAggRaw = hasDatetimeAgg ? r.DatetimeAgg : null;
      const tsRawForPlot = dtAggRaw ?? r[colTs];
      if (!tsRawForPlot) continue;

      const day = getDayFromTs(tsRawForPlot);
      if (!day || day < startDay || day > endDay) continue;

      const dt = normalizeDt(tsRawForPlot);
      const dtypeRaw = r[CONFIG.colDeviceType];

      candidateRows.push({
        dev,
        dt,
        day,
        tsRaw: tsRawForPlot,
        dtypeRaw,
        raw: r,
      });

      if (hasSetTemp && tsAggCol && isAirconType(r[CONFIG.colDeviceType])) {
        const tsRawAgg = r[tsAggCol];
        if (tsRawAgg) {
          const dtAgg = normalizeDt(tsRawAgg);
          const tp = toNum(r.TpSetTempAvgOn);

          if (Number.isFinite(tp)) {
            if (!dtCounts.has(dtAgg)) dtCounts.set(dtAgg, new Map());
            const mp = dtCounts.get(dtAgg);
            mp.set(tp, (mp.get(tp) || 0) + 1);

            if (allowedDtSet && Number.isFinite(targetTp) && Math.abs(tp - targetTp) < 1e-9) {
              allowedDtSet.add(dtAgg);
            }
          }
        }
      }
    }

    const airconTempMap = new Map();
    if (dtCounts) {
      for (const [dt, mp] of dtCounts.entries()) {
        let bestTp = null;
        let bestCnt = -1;
        const temps = [...mp.keys()].sort((a, b) => a - b);
        for (const t of temps) {
          const c = mp.get(t);
          if (c > bestCnt) {
            bestCnt = c;
            bestTp = t;
          }
        }
        if (bestTp != null) airconTempMap.set(dt, bestTp);
      }
    }

    const baseRecords = [];
    for (const c of candidateRows) {
      if (allowedDtSet && !allowedDtSet.has(c.dt)) continue;

      baseRecords.push({
        dev: c.dev,
        dt: c.dt,
        day: c.day,
        tsRaw: c.tsRaw,
        dtypeRaw: c.dtypeRaw,
        tp: airconTempMap.has(c.dt) ? airconTempMap.get(c.dt) : NaN,
        raw: c.raw,
      });
    }

    const result = {
      prepKey,
      baseRecords,
      colTs,
    };

    cache.viewPrep.set(prepKey, result);
    return result;
  }

  function buildExpandedRowsFromPrep(prep) {
    const left1 = getSelectedValues(els.yLeft1Sel);
    const left2 = getSelectedValues(els.yLeft2Sel);
    const right1 = getSelectedValues(els.yRight1Sel);
    const right2 = getSelectedValues(els.yRight2Sel);

    const expandedKey = [
      prep.prepKey,
      left1.join(","),
      left2.join(","),
      right1.join(","),
      right2.join(","),
    ].join("|");

    const hit = cache.expandedRows.get(expandedKey);
    if (hit) return hit;

    const allMetrics = [...left1, ...left2, ...right1, ...right2];
    if (allMetrics.length === 0) {
      const empty = {
        expandedKey,
        rows: [],
        left1,
        left2,
        right1,
        right2,
        colTs: prep.colTs,
      };
      cache.expandedRows.set(expandedKey, empty);
      return empty;
    }

    const out = [];

    for (const r of prep.baseRecords) {
      for (const metric of allMetrics) {
        if (POWER_ONLY_METRICS.includes(metric)) {
          if (!isPowerType(r.dtypeRaw)) continue;
        }

        const v = toNum(r.raw[metric]);
        if (!Number.isFinite(v)) continue;

        out.push({
          dev: r.dev,
          dt: r.dt,
          day: r.day,
          metric,
          v,
          tsRaw: r.tsRaw,
          tp: r.tp,
        });
      }
    }

    const result = {
      expandedKey,
      rows: out,
      left1,
      left2,
      right1,
      right2,
      colTs: prep.colTs,
    };

    cache.expandedRows.set(expandedKey, result);
    return result;
  }

  function getAggregatedRows(expanded) {
    const grainMin = Number(appState.grainMin || 0);
    const aggKey = `${expanded.expandedKey}|grain:${grainMin}`;

    const hit = cache.aggregatedRows.get(aggKey);
    if (hit) return hit;

    const rows = aggregateRows(expanded.rows, grainMin);

    const result = {
      aggKey,
      rows,
    };

    cache.aggregatedRows.set(aggKey, result);
    return result;
  }

  // =========================================================
  // Plot helpers
  // =========================================================
  function calcRanges(traces) {
    const range = { y: null, y2: null, y3: null, y4: null };

    function upd(key, arr) {
      const nums = (arr || []).filter((v) => Number.isFinite(v));
      if (!nums.length) return;
      const mn = Math.min(...nums);
      const mx = Math.max(...nums);

      if (!range[key]) range[key] = { mn, mx };
      else {
        range[key].mn = Math.min(range[key].mn, mn);
        range[key].mx = Math.max(range[key].mx, mx);
      }
    }

    for (const t of traces || []) {
      upd(t.yaxis || "y", t.y || []);
    }

    function pad(r) {
      if (!r) return null;
      const span = r.mx - r.mn;
      const p = span === 0 ? Math.max(Math.abs(r.mx), 1) * 0.05 : span * 0.05;
      return [r.mn - p, r.mx + p];
    }

    return {
      y: pad(range.y),
      y2: pad(range.y2),
      y3: pad(range.y3),
      y4: pad(range.y4),
    };
  }

  // =========================================================
  // Render: line
  // =========================================================
  function renderLine(rows, left1, left2, right1, right2, colTs) {
    if (!els.line) return;

    const xMode = appState.xMode;
    const byKey = new Map();

    for (const r of rows || []) {
      const key = `${r.day}__${r.dev}__${r.metric}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          x: [],
          y: [],
          dev: r.dev,
          metric: r.metric,
          day: r.day,
        });
      }

      const t = byKey.get(key);

      if (xMode === "A") {
        t.x.push(r.dt);
      } else {
        const hm = getTodHM(r.tsRaw ?? r.dt);
        if (!hm) continue;
        t.x.push(hm);
      }

      t.y.push(r.v);
    }

    const traces = [];
    for (const t of byKey.values()) {
      let yaxis = "y";
      if (left2.includes(t.metric)) yaxis = "y3";
      if (right1.includes(t.metric)) yaxis = "y2";
      if (right2.includes(t.metric)) yaxis = "y4";

      const sorted = sortXY(t.x, t.y);
      const name = `${t.day} ${t.dev}-${disp(t.metric)}`;
      const colorKey = `${t.day}__${t.dev}__${t.metric}`;
      const c = getTraceColor(colorKey);

      traces.push({
        type: "scatter",
        mode: "lines",
        name,
        legendgroup: t.day,
        x: sorted.x,
        y: sorted.y,
        yaxis,
        line: { color: c },
      });
    }

    appState.hlLeftIdx = traces.length;
    traces.push({
      type: "scatter",
      mode: "markers",
      name: "_hover_left1",
      x: [],
      y: [],
      yaxis: "y",
      marker: { size: 14, color: "crimson" },
      showlegend: false,
      hoverinfo: "skip",
    });

    appState.hlRightIdx = null;
    if (right1.length) {
      appState.hlRightIdx = traces.length;
      traces.push({
        type: "scatter",
        mode: "markers",
        name: "_hover_right1",
        x: [],
        y: [],
        yaxis: "y2",
        marker: { size: 14, color: "crimson" },
        showlegend: false,
        hoverinfo: "skip",
      });
    }

    const ranges = calcRanges(traces);

    const layout = {
      uirevision: "keep-ui",
      margin: { r: 320, l: 80 },
      legend: { x: 1.02, y: 1 },
    };

    if (xMode === "A") {
      layout.xaxis = {
        type: "date",
        title: disp(colTs),
      };
    } else {
      const cat = buildTodCategoryArray(rows, appState.grainMin);
      const stepLabel =
        appState.grainMin && appState.grainMin > 0
          ? `${appState.grainMin}分刻み`
          : "データ刻み（自動）";

      layout.xaxis = {
        type: "category",
        title: `時刻帯（00–23重ね / ${stepLabel}）`,
        categoryorder: "array",
        categoryarray: cat,
      };
    }

    layout.yaxis = {
      title: `Left1: ${left1.map(disp).join(", ")}`,
      autorange: false,
      range: ranges.y,
    };

    if (left2.length) {
      layout.yaxis3 = {
        title: `Left2: ${left2.map(disp).join(", ")}`,
        overlaying: "y",
        side: "left",
        position: 0.05,
        autorange: false,
        range: ranges.y3,
      };
    }

    if (right1.length) {
      layout.yaxis2 = {
        title: `Right1: ${right1.map(disp).join(", ")}`,
        overlaying: "y",
        side: "right",
        autorange: false,
        range: ranges.y2,
      };
    }

    if (right2.length) {
      layout.yaxis4 = {
        title: `Right2: ${right2.map(disp).join(", ")}`,
        overlaying: "y",
        side: "right",
        position: 0.95,
        autorange: false,
        range: ranges.y4,
      };
    }

    Plotly.react(els.line, traces, layout, { responsive: true });
  }

  // =========================================================
  // Render: scatter
  // =========================================================
  function buildScatterTraces(rows, yMetric, xMetric) {
    const byKey = new Map();

    for (const r of rows || []) {
      const key = `${r.dev}__${r.dt}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          dev: r.dev,
          dt: r.dt,
          day: r.day,
          tsRaw: r.tsRaw,
          tp: r.tp,
        });
      }
      const obj = byKey.get(key);
      obj[r.metric] = r.v;
      if (Number.isFinite(r.tp)) obj.tp = r.tp;
    }

    const byGroup = new Map();

    for (const obj of byKey.values()) {
      const xv = obj[xMetric];
      const yv = obj[yMetric];
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;

      let groupKey = "unknown";
      if (appState.colorMode === "day") {
        groupKey = obj.day || "unknown-day";
      } else {
        groupKey = Number.isFinite(obj.tp) ? `${obj.tp}℃` : "unknown-temp";
      }

      if (!byGroup.has(groupKey)) {
        byGroup.set(groupKey, { x: [], y: [], customdata: [] });
      }

      const xPlot =
        appState.xMode === "A"
          ? obj.dt
          : getTodHM(obj.tsRaw ?? obj.dt) ?? obj.dt;

      byGroup.get(groupKey).x.push(xv);
      byGroup.get(groupKey).y.push(yv);
      byGroup.get(groupKey).customdata.push({
        dev: obj.dev,
        dt: obj.dt,
        xPlot,
        day: obj.day,
        tp: obj.tp,
      });
    }

    const keys = [...byGroup.keys()].sort();
    return keys.map((k) => {
      const color =
        appState.colorMode === "day"
          ? appState.dayColors?.[k] || "#1f77b4"
          : appState.tempColors?.[k] || "#1f77b4";

      return {
        type: "scatter",
        mode: "markers",
        name: k,
        legendgroup: k,
        x: byGroup.get(k).x,
        y: byGroup.get(k).y,
        customdata: byGroup.get(k).customdata,
        marker: { size: 7, color, opacity: 0.85 },
        hovertemplate:
          `group=${k}<br>` +
          `day=%{customdata.day}<br>` +
          `tp=%{customdata.tp}℃<br>` +
          `dev=%{customdata.dev}<br>` +
          `dt=%{customdata.dt}<br>` +
          `X(${disp(xMetric)})=%{x}<br>` +
          `Y(${disp(yMetric)})=%{y}<extra></extra>`,
      };
    });
  }

  function renderScatter(rows, left1, right1) {
    if (!els.scatter) return;

    if (!left1.length || !right1.length) {
      Plotly.react(
        els.scatter,
        [],
        {
          margin: { l: 60, r: 20, t: 30, b: 60 },
          xaxis: { title: "Right1（未選択）" },
          yaxis: { title: "Left1（未選択）" },
          annotations: [
            {
              text: "散布図は Left1 と Right1 をそれぞれ1つ以上選択すると表示されます",
              x: 0.5,
              y: 0.5,
              xref: "paper",
              yref: "paper",
              showarrow: false,
            },
          ],
        },
        { responsive: true }
      );
      return;
    }

    const yMetric = left1[0];
    const xMetric = right1[0];
    const traces = buildScatterTraces(rows, yMetric, xMetric);

    const layout = {
      margin: { l: 60, r: 180, t: 30, b: 40 },
      xaxis: { title: `Right1: ${disp(xMetric)}` },
      yaxis: { title: `Left1: ${disp(yMetric)}` },
      hovermode: "closest",
      legend: {
        orientation: "v",
        x: 1.02,
        y: 1,
        xanchor: "left",
        yanchor: "top",
      },
    };

    Plotly.react(els.scatter, traces, layout, { responsive: true });
  }

  // =========================================================
  // Scatter -> line highlight
  // =========================================================
  function clearLineHighlight() {
    if (appState.hlLeftIdx != null && els.line) {
      Plotly.restyle(els.line, { x: [[]], y: [[]] }, [appState.hlLeftIdx]);
    }
    if (appState.hlRightIdx != null && els.line) {
      Plotly.restyle(els.line, { x: [[]], y: [[]] }, [appState.hlRightIdx]);
    }
  }

  function setLineHighlight(xPlot, yLeft, yRight) {
    if (appState.hlLeftIdx != null && Number.isFinite(yLeft) && els.line) {
      Plotly.restyle(els.line, { x: [[xPlot]], y: [[yLeft]] }, [appState.hlLeftIdx]);
    }
    if (appState.hlRightIdx != null && Number.isFinite(yRight) && els.line) {
      Plotly.restyle(els.line, { x: [[xPlot]], y: [[yRight]] }, [appState.hlRightIdx]);
    }
  }

  function bindScatterToLineHover() {
    if (!els.scatter || !els.line) return;

    if (typeof els.scatter.removeAllListeners === "function") {
      els.scatter.removeAllListeners("plotly_hover");
      els.scatter.removeAllListeners("plotly_unhover");
    }

    els.scatter.on("plotly_hover", (ev) => {
      const cd = ev?.points?.[0]?.customdata;
      if (!cd) return;

      const left1 = appState.lastLeft1 || [];
      const right1 = appState.lastRight1 || [];
      if (!left1.length || !right1.length) return;

      const yMetric = left1[0];
      const xMetric = right1[0];

      const yLeft = appState.valueMap?.get(`${cd.dev}__${cd.dt}__${yMetric}`);
      const yRight = appState.valueMap?.get(`${cd.dev}__${cd.dt}__${xMetric}`);

      setLineHighlight(cd.xPlot, yLeft, yRight);
    });

    els.scatter.on("plotly_unhover", () => clearLineHighlight());
  }

  // =========================================================
  // Source data setup
  // =========================================================
  function setSourceData(rows, options = {}) {
    const normalized = normalizeIncomingRowsAllKeys(
      (rows || []).filter((r) => r && typeof r === "object")
    );

    if (!normalized.length) {
      setAppState({
        sourceData: [],
        fields: [],
      });
      return false;
    }

    const fields = Object.keys(normalized[0] || {});
    let dataKind = appState.currentDataKind;

    if (MODE !== "embed") {
      dataKind = detectDataKindFromFields(fields);
    } else {
      if (options.viewState?.dataKind) dataKind = options.viewState.dataKind;
      else if (appState.pendingViewState?.dataKind) dataKind = appState.pendingViewState.dataKind;
      else dataKind = detectDataKindFromFields(fields);
    }

    const colDivision = pickDivisionColumn(fields, dataKind);
    const colDevice = pickDeviceColumn(fields);

    if (!colDivision) throw new Error("Division列がありません（DivisionAgg / Division）");
    if (!colDevice) throw new Error("Device列がありません（Device / DeviceName）");

    setAppState({
      sourceData: normalized,
      fields,
      currentDataKind: dataKind,
      colDivision,
      colDevice,
    });

    resetAllCaches();

    return true;
  }

  function rebuildUiFromState() {
    if (!appState.sourceData || !appState.fields?.length) return;

    buildColumnSelectors(appState.fields, appState.sourceData);

    cache.divisions = [
      ...new Set(
        (appState.sourceData || []).map((r) => r[appState.colDivision]).filter(Boolean)
      ),
    ].sort();

    buildDivisionSelector(cache.divisions);

    const tsCol =
      els.tsSel?.value || pickTsColumnByDataKind(appState.fields, appState.currentDataKind);

    const days = getDaysForTsColumn(tsCol);
    if (days.length) {
      buildDaySelectors(days);
    }

    cache.tpOptions = buildTpSetTempOptionsFromData(appState.sourceData);
    if (cache.tpOptions) {
      applyTpSetTempOptions(cache.tpOptions);
    } else if (els.tpSetTempSel) {
      els.tpSetTempSel.value = "ALL";
      appState.tpSetTempOn = "ALL";
      syncTpBadge();
    }

    if (els.divisionSel && cache.divisions.length && !els.divisionSel.value) {
      els.divisionSel.value = cache.divisions[0];
    }

    updateColumnBadges();
    enableControls();
  }

  function syncViewStateToControls(viewState) {
    if (!viewState) return;
    if (!appState.sourceData) return;

    const divs = cache.divisions || [];

    const tsCol =
      els.tsSel?.value || pickTsColumnByDataKind(appState.fields, appState.currentDataKind);

    const days = getDaysForTsColumn(tsCol);

    if (els.divisionSel && viewState.division && divs.includes(viewState.division)) {
      els.divisionSel.value = viewState.division;
    }

    if (els.startDaySel && viewState.startDay && days.includes(viewState.startDay)) {
      els.startDaySel.value = viewState.startDay;
    }

    if (els.endDaySel && viewState.endDay && days.includes(viewState.endDay)) {
      els.endDaySel.value = viewState.endDay;
    }
  }

  function applyPendingViewStateIfAny() {
    if (!appState.pendingViewState) return;
    syncViewStateToControls(appState.pendingViewState);
  }

  function onRowsLoaded(rows, options = {}) {
    const ok = setSourceData(rows, options);
    if (!ok) return;

    rebuildUiFromState();
    applyPendingViewStateIfAny();
    adapter.applyUiLock();
    renderAll();
  }

  function onViewStateChanged(viewState) {
    setAppState({
      pendingViewState: {
        division: viewState?.division ?? null,
        startDay: viewState?.startDay ?? null,
        endDay: viewState?.endDay ?? null,
        dataKind: viewState?.dataKind ?? "iot",
      },
    });

    if (appState.pendingViewState?.dataKind) {
      appState.currentDataKind = appState.pendingViewState.dataKind;
    }

    // embedでは SET_VIEWSTATE では描画しない
    if (MODE === "embed") return;

    if (!appState.sourceData) return;

    appState.colDivision = pickDivisionColumn(appState.fields, appState.currentDataKind);
    appState.colDevice = pickDeviceColumn(appState.fields);

    if (!appState.colDivision) throw new Error("Division列がありません（DivisionAgg / Division）");
    if (!appState.colDevice) throw new Error("Device列がありません（Device / DeviceName）");

    rebuildUiFromState();
    syncViewStateToControls(appState.pendingViewState);
    adapter.applyUiLock();
    clearRenderCachesOnly();
    renderAll();
  }

  // =========================================================
  // Main render
  // =========================================================
  function renderAll() {
    if (!appState.sourceData) return;

    const prep = buildViewPrep();
    const expanded = buildExpandedRowsFromPrep(prep);
    const aggregated = getAggregatedRows(expanded);

    const rows = aggregated.rows;
    const { left1, left2, right1, right2, colTs } = expanded;

    if (els.badgeColTs) els.badgeColTs.textContent = colTs || "-";

    const daySet = new Set();
    const tempSet = new Set();
    const valueMap = new Map();

    for (const r of rows || []) {
      if (r.day) daySet.add(r.day);
      if (Number.isFinite(r.tp)) tempSet.add(Number(r.tp));
      valueMap.set(`${r.dev}__${r.dt}__${r.metric}`, r.v);
    }

    const daysInView = [...daySet].sort();
    const tempsInView = [...tempSet].sort((a, b) => a - b);

    setAppState({
      dayColors: buildDayColors(daysInView),
      tempColors: buildTempColors(tempsInView),
      lastLeft1: left1,
      lastRight1: right1,
      valueMap,
    });

    renderLine(rows, left1, left2, right1, right2, colTs);
    renderScatter(rows, left1, right1);
    bindScatterToLineHover();
  }

  // =========================================================
  // UI events
  // =========================================================
  function bindUiEventsOnce() {
    if (appState.uiEventsBound) return;
    appState.uiEventsBound = true;

    if (els.divisionSel) {
      els.divisionSel.addEventListener("change", () => {
        const nextDivision = els.divisionSel.value;

        // ★ 追加（これが最重要）
        if (MODE === "embed") {
          window.parent.postMessage(
            {
              type: "DIVISION_CHANGED",
              division: nextDivision,
            },
            window.location.origin
          );
          // ★ embedでは即描画しない
          return;
        }
        // standalone時だけ描画
        clearRenderCachesOnly();
        renderAll();
      });
    }


    if (els.startDaySel) {
      els.startDaySel.addEventListener("change", () => {
        clearRenderCachesOnly();
        renderAll();
      });
    }

    if (els.endDaySel) {
      els.endDaySel.addEventListener("change", () => {
        clearRenderCachesOnly();
        renderAll();
      });
    }

    if (els.tsSel) {
      els.tsSel.addEventListener("change", () => {
        const prevStart = els.startDaySel?.value || null;
        const prevEnd = els.endDaySel?.value || null;

        const tsCol = els.tsSel.value;
        const days = getDaysForTsColumn(tsCol);

        if (days.length) {
          buildDaySelectors(days);

          const vs = appState.pendingViewState;
          if (MODE === "embed" && vs) {
            if (vs.startDay && days.includes(vs.startDay)) {
              els.startDaySel.value = vs.startDay;
            } else if (prevStart && days.includes(prevStart)) {
              els.startDaySel.value = prevStart;
            }

            if (vs.endDay && days.includes(vs.endDay)) {
              els.endDaySel.value = vs.endDay;
            } else if (prevEnd && days.includes(prevEnd)) {
              els.endDaySel.value = prevEnd;
            }
          } else {
            if (prevStart && days.includes(prevStart)) els.startDaySel.value = prevStart;
            if (prevEnd && days.includes(prevEnd)) els.endDaySel.value = prevEnd;
          }
        }

        updateColumnBadges();
        clearRenderCachesOnly();
        renderAll();
      });
    }

    if (els.yLeft1Sel) {
      els.yLeft1Sel.addEventListener("change", () => {
        clearRenderCachesOnly();
        renderAll();
      });
    }
    if (els.yLeft2Sel) {
      els.yLeft2Sel.addEventListener("change", () => {
        clearRenderCachesOnly();
        renderAll();
      });
    }
    if (els.yRight1Sel) {
      els.yRight1Sel.addEventListener("change", () => {
        clearRenderCachesOnly();
        renderAll();
      });
    }
    if (els.yRight2Sel) {
      els.yRight2Sel.addEventListener("change", () => {
        clearRenderCachesOnly();
        renderAll();
      });
    }

    if (els.xModeSel) {
      els.xModeSel.addEventListener("change", () => {
        appState.xMode = els.xModeSel.value || "A";
        renderAll();
      });
    }

    if (els.grainSel) {
      els.grainSel.addEventListener("change", () => {
        appState.grainMin = Number(els.grainSel.value || 0);
        // grain変更時は aggregatedRows 以降だけ無効化すればよいが簡便にrender cacheだけ消す
        cache.aggregatedRows.clear();
        renderAll();
      });
    }

    if (els.tpSetTempSel) {
      els.tpSetTempSel.addEventListener("change", () => {
        appState.tpSetTempOn = String(els.tpSetTempSel.value || "ALL");
        syncTpBadge();
        clearRenderCachesOnly();
        renderAll();
      });
    }

    if (els.colorModeSel) {
      els.colorModeSel.addEventListener("change", () => {
        appState.colorMode = els.colorModeSel.value || "day";
        renderAll();
      });
    }

    if (els.replotBtn) {
      els.replotBtn.addEventListener("click", () => {
        clearRenderCachesOnly();
        renderAll();
      });
    }
  }

  // =========================================================
  // Adapter: standalone
  // =========================================================
  function createStandaloneAdapter() {
    return {
      init() {
        if (!els.fileInput || typeof Papa === "undefined") return;

        els.fileInput.addEventListener("change", () => {
          const file = els.fileInput.files && els.fileInput.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = () => {
            const csvText = reader.result;

            const parsed = Papa.parse(csvText, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (h) => String(h).trim(),
            });

            const data = parsed.data || [];
            onRowsLoaded(data, { label: `CSV:${file.name}` });
          };

          reader.readAsText(file, "utf-8");
        });
      },

      applyUiLock() {
        // standalone はロックなし
      },
    };
  }

  // =========================================================
  // Adapter: embed
  // =========================================================
  function createEmbedAdapter() {
    return {
      init() {
        window.parent.postMessage({ type: "PLOTLY_READY", version: "1" }, window.location.origin);

        window.addEventListener("message", (event) => {
          if (event.origin !== window.location.origin) return;

          const msg = event.data;
          if (!msg || !msg.type) return;

          if (msg.type === "SET_VIEWSTATE") {
            onViewStateChanged({
              division: msg.division ?? null,
              startDay: msg.startDay ?? null,
              endDay: msg.endDay ?? null,
              dataKind: msg.dataKind ?? "iot",
            });
          }

          if (msg.type === "SET_DATA") {
            const rows = (msg.rows || []).filter((r) => r && typeof r === "object");

            console.log("[RECV DATA]", rows.length);

            onRowsLoaded(rows, {
              label: "EMBED:rows",
              viewState: appState.pendingViewState,
            });
          }
        });
      },

      applyUiLock() {
        if (els.divisionSel) els.divisionSel.disabled = true;
        if (els.startDaySel) els.startDaySel.disabled = true;
        if (els.endDaySel) els.endDaySel.disabled = true;
      },
    };
  }

  function createAdapter(mode) {
    return mode === "embed" ? createEmbedAdapter() : createStandaloneAdapter();
  }

  // =========================================================
  // Init
  // =========================================================
  const adapter = createAdapter(MODE);

  function init() {
    if (MODE === "embed") {
      els.body?.classList.add("embed");
    }

    bindUiEventsOnce();
    adapter.init();
    adapter.applyUiLock();
  }

  init();
})();