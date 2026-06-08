(() => {
  const dbgEl = document.getElementById("debug");
  const dbg = (m) => {
    if (dbgEl) dbgEl.textContent += m + "\n";
    console.log(m);
  };
  const clearDbg = () => {
    if (dbgEl) dbgEl.textContent = "";
  };

  if (typeof Papa === "undefined") throw new Error("PapaParse が読み込まれていません");
  if (typeof Plotly === "undefined") throw new Error("Plotly が読み込まれていません");

  // =========================================================
  // mode 切替（standalone / embed）
  // =========================================================
  function getMode() {
    const p = new URLSearchParams(location.search);
    return p.get("mode") || "standalone";
  }
  const MODE = getMode();
  if (MODE === "embed") {
    document.body.classList.add("embed");
  }

  // embedのときに React 側の選択値を後から反映するためのバッファ
  let pendingViewState = null;

  // =========================================================
  // X列ホワイトリスト
  // =========================================================
  const TS_ALLOW = ["DatetimeAgg", "DeviceDatetime", "DeviceTimestamp"];

  // デフォルト選択
  const DEFAULT_LEFT1 = ["ActivePower", "ApparentPower", "EnergyDeltaPerEffectiveMinute"];
  const DEFAULT_LEFT2 = ["ActualTemp"];
  const DEFAULT_RIGHT1 = ["CumulativeEnergy", "WtTemp"];
  const DEFAULT_RIGHT2 = ["ActualHumidity"];

  // 表示名（ラベル）
  const DISPLAY_NAME_MAP = {
    ActualTemp: "温度",
    ActualHumidity: "湿度",
    ActivePower: "有効電力",
    ApparentPower: "皮相電力",
    CumulativeEnergy: "積算電力量",
    DeviceDatetime: "日時",
    DatetimeAgg: "日時(集約)",
    DeviceTimestamp: "タイムスタンプ",
    EnergyDeltaPerEffectiveMinute: "積算電力量（分単位補正）",
    WtTemp: "外気温",
    TpSetTempAvgOn: "設定温度(On平均)",
  };
  const disp = (c) => DISPLAY_NAME_MAP[c] ?? c;

  // Y候補から除外する列
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

  // 特定メトリクスは Power系(DeviceType)のみ描画
  const POWER_ONLY_METRICS = ["WtTemp"];

  // =========================================================
  // 粒度変更：バケット集計ルール
  // =========================================================
  const SUM_METRICS_EXACT = ["EnergyDeltaPerEffectiveMinute"];
  const LAST_METRICS_EXACT = ["CumulativeEnergy"];

  function aggMode(metric) {
    const m = String(metric || "");
    if (SUM_METRICS_EXACT.includes(m)) return "sum";
    if (/energydelta/i.test(m)) return "sum";
    if (LAST_METRICS_EXACT.includes(m)) return "last";
    if (/cumulative/i.test(m)) return "last";
    return "mean";
  }

  // ===== DOM =====
  const lineDiv = document.getElementById("line");
  const scatterDiv = document.getElementById("scatter");

  const divisionSel = document.getElementById("divisionSel");
  const startDaySel = document.getElementById("startDaySel");
  const endDaySel = document.getElementById("endDaySel");

  const fileInput = document.getElementById("fileInput");
  const replotBtn = document.getElementById("replotBtn");

  const tsSel = document.getElementById("tsSel");
  const yLeft1Sel = document.getElementById("yLeft1Sel");
  const yLeft2Sel = document.getElementById("yLeft2Sel");
  const yRight1Sel = document.getElementById("yRight1Sel");
  const yRight2Sel = document.getElementById("yRight2Sel");

  const xModeSel = document.getElementById("xModeSel");
  const grainSel = document.getElementById("grainSel");

  const tpSetTempSel = document.getElementById("tpSetTempSel");
  const colorModeSel = document.getElementById("colorModeSel");
  const badgeTpSetTemp = document.getElementById("badgeTpSetTemp");

  const badgeColDiv = document.getElementById("badgeColDiv");
  const badgeColDevice = document.getElementById("badgeColDevice");
  const badgeColTs = document.getElementById("badgeColTs");

  const appState = {
    sourceData: null,
    fields: null,
    colDivision: null,
    colDevice: null,
    days: [],
    xMode: "A",
    grainMin: 0,

    // ✅ 追加：iot / agg を保持
    currentDataKind: "iot",

    // Airconフィルタ："ALL" or 数値文字列（例 "26"）
    tpSetTempOn: "ALL",

    // 散布図色分け："day" or "temp"
    colorMode: "day",

    // 散布図の色マップ
    dayColors: {},
    tempColors: {},

    // 折れ線の色固定
    traceColors: {},

    // 散布図→折れ線ハイライト
    valueMap: null,
    lastLeft1: [],
    lastRight1: [],
    hlLeftIdx: null,
    hlRightIdx: null,
  };

  function applyEmbedUiLock() {
    if (MODE !== "embed") return;
    if (divisionSel) divisionSel.disabled = true;
    if (startDaySel) startDaySel.disabled = true;
    if (endDaySel) endDaySel.disabled = true;
  }

  // =========================================================
  // 共通ユーティリティ
  // =========================================================
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

  // =========================================================
  // ✅ dataKind ベースの列選択
  // =========================================================
  function detectDataKindFromFields(fields) {
    // standalone 用。CSVヘッダから推定
    if (fields.includes("DeviceDatetime") && fields.includes("Division")) return "iot";
    if (fields.includes("DatetimeAgg") && fields.includes("DivisionAgg")) return "agg";

    // fallback
    if (fields.includes("DeviceDatetime")) return "iot";
    if (fields.includes("DatetimeAgg")) return "agg";
    return "iot";
  }

  function pickDivisionColumn(fields, dataKind) {
    if (dataKind === "agg") {
      if (fields.includes("DivisionAgg")) return "DivisionAgg";
      if (fields.includes("Division")) return "Division";
      return null;
    }
    // iot
    if (fields.includes("Division")) return "Division";
    if (fields.includes("DivisionAgg")) return "DivisionAgg";
    return null;
  }

  function pickDeviceColumn(fields, dataKind) {
    // 今回は iot / agg とも Device を優先
    if (fields.includes("Device")) return "Device";
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

    // iot
    if (fields.includes("DeviceDatetime")) return "DeviceDatetime";
    if (fields.includes("DatetimeAgg")) return "DatetimeAgg";
    if (fields.includes("DeviceTimestamp")) return "DeviceTimestamp";
    return "";
  }

  // ✅ rows[0]問題対策：全rowsのkeysを先頭行に補完
  function normalizeIncomingRowsAllKeys(rows) {
    if (!rows || rows.length === 0) return rows;

    const allKeys = new Set();
    rows.forEach((r) => {
      if (r && typeof r === "object") {
        Object.keys(r).forEach((k) => allKeys.add(k));
      }
    });

    return rows.map((r, i) => {
      if (i !== 0) return r;
      const copy = { ...r };
      allKeys.forEach((k) => {
        if (!(k in copy)) copy[k] = null;
      });
      return copy;
    });
  }

  // ★重要：日時表現を統一（" "→"T"）＋TZが無い場合は +09:00 を付与
  function normalizeDt(ts) {
    let s = String(ts ?? "").trim();
    if (!s) return "";
    s = s.includes("T") ? s : s.replace(" ", "T");

    // 末尾にZ or +hh:mm or -hh:mm が無ければ JST を補完
    if (!/[zZ]$|[+\-]\d{2}:\d{2}$/.test(s)) {
      s += "+09:00";
    }
    return s;
  }

  // ★重要：日付キーは必ず JST(Asia/Tokyo) の YYYY-MM-DD で作る
  const JST_DAY_FMT = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  function getDayFromTs(ts) {
    const s = normalizeDt(ts);
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return JST_DAY_FMT.format(d); // "YYYY-MM-DD"
  }

  function buildDaySelectors(days) {
    if (!startDaySel || !endDaySel) return;
    const opts = days.map((d) => `<option value="${d}">${d}</option>`).join("");
    startDaySel.innerHTML = opts;
    endDaySel.innerHTML = opts;
    startDaySel.disabled = false;
    endDaySel.disabled = false;
    startDaySel.value = days[0];
    endDaySel.value = days[days.length - 1];
  }

  function inDayRange(day) {
    if (!day || !startDaySel || !endDaySel) return false;
    const s = startDaySel.value;
    const e = endDaySel.value;
    return s <= day && day <= e;
  }

  function getSelectedValues(sel) {
    if (!sel) return [];
    return Array.from(sel.selectedOptions)
      .map((o) => o.value)
      .filter((v) => v !== "");
  }

  function getTodHM(ts) {
    const m = String(ts).match(/(\d{2}):(\d{2})/);
    if (!m) return null;
    return `${m[1]}:${m[2]}`;
  }

  function isMostlyNumericColumn(data, col, sampleN = 200, ratio = 0.3) {

    let seen = 0;
    let ok = 0;

    for (const r of data || []) {
      const v = r[col];

      // ✅ null / 空文字は完全除外
      if (v == null || v === "") continue;

      seen++;

      const n = toNum(v);
      if (Number.isFinite(n)) {
        ok++;
      }

      // ✅ 1件でも数値が見えたらOK判定へ
      if (ok > 0 && seen >= sampleN) break;
    }

    // ✅ 全部nullでも候補として残す（重要）
    if (seen === 0) return true;

    // ✅ 数値1件でもあればOK
    return ok > 0;
  }


  // 粒度に合わせたカテゴリ配列（00–23重ね）
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

  function sortXYByTime(xArr, yArr) {
    const pairs = xArr
      .map((x, i) => {
        let t = NaN;
        if (x instanceof Date) t = x.getTime();
        else if (typeof x === "number") t = x;
        else t = new Date(String(x)).getTime();
        return { x, y: yArr[i], t };
      })
      .filter((p) => Number.isFinite(p.t));

    pairs.sort((a, b) => a.t - b.t);
    return { x: pairs.map((p) => p.x), y: pairs.map((p) => p.y) };
  }

  // =========================================================
  // DeviceType の表記ゆれ吸収（Power/Aircon判定）
  // =========================================================
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

  // =========================================================
  // 散布図の色マップ（day/temp）
  // =========================================================
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

  function buildColorMap(keys) {
    const m = {};
    (keys || []).forEach((k, i) => (m[k] = PALETTE[i % PALETTE.length]));
    return m;
  }

  function buildDayColors(days) {
    return buildColorMap((days || []).slice());
  }

  function buildTempColors(temps) {
    const labels = (temps || []).map((v) => `${v}℃`);
    return buildColorMap(labels);
  }

  // =========================================================
  // 折れ線色固定（キーに対して固定）
  // =========================================================
  function getTraceColor(key) {
    if (!appState.traceColors[key]) {
      const idx = Object.keys(appState.traceColors).length % PALETTE.length;
      appState.traceColors[key] = PALETTE[idx];
    }
    return appState.traceColors[key];
  }

  // =========================================================
  // 4軸用の列セレクタ構築
  // =========================================================
  function buildColumnSelectors(fields, data) {

    const TS_ALLOW = ["DatetimeAgg", "DeviceDatetime", "DeviceTimestamp"];

    const Y_EXCLUDE = [
      "DivisionAgg", "Division",
      "Device", "DeviceName",
      "DeviceType",
      "DatetimeAgg", "DeviceDatetime", "DeviceTimestamp"
    ];

    // ✅ 最重要メトリクス（強制表示）
    const FORCE_INCLUDE_METRICS = [
      "ActivePower",
      "ApparentPower",
      "CumulativeEnergy",
      "EnergyDeltaPerEffectiveMinute",
      "ActualTemp",
      "ActualHumidity",
      "WtTemp"
    ];

    // ----------------------------
    // TS列
    // ----------------------------
    const tsCandidates = TS_ALLOW.filter(c => fields.includes(c));
    const tsFinal = tsCandidates.length ? tsCandidates : fields.slice(0, 1);

    if (tsSel) {
      tsSel.innerHTML = tsFinal
        .map(c => `<option value="${c}">${disp(c)}</option>`)
        .join("");

      tsSel.disabled = false;
      tsSel.value = tsFinal[0] || "";
    }

    // ----------------------------
    // ✅ Y候補抽出（ここが超重要）
    // ----------------------------
    const yCandidates = fields
      .filter(f => !tsFinal.includes(f))
      .filter(f => !Y_EXCLUDE.includes(f))
      .filter(f =>
        FORCE_INCLUDE_METRICS.includes(f) || isMostlyNumericColumn(data, f)
      );

    // ----------------------------
    // ✅ fallback（全滅防止）
    // ----------------------------
    let finalCandidates = yCandidates;

    if (finalCandidates.length === 0) {
      console.warn("⚠ yCandidates empty → fallback to all fields");

      finalCandidates = fields.filter(f => !tsFinal.includes(f));
    }

    // ----------------------------
    // セレクタ生成
    // ----------------------------
    function fill(sel, defaults) {
      if (!sel) return;

      sel.innerHTML = finalCandidates
        .map(c => `<option value="${c}">${disp(c)}</option>`)
        .join("");

      sel.disabled = false;

      // ✅ 初期選択
      for (const opt of sel.options) {
        opt.selected = defaults.includes(opt.value);
      }
    }

    fill(yLeft1Sel, DEFAULT_LEFT1);
    fill(yLeft2Sel, DEFAULT_LEFT2);
    fill(yRight1Sel, DEFAULT_RIGHT1);
    fill(yRight2Sel, DEFAULT_RIGHT2);

    console.log("✅ yCandidates:", finalCandidates);
  }

  // =========================================================
  // TpSetTempAvgOn 候補をCSVから抽出 → セレクト生成（先頭ALL）
  // =========================================================
  function buildTpSetTempOptionsFromCsv(data) {
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
    if (!tpSetTempSel) return;

    const opts = [`<option value="ALL">すべてを表示</option>`].concat(
      values.map((v) => `<option value="${String(v)}">${String(v)}℃</option>`)
    );
    tpSetTempSel.innerHTML = opts.join("");

    const cur = String(appState.tpSetTempOn ?? "ALL");
    const has = cur === "ALL" || values.some((v) => String(v) === cur);
    appState.tpSetTempOn = has ? cur : "ALL";

    tpSetTempSel.value = String(appState.tpSetTempOn);
    syncTpBadge();
  }

  function syncTpBadge() {
    if (!badgeTpSetTemp || !tpSetTempSel) return;
    badgeTpSetTemp.textContent =
      tpSetTempSel.value === "ALL" ? "ALL（フィルタなし）" : `TpSetTempAvgOn=${tpSetTempSel.value}`;
  }

  // =========================================================
  // Aircon側：Datetime(TS列)ごとの TpSetTempAvgOn（最頻値）を作る
  // =========================================================
  function buildAirconTempMap(data) {
    const tsCol = tsSel?.value || "";
    const hasSetTemp = (appState.fields || []).includes("TpSetTempAvgOn");
    if (!tsCol || !hasSetTemp) return new Map();

    const divCol = appState.colDivision;
    const dtCounts = new Map();

    for (const r of data || []) {
      if (r[divCol] !== divisionSel?.value) continue;
      if (!isAirconType(r[CONFIG.colDeviceType])) continue;

      const tsRaw = r[tsCol];
      if (!tsRaw) continue;

      const day = getDayFromTs(tsRaw);
      if (!inDayRange(day)) continue;

      const dt = normalizeDt(tsRaw);
      const tp = toNum(r.TpSetTempAvgOn);
      if (!Number.isFinite(tp)) continue;

      if (!dtCounts.has(dt)) dtCounts.set(dt, new Map());
      const mp = dtCounts.get(dt);
      mp.set(tp, (mp.get(tp) || 0) + 1);
    }

    const out = new Map();
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
      if (bestTp != null) out.set(dt, bestTp);
    }
    return out;
  }

  // =========================================================
  // Aircon条件（選択値）を満たす TS(dt) 集合を作る
  // =========================================================
  function buildAllowedDatetimeAggSet(data) {
    if (!tpSetTempSel) return null;

    const selected = String(tpSetTempSel.value || "ALL");
    appState.tpSetTempOn = selected;
    syncTpBadge();

    if (selected === "ALL") {
      dbg("Aircon条件: すべてを表示（フィルタなし）");
      return null;
    }

    const target = Number(selected);
    if (!Number.isFinite(target)) {
      dbg("WARNING: TpSetTempAvgOn の選択値が数値ではありません。フィルタ無効化します。");
      return null;
    }

    const divCol = appState.colDivision;
    const tsCol = tsSel?.value || "";
    const hasSetTemp = (appState.fields || []).includes("TpSetTempAvgOn");

    if (!tsCol || !hasSetTemp) {
      dbg("WARNING: TS列 または TpSetTempAvgOn 列がありません。フィルタ無効化します。");
      return null;
    }

    const out = new Set();
    for (const r of data || []) {
      if (r[divCol] !== divisionSel?.value) continue;
      if (!isAirconType(r[CONFIG.colDeviceType])) continue;

      const tsRaw = r[tsCol];
      if (!tsRaw) continue;

      const day = getDayFromTs(tsRaw);
      if (!inDayRange(day)) continue;

      const v = toNum(r.TpSetTempAvgOn);
      if (Number.isFinite(v) && Math.abs(v - target) < 1e-9) {
        out.add(normalizeDt(tsRaw));
      }
    }
    dbg(`Aircon条件: TpSetTempAvgOn=${target} のTS(dt)が ${out.size} 個`);
    return out;
  }

  // =========================================================
  // 生データ → rows 正規化
  // =========================================================
  function buildRowsRaw(data, allowedSet, airconTempMap) {
    const out = [];
    const divCol = appState.colDivision;
    const devCol = appState.colDevice;

    const colTs = tsSel?.value;
    const left1 = getSelectedValues(yLeft1Sel);
    const left2 = getSelectedValues(yLeft2Sel);
    const right1 = getSelectedValues(yRight1Sel);
    const right2 = getSelectedValues(yRight2Sel);

    const allMetrics = [...left1, ...left2, ...right1, ...right2];
    if (allMetrics.length === 0) {
      dbg("Y軸がすべて未選択のため、描画しません。");
      return { rows: [], left1, left2, right1, right2, colTs };
    }

    for (const r of data || []) {
      const div = r[divCol];
      if (div !== divisionSel?.value) continue;

      const dev = r[devCol];
      const tsRawForPlot = r[colTs];
      if (!dev || !tsRawForPlot) continue;

      const day = getDayFromTs(tsRawForPlot);
      if (!inDayRange(day)) continue;

      const dt = normalizeDt(tsRawForPlot);
      const dtypeRaw = r[CONFIG.colDeviceType];

      if (allowedSet && !allowedSet.has(dt)) continue;

      const tp = airconTempMap?.has(dt) ? airconTempMap.get(dt) : NaN;

      for (const metric of allMetrics) {
        if (POWER_ONLY_METRICS.includes(metric)) {
          if (!isPowerType(dtypeRaw)) continue;
        }
        const v = toNum(r[metric]);
        if (Number.isFinite(v)) {
          out.push({ dev, dt, day, metric, v, tsRaw: tsRawForPlot, tp });
        }
      }
    }

    return { rows: out, left1, left2, right1, right2, colTs };
  }

  // =========================================================
  // 粒度集計
  // =========================================================
  function fmt2(n) {
    return String(n).padStart(2, "0");
  }

  function fmtBucketISO(y, mo, d, hh, mm) {
    return `${y}-${fmt2(mo)}-${fmt2(d)}T${fmt2(hh)}:${fmt2(mm)}:00+09:00`;
  }

  function floorToBucket(dtStr, grainMin) {
    const d = new Date(dtStr);
    if (!Number.isFinite(d.getTime())) return null;

    const hh = d.getHours();
    const mm = d.getMinutes();

    const totalMin = hh * 60 + mm;
    const floored = Math.floor(totalMin / grainMin) * grainMin;

    const hh2 = Math.floor(floored / 60);
    const mm2 = floored % 60;

    const day = JST_DAY_FMT.format(d);
    const [y, mo, da] = day.split("-").map(Number);

    return {
      day,
      dtBucket: fmtBucketISO(y, mo, da, hh2, mm2),
      bucketOrderKey: floored,
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
  // 4軸 range 計算
  // =========================================================
  function calcRanges(traces) {
    const range = { y: null, y2: null, y3: null, y4: null };

    function upd(key, arr) {
      const nums = arr.filter((v) => Number.isFinite(v));
      if (!nums.length) return;
      const mn = Math.min(...nums);
      const mx = Math.max(...nums);
      if (!range[key]) range[key] = { mn, mx };
      else {
        range[key].mn = Math.min(range[key].mn, mn);
        range[key].mx = Math.max(range[key].mx, mx);
      }
    }

    for (const t of traces) upd(t.yaxis || "y", t.y);

    function pad(r) {
      if (!r) return null;
      const span = r.mx - r.mn;
      const p = span === 0 ? Math.max(Math.abs(r.mx), 1) * 0.05 : span * 0.05;
      return [r.mn - p, r.mx + p];
    }

    return { y: pad(range.y), y2: pad(range.y2), y3: pad(range.y3), y4: pad(range.y4) };
  }

  // =========================================================
  // 折れ線描画
  // =========================================================
  function render(rows, left1, left2, right1, right2, colTs) {
    const xMode = appState.xMode;

    const byKey = new Map();
    for (const r of rows || []) {
      const key = `${r.day}__${r.dev}__${r.metric}`;
      if (!byKey.has(key)) {
        byKey.set(key, { x: [], y: [], dev: r.dev, metric: r.metric, day: r.day });
      }

      const t = byKey.get(key);

      if (xMode === "A") {
        const d = new Date(r.dt);
        if (!Number.isFinite(d.getTime())) continue;
        t.x.push(d);
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

      const sorted = xMode === "A" ? sortXYByTime(t.x, t.y) : sortXY(t.x, t.y);
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

    // ハイライト用赤丸（Left1先頭 / Right1先頭）
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
        dtick: 3600000,
        tickformat: "%H:%M\n%b %d, %Y",
      };
    } else {
      const cat = buildTodCategoryArray(rows, appState.grainMin);
      const stepLabel =
        appState.grainMin && appState.grainMin > 0 ? `${appState.grainMin}分刻み` : "データ刻み（自動）";
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

    Plotly.react(lineDiv, traces, layout, { responsive: true });
  }

  // =========================================================
  // 散布図：色分け切替（day/temp）
  // =========================================================
  function buildScatterTraces(rows, yMetric, xMetric, xMode) {
    const byKey = new Map();
    for (const r of rows || []) {
      const key = `${r.dev}__${r.dt}`;
      if (!byKey.has(key)) {
        byKey.set(key, { dev: r.dev, dt: r.dt, day: r.day, tsRaw: r.tsRaw, tp: r.tp });
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

      if (!byGroup.has(groupKey)) byGroup.set(groupKey, { x: [], y: [], customdata: [] });

      const xPlot = xMode === "A" ? new Date(obj.dt) : getTodHM(obj.tsRaw ?? obj.dt) ?? obj.dt;

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
    if (!scatterDiv) return;

    if (!left1.length || !right1.length) {
      Plotly.react(
        scatterDiv,
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
    const traces = buildScatterTraces(rows, yMetric, xMetric, appState.xMode);

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

    Plotly.react(scatterDiv, traces, layout, { responsive: true });
  }

  // =========================================================
  // 散布図 → 折れ線 連動（赤丸ハイライト）
  // =========================================================
  function clearLineHighlight() {
    if (appState.hlLeftIdx != null) Plotly.restyle(lineDiv, { x: [[]], y: [[]] }, [appState.hlLeftIdx]);
    if (appState.hlRightIdx != null) Plotly.restyle(lineDiv, { x: [[]], y: [[]] }, [appState.hlRightIdx]);
  }

  function setLineHighlight(xPlot, yLeft, yRight) {
    if (appState.hlLeftIdx != null && Number.isFinite(yLeft)) {
      Plotly.restyle(lineDiv, { x: [[xPlot]], y: [[yLeft]] }, [appState.hlLeftIdx]);
    }
    if (appState.hlRightIdx != null && Number.isFinite(yRight)) {
      Plotly.restyle(lineDiv, { x: [[xPlot]], y: [[yRight]] }, [appState.hlRightIdx]);
    }
  }

  function bindScatterToLineHover() {
    if (!scatterDiv || !lineDiv) return;

    if (typeof scatterDiv.removeAllListeners === "function") {
      scatterDiv.removeAllListeners("plotly_hover");
      scatterDiv.removeAllListeners("plotly_unhover");
    }

    scatterDiv.on("plotly_hover", (ev) => {
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

    scatterDiv.on("plotly_unhover", () => clearLineHighlight());
  }

  // =========================================================
  // 再描画
  // =========================================================
  function updatePlot() {
    if (!appState.sourceData) return;

    const airconTempMap = buildAirconTempMap(appState.sourceData);
    const allowed = buildAllowedDatetimeAggSet(appState.sourceData);

    const { rows: rows0, left1, left2, right1, right2, colTs } = buildRowsRaw(
      appState.sourceData,
      allowed,
      airconTempMap
    );

    if (badgeColTs) badgeColTs.textContent = colTs || "";

    const rows = aggregateRows(rows0, appState.grainMin);

    const daysInView = [...new Set((rows || []).map((r) => r.day).filter(Boolean))].sort();
    appState.dayColors = buildDayColors(daysInView);

    const tempsInView = [...new Set((rows || []).map((r) => r.tp).filter((v) => Number.isFinite(v)).map((v) => Number(v)))].sort(
      (a, b) => a - b
    );
    appState.tempColors = buildTempColors(tempsInView);

    appState.lastLeft1 = left1;
    appState.lastRight1 = right1;

    const m = new Map();
    for (const r of rows || []) m.set(`${r.dev}__${r.dt}__${r.metric}`, r.v);
    appState.valueMap = m;

    dbg(`dataKind=${appState.currentDataKind}`);
    dbg(`TS列=${colTs}`);
    dbg(`Division列=${appState.colDivision}`);
    dbg(`Device列=${appState.colDevice}`);
    dbg(`rows(raw)=${rows0.length}, rows(agg)=${rows.length}`);

    render(rows, left1, left2, right1, right2, colTs);
    renderScatter(rows, left1, right1);
    bindScatterToLineHover();
  }

  function enableControls() {
    if (divisionSel) divisionSel.disabled = false;
    if (startDaySel) startDaySel.disabled = false;
    if (endDaySel) endDaySel.disabled = false;
    if (replotBtn) replotBtn.disabled = false;
    if (xModeSel) xModeSel.disabled = false;
    if (grainSel) grainSel.disabled = false;
    if (tpSetTempSel) tpSetTempSel.disabled = false;
    if (colorModeSel) colorModeSel.disabled = false;
  }

  // =========================================================
  // CSVでもReactでも共通の初期化入口
  // =========================================================
  function loadRowsAndInit(rows, label = "rows", viewState = null) {
    rows = normalizeIncomingRowsAllKeys(rows || []);

    if (!rows || rows.length === 0) {
      clearDbg();
      dbg(`WARNING: ${label} が空です`);
      return;
    }

    clearDbg();
    dbg(`LOAD: ${label} count=${rows.length}`);

    appState.fields = Object.keys(rows[0] || {});
    appState.sourceData = rows;

    // ✅ standalone のときは CSVヘッダから dataKind 推定
    if (MODE !== "embed") {
      appState.currentDataKind = detectDataKindFromFields(appState.fields);
    } else if (viewState?.dataKind) {
      appState.currentDataKind = viewState.dataKind;
    } else if (pendingViewState?.dataKind) {
      appState.currentDataKind = pendingViewState.dataKind;
    }

    dbg(`dataKind=${appState.currentDataKind}`);
    dbg(`fields=${JSON.stringify(appState.fields)}`);
    dbg(`sample=${JSON.stringify(rows[0])}`);

    // ✅ dataKind ベースで Division / Device 列選択
    appState.colDivision = pickDivisionColumn(appState.fields, appState.currentDataKind);
    appState.colDevice = pickDeviceColumn(appState.fields, appState.currentDataKind);

    if (!appState.colDivision) throw new Error("Division列がありません（DivisionAgg / Division）");
    if (!appState.colDevice) throw new Error("Device列がありません（Device / DeviceName）");

    if (badgeColDiv) badgeColDiv.textContent = appState.colDivision;
    if (badgeColDevice) badgeColDevice.textContent = appState.colDevice;

    buildColumnSelectors(appState.fields, appState.sourceData);

    const divs = [...new Set(appState.sourceData.map((r) => r[appState.colDivision]).filter(Boolean))].sort();
    if (divisionSel) {
      divisionSel.innerHTML = divs.map((d) => `<option value="${d}">${d}</option>`).join("");
    }

    const tsCol = tsSel?.value;
    const days = [...new Set(appState.sourceData.map((r) => getDayFromTs(r[tsCol])).filter(Boolean))].sort();
    appState.days = days;
    if (days.length) buildDaySelectors(days);

    appState.xMode = xModeSel?.value || "A";
    appState.grainMin = Number(grainSel?.value || 0);

    const tpOptions = buildTpSetTempOptionsFromCsv(appState.sourceData);
    if (tpOptions) {
      applyTpSetTempOptions(tpOptions);
    } else if (tpSetTempSel) {
      tpSetTempSel.value = "ALL";
      appState.tpSetTempOn = "ALL";
      syncTpBadge();
    }

    appState.colorMode = colorModeSel?.value || "day";

    if (MODE !== "embed") {
      if (divisionSel) divisionSel.onchange = updatePlot;
      if (startDaySel) startDaySel.onchange = updatePlot;
      if (endDaySel) endDaySel.onchange = updatePlot;
    } else {
      if (divisionSel) divisionSel.onchange = null;
      if (startDaySel) startDaySel.onchange = null;
      if (endDaySel) endDaySel.onchange = null;
    }

    if (tsSel) {
      tsSel.onchange = () => {
        const prevStart = startDaySel?.value || null;
        const prevEnd = endDaySel?.value || null;

        const tsCol2 = tsSel.value;
        const days2 = [...new Set(appState.sourceData.map((r) => getDayFromTs(r[tsCol2])).filter(Boolean))].sort();

        if (days2.length) {
          buildDaySelectors(days2);

          if (MODE === "embed" && pendingViewState) {
            if (pendingViewState.startDay && days2.includes(pendingViewState.startDay)) {
              startDaySel.value = pendingViewState.startDay;
            } else if (prevStart && days2.includes(prevStart)) {
              startDaySel.value = prevStart;
            }

            if (pendingViewState.endDay && days2.includes(pendingViewState.endDay)) {
              endDaySel.value = pendingViewState.endDay;
            } else if (prevEnd && days2.includes(prevEnd)) {
              endDaySel.value = prevEnd;
            }
          } else {
            if (prevStart && days2.includes(prevStart)) startDaySel.value = prevStart;
            if (prevEnd && days2.includes(prevEnd)) endDaySel.value = prevEnd;
          }
        }

        updatePlot();
      };
    }

    if (yLeft1Sel) yLeft1Sel.onchange = updatePlot;
    if (yLeft2Sel) yLeft2Sel.onchange = updatePlot;
    if (yRight1Sel) yRight1Sel.onchange = updatePlot;
    if (yRight2Sel) yRight2Sel.onchange = updatePlot;

    if (xModeSel) {
      xModeSel.onchange = () => {
        appState.xMode = xModeSel.value;
        updatePlot();
      };
    }
    if (grainSel) {
      grainSel.onchange = () => {
        appState.grainMin = Number(grainSel.value || 0);
        updatePlot();
      };
    }

    if (tpSetTempSel) {
      tpSetTempSel.onchange = () => {
        appState.tpSetTempOn = String(tpSetTempSel.value || "ALL");
        syncTpBadge();
        updatePlot();
      };
    }

    if (colorModeSel) {
      colorModeSel.onchange = () => {
        appState.colorMode = colorModeSel.value || "day";
        updatePlot();
      };
    }

    if (replotBtn) replotBtn.onclick = updatePlot;

    if (divisionSel) divisionSel.value = divs[0] || "";

    const vs = viewState || pendingViewState;
    if (vs) {
      if (divisionSel && vs.division && divs.includes(vs.division)) divisionSel.value = vs.division;
      if (startDaySel && vs.startDay && days.includes(vs.startDay)) startDaySel.value = vs.startDay;
      if (endDaySel && vs.endDay && days.includes(vs.endDay)) endDaySel.value = vs.endDay;
    }

    enableControls();
    if (MODE === "embed") applyEmbedUiLock();
    updatePlot();
    dbg("DONE(init)");
  }

  // =========================================================
  // CSV 読み込み（standalone）
  // =========================================================
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (MODE === "embed") {
      dbg("INFO: embedモードのためCSV読込は無効です");
      return;
    }

    clearDbg();
    dbg(`file: ${file.name}`);

    const reader = new FileReader();
    reader.onload = () => {
      const csvText = reader.result;

      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => String(h).trim(),
      });

      const data = parsed.data || [];
      loadRowsAndInit(data, `CSV:${file.name}`, null);
    };

    reader.readAsText(file, "utf-8");
  });

  // =========================================================
  // embed（React連携）：postMessage 受信
  // =========================================================
  if (MODE === "embed") {
    window.parent.postMessage({ type: "PLOTLY_READY", version: "1" }, window.location.origin);

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === "SET_VIEWSTATE") {
        pendingViewState = {
          division: msg.division ?? null,
          startDay: msg.startDay ?? null,
          endDay: msg.endDay ?? null,
          // ✅ dataKind 受信
          dataKind: msg.dataKind ?? "iot",
        };

        appState.currentDataKind = pendingViewState.dataKind || "iot";

        dbg(`SET_VIEWSTATE: ${JSON.stringify(pendingViewState)}`);
        dbg(`currentDataKind=${appState.currentDataKind}`);

        if (appState.sourceData && appState.days?.length) {
          // dataKind が変わった可能性があるので列セレクタ再構築
          buildColumnSelectors(appState.fields, appState.sourceData);

          // dataKind に応じて division/device 列も再決定
          appState.colDivision = pickDivisionColumn(appState.fields, appState.currentDataKind);
          appState.colDevice = pickDeviceColumn(appState.fields, appState.currentDataKind);

          if (badgeColDiv) badgeColDiv.textContent = appState.colDivision || "";
          if (badgeColDevice) badgeColDevice.textContent = appState.colDevice || "";

          const divs = [...new Set(appState.sourceData.map((r) => r[appState.colDivision]).filter(Boolean))].sort();
          if (divisionSel) {
            divisionSel.innerHTML = divs.map((d) => `<option value="${d}">${d}</option>`).join("");
          }

          const tsCol = tsSel?.value;
          const days = [...new Set(appState.sourceData.map((r) => getDayFromTs(r[tsCol])).filter(Boolean))].sort();
          appState.days = days;
          if (days.length) buildDaySelectors(days);

          if (divisionSel && pendingViewState.division && divs.includes(pendingViewState.division)) {
            divisionSel.value = pendingViewState.division;
          }
          if (startDaySel && pendingViewState.startDay && days.includes(pendingViewState.startDay)) {
            startDaySel.value = pendingViewState.startDay;
          }
          if (endDaySel && pendingViewState.endDay && days.includes(pendingViewState.endDay)) {
            endDaySel.value = pendingViewState.endDay;
          }

          applyEmbedUiLock();
          updatePlot();
        }
      }

      if (msg.type === "SET_DATA") {
        const rows = (msg.rows || []).filter((r) => r && typeof r === "object");
        dbg(`SET_DATA rows=${rows.length}`);
        if (rows.length > 0) {
          dbg(`SET_DATA firstKeys=${JSON.stringify(Object.keys(rows[0]))}`);
        }
        loadRowsAndInit(rows, "EMBED:rows", pendingViewState);
      }
    });
  }
})();