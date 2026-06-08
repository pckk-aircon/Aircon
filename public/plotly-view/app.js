// =========================================
// ✅ デフォルト（agg対応に修正）
// =========================================

// ✅ ここが今回の本質
const DEFAULT_LEFT1 = [
  "ActivePower", "AvgActivePower"
];

const DEFAULT_LEFT2 = [
  "ActualTemp", "AvgActualTemp"
];

const DEFAULT_RIGHT1 = [
  "CumulativeEnergy", "SumCumulativeEnergy"
];

const DEFAULT_RIGHT2 = [
  "ActualHumidity", "AvgActualHumidity"
];


// =========================================
// ✅ FORCE_INCLUDE_METRICS 修正
// =========================================

const FORCE_INCLUDE_METRICS = [
  "ActivePower",
  "ApparentPower",
  "CumulativeEnergy",
  "EnergyDeltaPerEffectiveMinute",
  "ActualTemp",
  "ActualHumidity",
  "WtTemp",

  // ✅ agg用（最重要追加）
  "AvgActivePower",
  "AvgActualTemp",
  "AvgActualHumidity",
  "SumCumulativeEnergy"
];


// =========================================
// ✅ buildColumnSelectors 修正（最重要）
// =========================================

function buildColumnSelectors(fields, data) {

  const TS_ALLOW = ["DatetimeAgg", "DeviceDatetime", "DeviceTimestamp"];

  const Y_EXCLUDE = [
    "DivisionAgg", "Division",
    "Device", "DeviceName",
    "DeviceType",
    "DatetimeAgg", "DeviceDatetime", "DeviceTimestamp"
  ];

  const tsCandidates = TS_ALLOW.filter(c => fields.includes(c));
  const tsFinal = tsCandidates.length ? tsCandidates : fields.slice(0, 1);

  if (tsSel) {
    tsSel.innerHTML = tsFinal
      .map(c => `<option value="${c}">${disp(c)}</option>`)
      .join("");

    tsSel.disabled = false;
    tsSel.value = tsFinal[0] || "";
  }

  // ✅ Y候補
  let yCandidates = fields
    .filter(f => !tsFinal.includes(f))
    .filter(f => !Y_EXCLUDE.includes(f))
    .filter(f =>
      FORCE_INCLUDE_METRICS.includes(f) || isMostlyNumericColumn(data, f)
    );

  // ✅ ★ここ修正：agg用補完
  if (yCandidates.length === 0) {
    console.warn("⚠ yCandidates empty → fallback(agg対応)");

    yCandidates = fields.filter(f =>
      !tsFinal.includes(f) &&
      !Y_EXCLUDE.includes(f)
    );
  }

  // ✅ セレクタ作成
  function fill(sel, defaults) {
    if (!sel) return;

    sel.innerHTML = yCandidates
      .map(c => `<option value="${c}">${disp(c)}</option>`)
      .join("");

    sel.disabled = false;

    for (const opt of sel.options) {
      opt.selected = defaults.includes(opt.value);
    }
  }

  fill(yLeft1Sel, DEFAULT_LEFT1);
  fill(yLeft2Sel, DEFAULT_LEFT2);
  fill(yRight1Sel, DEFAULT_RIGHT1);
  fill(yRight2Sel, DEFAULT_RIGHT2);

  console.log("✅ yCandidates:", yCandidates);
}