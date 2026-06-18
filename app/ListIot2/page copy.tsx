"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, startOfDay } from "date-fns";

Amplify.configure(outputs);
const client = generateClient<Schema>();

type DivisionRow = {
  Division: string;
  DivisionName: string;
  // ★ 追加: Division空間情報（listDivision が返す前提）
  DivisionPolygon?: number[][][] | null;
  Height?: number | null;
};

type DeviceRow = {
  Device: string;
  DeviceName?: string | null;
  Controller?: string | null;
  DeviceType?: string | null;
  Division?: string | null;
};

type IotRow = Record<string, unknown>;

type DataKind = "iot" | "agg";

type ViewState = {
  division: string;
  startDay: string;
  endDay: string;
  dataKind: DataKind;
};

type FullPayload = {
  viewState: ViewState;
  rows: IotRow[];
};

/**
 * listIot / listIotAgg 共通で扱うページ型
 */
type QueryPageData =
  | {
      items?: IotRow[] | null;
      nextToken?: string | null;
    }
  | IotRow[]
  | null
  | undefined;

type QueryErrors = readonly { message: string }[] | undefined;

export default function Page() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [selectedDivision, setSelectedDivision] = useState("");

  // Device マスタ由来の DeviceCode -> DeviceName map
  const [deviceNameMap, setDeviceNameMap] = useState<Map<string, string>>(new Map());

  // ★ 追加: Division マスタ由来の DivisionCode -> Division情報 map
  const [divisionGeomMap, setDivisionGeomMap] =
    useState<Map<string, DivisionRow>>(new Map());

  // IotData / IotDataAgg の切替
  const [dataKind, setDataKind] = useState<DataKind>("iot");

  const [iframeReady, setIframeReady] = useState(false);
  const [allRows, setAllRows] = useState<IotRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 進捗表示用
  const [progress, setProgress] = useState(0); // 0-100
  const [progressCompleted, setProgressCompleted] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  const controller = "Mutsu01";

  /**
   * 同時取得数の上限
   */
  const MAX_CONCURRENT_FETCHES = 3;

  /**
   * 日付範囲単位のキャッシュ
   * key = controller|dataKind|yyyy-MM-dd|yyyy-MM-dd
   * Divisionは含めない
   */
  const rangeCacheRef = useRef<Map<string, IotRow[]>>(new Map());

  /**
   * 最新リクエストのみ有効にするための連番
   */
  const requestSeqRef = useRef(0);

  /**
   * iframe未準備時にあとで送る用
   */
  const latestViewStateRef = useRef<ViewState | null>(null);
  const latestFullPayloadRef = useRef<FullPayload | null>(null);

  /**
   * どの iframeDataKey の rows を最後に送ったか
   */
  const lastSentDataKeyRef = useRef<string>("");

  /**
   * Division変更だけを検出するため
   */
  const prevViewStateRef = useRef<ViewState | null>(null);

  const buildViewState = useCallback(
    (division: string, start: Date, end: Date, kind: DataKind): ViewState => ({
      division,
      startDay: format(start, "yyyy-MM-dd"),
      endDay: format(end, "yyyy-MM-dd"),
      dataKind: kind,
    }),
    []
  );

  const makeRangeCacheKey = useCallback(
    (start: Date, end: Date, kind: DataKind) =>
      [
        controller,
        kind,
        format(startOfDay(start), "yyyy-MM-dd"),
        format(startOfDay(end), "yyyy-MM-dd"),
      ].join("|"),
    [controller]
  );

  /**
   * iframeへ送ったデータを識別するキー
   * range cache key と違い division も含める
   */
  const makeIframeDataKey = useCallback(
    (start: Date, end: Date, kind: DataKind, division: string) =>
      [
        controller,
        kind,
        format(startOfDay(start), "yyyy-MM-dd"),
        format(startOfDay(end), "yyyy-MM-dd"),
        division,
      ].join("|"),
    [controller]
  );

  /**
   * 表示用 progress（10%刻みに丸める）
   * 例: 14 -> 10, 29 -> 20, 100 -> 100
   */
  const displayProgress = useMemo(() => {
    if (progress >= 100) return 100;
    return Math.floor(progress / 10) * 10;
  }, [progress]);

  /**
   * UI表示用
   * 現在選択Divisionに属する件数
   */
  const selectedRowsCount = useMemo(() => {
    if (!selectedDivision || allRows.length === 0) return 0;

    return allRows.filter((r) => {
      const row = r as Record<string, unknown>;
      const div = row.DivisionAgg ?? row.Division;
      return div === selectedDivision;
    }).length;
  }, [allRows, selectedDivision]);

  // =========================================================
  // normalize 共通ユーティリティ
  // =========================================================
  const normalizeRows = useCallback(
    (rows: IotRow[], kind: DataKind): IotRow[] => {
      const isNilLike = (v: unknown): boolean => {
        return v == null || (typeof v === "string" && v.trim() === "");
      };

      const trimString = (v: unknown): unknown => {
        return typeof v === "string" ? v.trim() : v;
      };

      const normalizeDateTimeString = (v: unknown): unknown => {
        if (typeof v !== "string") return v;

        let s = v.trim();
        if (!s) return s;

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
      };

      const tryNormalizeScalar = (v: unknown): unknown => {
        if (v == null) return null;

        if (typeof v === "number") {
          return Number.isFinite(v) ? v : null;
        }

        if (typeof v !== "string") return v;

        const s = v.trim();
        if (s === "") return null;

        const normalized = s
          .replace(/^'+/, "")
          .replace(/^[\"']|[\"']$/g, "")
          .replace(/[−ー―]/g, "-")
          .replace(/,/g, "");

        if (/^-?\d+(\.\d+)?$/.test(normalized)) {
          const n = Number(normalized);
          if (Number.isFinite(n)) return n;
        }

        return s;
      };

      const fillIfEmpty = (
        out: Record<string, unknown>,
        target: string,
        source: string
      ) => {
        if (isNilLike(out[target]) && !isNilLike(out[source])) {
          out[target] = out[source];
        }
      };

      const finalizeFirstRowKeys = (normalized: IotRow[]): IotRow[] => {
        if (normalized.length === 0) return normalized;

        const allKeys = new Set<string>();
        for (const row of normalized) {
          Object.keys(row).forEach((k) => allKeys.add(k));
        }

        return normalized.map((row, index) => {
          if (index !== 0) return row;

          const first = { ...row } as Record<string, unknown>;
          for (const key of allKeys) {
            if (!(key in first)) {
              first[key] = null;
            }
          }
          return first;
        });
      };

      // =========================================================
      // iot 専用 normalize
      // =========================================================
      const normalizeIotRows = (srcRows: IotRow[]): IotRow[] => {
        const normalized = srcRows
          .filter((row) => row && typeof row === "object")
          .map((row) => {
            const src = row as Record<string, unknown>;
            const out: Record<string, unknown> = {};

            for (const [rawKey, rawValue] of Object.entries(src)) {
              const key = String(rawKey).trim();
              let value = trimString(rawValue);

              if (
                key === "DatetimeAgg" ||
                key === "DeviceDatetime" ||
                key === "DeviceTimestamp"
              ) {
                value = normalizeDateTimeString(value);
              } else {
                value = tryNormalizeScalar(value);
              }

              out[key] = value;
            }

            // 共通別名
            fillIfEmpty(out, "DeviceType", "Type");
            fillIfEmpty(out, "Device", "DeviceName");
            // ❌ DeviceName <- Device はしない
            fillIfEmpty(out, "DivisionAgg", "Division");
            fillIfEmpty(out, "Division", "DivisionAgg");

            // Deviceマスタから DeviceName を補完
            const deviceCode = String(out["Device"] ?? "").trim();
            if (isNilLike(out["DeviceName"]) && deviceCode) {
              out["DeviceName"] = deviceNameMap.get(deviceCode) ?? null;
            }

            // iot は DeviceDatetime 優先
            const primaryTs =
              !isNilLike(out["DeviceDatetime"])
                ? out["DeviceDatetime"]
                : !isNilLike(out["DatetimeAgg"])
                ? out["DatetimeAgg"]
                : !isNilLike(out["DeviceTimestamp"])
                ? out["DeviceTimestamp"]
                : null;

            if (!isNilLike(primaryTs)) {
              const normalizedTs = normalizeDateTimeString(primaryTs);

              if (isNilLike(out.DeviceDatetime)) {
                out.DeviceDatetime = normalizedTs;
              } else {
                out.DeviceDatetime = normalizeDateTimeString(out.DeviceDatetime);
              }

              if (isNilLike(out.DatetimeAgg)) {
                out.DatetimeAgg = normalizedTs;
              } else {
                out.DatetimeAgg = normalizeDateTimeString(out.DatetimeAgg);
              }

              if (isNilLike(out.DeviceTimestamp)) {
                out.DeviceTimestamp = normalizedTs;
              } else {
                out.DeviceTimestamp = normalizeDateTimeString(out.DeviceTimestamp);
              }
            }

            const mustHaveKeys = [
              "DivisionAgg",
              "Division",
              "DivisionName",
              "Device",
              "DeviceName",
              "DeviceType",
              "DatetimeAgg",
              "DeviceDatetime",
              "DeviceTimestamp",
              "ActualTemp",
              "ActualHumidity",
              "ActivePower",
              "ApparentPower",
              "CumulativeEnergy",
              "EnergyDeltaPerEffectiveMinute",
              "WtTemp",
            ];

            for (const k of mustHaveKeys) {
              if (!(k in out)) {
                out[k] = null;
              }
            }

            return out;
          });

        return finalizeFirstRowKeys(normalized);
      };

      // =========================================================
      // agg 専用 normalize
      // =========================================================
      const normalizeAggRows = (srcRows: IotRow[]): IotRow[] => {
        const isNilLikeLocal = (v: unknown): boolean => {
          return v == null || (typeof v === "string" && v.trim() === "");
        };

        const trimStringLocal = (v: unknown): unknown =>
          typeof v === "string" ? v.trim() : v;

        const normalizeDateTimeStringLocal = (v: unknown): string | null => {
          if (typeof v !== "string") return null;

          let s = v.trim();
          if (!s) return null;

          // "2026-05-11 00:00:00" → "2026-05-11T00:00:00"
          if (s.includes(" ") && !s.includes("T")) {
            s = s.replace(" ", "T");
          }

          // タイムゾーン補完
          if (
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) &&
            !/[zZ]$|[+\-]\d{2}:\d{2}$/.test(s)
          ) {
            s += "+09:00";
          }

          return s;
        };

        const tryNormalizeScalarLocal = (v: unknown): unknown => {
          if (v == null) return null;
          if (typeof v === "number") return Number.isFinite(v) ? v : null;
          if (typeof v !== "string") return v;

          const s = v.trim();
          if (!s) return null;

          const normalized = s
            .replace(/^'+/, "")
            .replace(/^[\"']|[\"']$/g, "")
            .replace(/[−ー―]/g, "-")
            .replace(/,/g, "");

          if (/^-?\d+(\.\d+)?$/.test(normalized)) {
            const n = Number(normalized);
            if (Number.isFinite(n)) return n;
          }

          return s;
        };

        const normalized = srcRows
          .filter((row) => row && typeof row === "object")
          .map((row) => {
            const src = row as Record<string, unknown>;
            const out: Record<string, unknown> = {};

            // =========================
            // ① 基本コピー
            // =========================
            for (const [rawKey, rawValue] of Object.entries(src)) {
              const key = String(rawKey).trim();

              const value =
                key === "DatetimeAgg"
                  ? trimStringLocal(rawValue)
                  : tryNormalizeScalarLocal(trimStringLocal(rawValue));

              out[key] = value;
            }

            // =========================
            // ② 共通別名補完
            // =========================
            if (isNilLikeLocal(out["DivisionAgg"])) out["DivisionAgg"] = out["Division"];
            if (isNilLikeLocal(out["Division"])) out["Division"] = out["DivisionAgg"];

            if (isNilLikeLocal(out["Device"])) out["Device"] = out["DeviceName"];
            // ❌ DeviceName <- Device はしない

            if (isNilLikeLocal(out["DeviceType"])) out["DeviceType"] = out["Type"];

            // Deviceマスタから DeviceName を補完
            const deviceCode = String(out["Device"] ?? "").trim();
            if (isNilLikeLocal(out["DeviceName"]) && deviceCode) {
              out["DeviceName"] = deviceNameMap.get(deviceCode) ?? null;
            }

            // =========================
            // ★ 追加: Division座標のJoin（aggのみ）
            // =========================
            const divCode = String(out["Division"] ?? "").trim();
            if (divCode) {

              const geom = divisionGeomMap.get(divCode);

              if (geom) {
                console.log("JOIN geom", divCode, geom);

                if (isNilLikeLocal(out["DivisionName"])) {
                  out["DivisionName"] = geom.DivisionName ?? null;
                }

                out["DivisionPolygon"] = geom.DivisionPolygon ?? null;
                out["DivisionHeight"] = geom.Height ?? null;

                console.log("after JOIN", {
                  Division: divCode,
                  polygon: out["DivisionPolygon"],
                  height: out["DivisionHeight"],
                });
              } else {
                console.log("geom NOT FOUND for", divCode);
              }

            }

            // =========================
            // ③ 集計列 → 通常列マッピング（重要）
            // =========================
            if (!isNilLikeLocal(out["AvgActivePower"]) && isNilLikeLocal(out["ActivePower"])) {
              out["ActivePower"] = out["AvgActivePower"];
            }

            if (
              !isNilLikeLocal(out["AvgApparentPower"]) &&
              isNilLikeLocal(out["ApparentPower"])
            ) {
              out["ApparentPower"] = out["AvgApparentPower"];
            }

            if (
              !isNilLikeLocal(out["SumCumulativeEnergy"]) &&
              isNilLikeLocal(out["CumulativeEnergy"])
            ) {
              out["CumulativeEnergy"] = out["SumCumulativeEnergy"];
            }

            if (!isNilLikeLocal(out["AvgActualTemp"]) && isNilLikeLocal(out["ActualTemp"])) {
              out["ActualTemp"] = out["AvgActualTemp"];
            }

            if (
              !isNilLikeLocal(out["AvgActualHumidity"]) &&
              isNilLikeLocal(out["ActualHumidity"])
            ) {
              out["ActualHumidity"] = out["AvgActualHumidity"];
            }

            if (!isNilLikeLocal(out["AvgWtTemp"]) && isNilLikeLocal(out["WtTemp"])) {
              out["WtTemp"] = out["AvgWtTemp"];
            }

            if (
              !isNilLikeLocal(out["SumEnergyDeltaPerEffectiveMinute"]) &&
              isNilLikeLocal(out["EnergyDeltaPerEffectiveMinute"])
            ) {
              out["EnergyDeltaPerEffectiveMinute"] =
                out["SumEnergyDeltaPerEffectiveMinute"];
            }

            // =========================
            // ④ DatetimeAgg取得
            // =========================
            let ts: string | null = null;

            const candidates = [
              "DatetimeAgg",
              "AggKey",
              "DateTimeAgg",
              "Datetime",
              "ComputedAt",
              "SourceWindowEnd",
            ];

            for (const key of candidates) {
              if (!ts && !isNilLikeLocal(src[key])) {
                ts = normalizeDateTimeStringLocal(src[key]);
                console.log("✅ use datetime from", key, "=", src[key]);
              }
            }

            // fallback（DeviceDatetime）
            if (!ts && !isNilLikeLocal(src["DeviceDatetime"])) {
              ts = normalizeDateTimeStringLocal(src["DeviceDatetime"]);
              console.log("✅ use datetime from DeviceDatetime");
            }

            // セット
            if (ts) {
              out["DatetimeAgg"] = ts;
              out["DeviceDatetime"] = ts;
              out["DeviceTimestamp"] = ts;
            } else {
              out["DatetimeAgg"] = null;
              out["DeviceDatetime"] = null;
              out["DeviceTimestamp"] = null;

              console.warn("⚠️ agg datetime missing", {
                row: src,
              });
            }

            // =========================
            // ⑤ 必須キー補完
            // =========================
            const mustHaveKeys = [
              "DivisionAgg",
              "Division",
              "DivisionName",

              // ★ 追加
              "DivisionPolygon",
              "DivisionHeight",

              "Device",
              "DeviceName",
              "DeviceType",
              "DatetimeAgg",
              "DeviceDatetime",
              "DeviceTimestamp",
              "ActualTemp",
              "ActualHumidity",
              "ActivePower",
              "ApparentPower",
              "CumulativeEnergy",
              "EnergyDeltaPerEffectiveMinute",
              "WtTemp",
            ];

            for (const k of mustHaveKeys) {
              if (!(k in out)) out[k] = null;
            }

            return out;
          });

        return finalizeFirstRowKeys(normalized);
      };

      // dispatcher
      if (kind === "agg") {
        return normalizeAggRows(rows);
      }
      return normalizeIotRows(rows);
    },
    [deviceNameMap, divisionGeomMap]
  );

  /**
   * iframe に送る rows は現在選択 Division のみに絞る
   * これで postMessage の転送量と app.js 側の処理量を減らす
   */
  const filterRowsForDivision = useCallback(
    (rows: IotRow[], division: string): IotRow[] => {
      if (!division || rows.length === 0) return [];

      return rows.filter((r) => {
        const row = r as Record<string, unknown>;
        const div = (row.DivisionAgg ?? row.Division) as string | undefined;
        return div === division;
      });
    },
    []
  );

  /**
   * postMessage 送信先 origin
   * app.js 側が event.origin === window.location.origin を見ているので、
   * こちらも origin を明示する
   */
  const getTargetOrigin = useCallback(() => {
    return window.location.origin;
  }, []);

  /**
   * iframeへ viewState だけ送る
   */
  const sendViewStateToIframe = useCallback(
    (viewState: ViewState) => {
      latestViewStateRef.current = viewState;

      if (!iframeReady) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;

      const origin = getTargetOrigin();

      console.log("[postMessage] SET_VIEWSTATE", viewState);

      win.postMessage({ type: "SET_VIEWSTATE", ...viewState }, origin);
    },
    [iframeReady, getTargetOrigin]
  );

  /**
   * iframeへ viewState + rows を送る
   * rows は親では全Division保持、iframeへは選択Divisionのみ送る
   */
  const sendFullPayloadToIframe = useCallback(
    (payload: FullPayload, dataKey: string) => {
      latestFullPayloadRef.current = payload;
      latestViewStateRef.current = payload.viewState;

      if (!iframeReady) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;

      const origin = getTargetOrigin();

      const rowsForView = filterRowsForDivision(
        payload.rows,
        payload.viewState.division
      );

      // app.js の想定どおり、先に viewState、そのあと rows
      win.postMessage({ type: "SET_VIEWSTATE", ...payload.viewState }, origin);
      win.postMessage({ type: "SET_DATA", rows: rowsForView }, origin);

      lastSentDataKeyRef.current = dataKey;
    },
    [iframeReady, getTargetOrigin, filterRowsForDivision]
  );

  /**
   * iframe READY待ち
   */
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === "PLOTLY_READY") {
        console.log("[iframe] PLOTLY_READY");
        setIframeReady(true);
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  /**
   * iframe readyになったら最新状態を流す
   */
  useEffect(() => {
    if (!iframeReady) return;

    const iframeDataKey = makeIframeDataKey(
      startDate,
      endDate,
      dataKind,
      selectedDivision
    );

    if (
      latestFullPayloadRef.current &&
      lastSentDataKeyRef.current !== iframeDataKey
    ) {
      sendFullPayloadToIframe(latestFullPayloadRef.current, iframeDataKey);
      return;
    }

    if (latestViewStateRef.current) {
      sendViewStateToIframe(latestViewStateRef.current);
    }
  }, [
    iframeReady,
    startDate,
    endDate,
    dataKind,
    selectedDivision,
    makeIframeDataKey,
    sendFullPayloadToIframe,
    sendViewStateToIframe,
  ]);

  /**
   * Division一覧取得
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, errors } = await client.queries.listDivision({
          Controller: controller,
        });

        if (errors?.length) {
          console.error("listDivision errors:", errors);
          return;
        }

        if (cancelled) return;

        const list = (data || []) as DivisionRow[];

        console.log("=== Division raw data ===", list);
        console.log("sample Division:", list[0]);

        const sorted = [...list].sort((a, b) =>
          a.DivisionName.localeCompare(b.DivisionName, "ja")
        );

        setDivisions(sorted);

        // ★ 追加: Division情報を map 化
        const map = new Map<string, DivisionRow>();
        for (const d of sorted) {
          const code = String(d.Division ?? "").trim();
          if (code) {
            map.set(code, d);
          }
        }



        console.log("=== divisionGeomMap ===");
        console.log("size:", map.size);

        // サンプル1件
        const firstKey = map.keys().next().value;
        console.log("sample key:", firstKey);





        setDivisionGeomMap(map);

        if (sorted.length > 0) {
          setSelectedDivision((prev) => prev || sorted[0].Division);
        }
      } catch (err) {
        console.error("listDivision error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [controller]);

  /**
   * Device マスタ取得
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, errors } = await client.queries.listDevice({
          Controller: controller,
        });

        if (errors?.length) {
          console.error("listDevice errors:", errors);
          return;
        }

        if (cancelled) return;

        const list = (data || []) as DeviceRow[];
        const map = new Map<string, string>();

        for (const d of list) {
          const code = String(d.Device ?? "").trim();
          const name = String(d.DeviceName ?? "").trim();
          if (code && name) {
            map.set(code, name);
          }
        }

        console.log("deviceNameMap size=", map.size);
        setDeviceNameMap(map);
      } catch (err) {
        console.error("listDevice error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [controller]);

  /**
   * マスタ更新時、既存 rows / cache を再normalizeして再送
   * - deviceNameMap
   * - divisionGeomMap
   */
  useEffect(() => {
    if (deviceNameMap.size === 0 && divisionGeomMap.size === 0) return;

    // cache の再normalize
    if (rangeCacheRef.current.size > 0) {
      const nextCache = new Map<string, IotRow[]>();

      for (const [key, rows] of rangeCacheRef.current.entries()) {
        const parts = key.split("|");
        const kind = (parts[1] === "agg" ? "agg" : "iot") as DataKind;
        nextCache.set(key, normalizeRows(rows, kind));
      }

      rangeCacheRef.current = nextCache;
    }

    // 現在 rows の再normalize
    if (allRows.length > 0) {
      const renormalized = normalizeRows(allRows, dataKind);
      setAllRows(renormalized);

      const currentViewState = buildViewState(
        selectedDivision,
        startDate,
        endDate,
        dataKind
      );
      const iframeDataKey = makeIframeDataKey(
        startDate,
        endDate,
        dataKind,
        selectedDivision
      );

      const payload: FullPayload = {
        viewState: currentViewState,
        rows: renormalized,
      };

      latestFullPayloadRef.current = payload;
      sendFullPayloadToIframe(payload, iframeDataKey);
    }
  }, [
    deviceNameMap,
    divisionGeomMap,
    allRows,
    dataKind,
    selectedDivision,
    startDate,
    endDate,
    normalizeRows,
    buildViewState,
    makeIframeDataKey,
    sendFullPayloadToIframe,
  ]);

  /**
   * res.data の形を吸収
   * - { items, nextToken } 型
   * - 直接配列
   */
  const unwrapQueryData = useCallback((raw: QueryPageData) => {
    let items: IotRow[] = [];
    let nextToken: string | null | undefined = null;

    if (Array.isArray(raw)) {
      items = raw.filter(Boolean) as IotRow[];
      nextToken = null;
    } else {
      items = (raw?.items ?? []).filter(Boolean) as IotRow[];
      nextToken = raw?.nextToken ?? null;
    }

    return { items, nextToken };
  }, []);

  /**
   * 1 Division 分の取得（ページングあり）
   * kind = "iot" なら listIot
   * kind = "agg" なら listIotAgg
   */
  const fetchIotByRangeForDivision = useCallback(
    async (
      start: Date,
      end: Date,
      division: string,
      kind: DataKind,
      seq: number
    ): Promise<IotRow[]> => {
      const result: IotRow[] = [];

      const startDatetime = `${format(
        startOfDay(start),
        "yyyy-MM-dd"
      )} 00:00:00+09:00`;
      const endDatetime = `${format(
        startOfDay(end),
        "yyyy-MM-dd"
      )} 23:59:59+09:00`;

      console.log("=== Query Start ===");
      console.log("dataKind:", kind);
      console.log("Controller:", controller);
      console.log("Division:", division);
      console.log("StartDatetime:", startDatetime);
      console.log("EndDatetime:", endDatetime);

      let nextToken: string | null | undefined = null;
      let page = 0;

      do {
        if (seq !== requestSeqRef.current) {
          console.log("SKIP outdated division request(before query)", {
            seq,
            kind,
            division,
          });
          return [];
        }

        let data: QueryPageData;
        let errors: QueryErrors;

        if (kind === "iot") {
          const res = await client.queries.listIot({
            Controller: controller,
            Division: division,
            StartDatetime: startDatetime,
            EndDatetime: endDatetime,
            nextToken: nextToken ?? undefined,
          });

          if (seq !== requestSeqRef.current) {
            console.log("SKIP outdated division request(after query)", {
              seq,
              kind,
              division,
            });
            return [];
          }

          data = res.data as QueryPageData;
          errors = res.errors as QueryErrors;
        } else {
          const res = await client.queries.listIotAgg({
            Controller: controller,
            Division: division,
            StartDatetime: startDatetime,
            EndDatetime: endDatetime,
            nextToken: nextToken ?? undefined,
          });

          if (seq !== requestSeqRef.current) {
            console.log("SKIP outdated division request(after query)", {
              seq,
              kind,
              division,
            });
            return [];
          }

          data = res.data as QueryPageData;
          errors = res.errors as QueryErrors;
        }

        if (errors?.length) {
          throw new Error(errors.map((e) => e.message).join("\n"));
        }

        const { items, nextToken: newNextToken } = unwrapQueryData(data);

        const normalizedItems = normalizeRows(items, kind);
        nextToken = newNextToken;

        page += 1;

        console.log(
          `[${kind}][${division}] page=${page} items=${normalizedItems.length} nextToken=${
            nextToken ? "あり" : "なし"
          }`
        );

        if (normalizedItems.length > 0) {
          console.log(
            `[${kind}][${division}] first keys=`,
            Object.keys(normalizedItems[0])
          );
          console.log(`[${kind}][${division}] first row=`, normalizedItems[0]);
        }

        result.push(...normalizedItems);
      } while (nextToken);

      if (seq !== requestSeqRef.current) {
        console.log("SKIP outdated division result(final)", {
          seq,
          kind,
          division,
        });
        return [];
      }

      console.log(`[${kind}][${division}] 取得総件数:`, result.length);

      return result;
    },
    [controller, normalizeRows, unwrapQueryData]
  );

  /**
   * 同時数制御つき並列取得
   */
  const fetchIotByRangeAllDivisions = useCallback(
    async (
      start: Date,
      end: Date,
      divisionList: DivisionRow[],
      kind: DataKind,
      seq: number
    ): Promise<IotRow[]> => {
      if (divisionList.length === 0) {
        if (seq === requestSeqRef.current) {
          setProgress(100);
          setProgressCompleted(0);
          setProgressTotal(0);
        }
        return [];
      }

      console.log("=== All Division Fetch Start (parallel) ===");
      console.log("dataKind:", kind);
      console.log("Division count:", divisionList.length);
      console.log("MAX_CONCURRENT_FETCHES:", MAX_CONCURRENT_FETCHES);
      console.log("seq:", seq);

      const resultsByIndex: IotRow[][] = new Array(divisionList.length)
        .fill(null)
        .map(() => []);

      const errors: string[] = [];
      let cursor = 0;
      let completed = 0;
      const total = divisionList.length;

      if (seq === requestSeqRef.current) {
        setProgress(0);
        setProgressCompleted(0);
        setProgressTotal(total);
      }

      const updateProgress = () => {
        if (seq !== requestSeqRef.current) return;

        completed += 1;
        const percent = Math.round((completed / total) * 100);
        setProgress(percent);
        setProgressCompleted(completed);
        setProgressTotal(total);

        console.log(`[progress][${kind}] ${completed}/${total} (${percent}%)`);
      };

      const worker = async (workerId: number) => {
        while (true) {
          if (seq !== requestSeqRef.current) {
            console.log("STOP worker due to stale seq", {
              workerId,
              kind,
              seq,
            });
            return;
          }

          const currentIndex = cursor++;
          if (currentIndex >= divisionList.length) return;

          const target = divisionList[currentIndex];
          const division = target.Division;
          const timerLabel = `[worker:${workerId}][${kind}][seq:${seq}] ${division}`;

          try {
            console.time(timerLabel);
            const rows = await fetchIotByRangeForDivision(
              start,
              end,
              division,
              kind,
              seq
            );
            console.timeEnd(timerLabel);

            if (seq !== requestSeqRef.current) {
              console.log("SKIP outdated worker result", {
                workerId,
                kind,
                division,
                seq,
              });
              return;
            }

            resultsByIndex[currentIndex] = rows;
          } catch (err) {
            console.error(`[worker:${workerId}][${kind}] ${division} error:`, err);

            if (seq !== requestSeqRef.current) {
              return;
            }

            errors.push(
              `[${division}] ${err instanceof Error ? err.message : String(err)}`
            );
            resultsByIndex[currentIndex] = [];
          } finally {
            updateProgress();
          }
        }
      };

      const workerCount = Math.min(MAX_CONCURRENT_FETCHES, divisionList.length);

      await Promise.all(
        Array.from({ length: workerCount }, (_, i) => worker(i + 1))
      );

      if (seq !== requestSeqRef.current) {
        console.log("SKIP outdated merged result", { kind, seq });
        return [];
      }

      if (errors.length > 0) {
        throw new Error(errors.join("\n"));
      }

      const merged = resultsByIndex.flat();

      console.log(`[${kind}] All divisions merged rows:`, merged.length);

      // 最終保険としてもう一度 normalize
      const finalRows = normalizeRows(merged, kind);

      if (finalRows.length > 0) {
        console.log(`[${kind}] final first row keys=`, Object.keys(finalRows[0]));
        console.log(`[${kind}] final first row=`, finalRows[0]);
      }

      const sortedDatetimes = finalRows
        .map(
          (r) =>
            (r?.DeviceDatetime as string | undefined) ??
            (r?.DatetimeAgg as string | undefined)
        )
        .filter(Boolean)
        .sort() as string[];

      console.log(`[${kind}] all min datetime:`, sortedDatetimes[0] ?? null);
      console.log(
        `[${kind}] all max datetime:`,
        sortedDatetimes.length ? sortedDatetimes[sortedDatetimes.length - 1] : null
      );
      console.log("=== All Division Fetch End (parallel) ===");

      if (seq === requestSeqRef.current) {
        setProgress(100);
        setProgressCompleted(total);
        setProgressTotal(total);
      }

      return finalRows;
    },
    [fetchIotByRangeForDivision, normalizeRows]
  );

  /**
   * 日付範囲変更時 / dataKind変更時:
   * 全Division分を取得（キャッシュあり）
   */
  useEffect(() => {
    if (divisions.length === 0) return;
    if (!selectedDivision) return;

    let cancelled = false;
    const seq = ++requestSeqRef.current;

    (async () => {
      const rangeKey = makeRangeCacheKey(startDate, endDate, dataKind);
      const iframeDataKey = makeIframeDataKey(
        startDate,
        endDate,
        dataKind,
        selectedDivision
      );
      const currentViewState = buildViewState(
        selectedDivision,
        startDate,
        endDate,
        dataKind
      );

      latestViewStateRef.current = currentViewState;

      const cached = rangeCacheRef.current.get(rangeKey);
      if (cached) {
        console.log(
          "[range cache hit]",
          rangeKey,
          "rows=",
          cached.length,
          "seq=",
          seq
        );

        if (cancelled || seq !== requestSeqRef.current) return;

        setAllRows(cached);
        setLoading(false);

        setProgress(100);
        setProgressCompleted(divisions.length);
        setProgressTotal(divisions.length);

        const payload: FullPayload = {
          viewState: currentViewState,
          rows: cached,
        };
        latestFullPayloadRef.current = payload;

        if (seq !== requestSeqRef.current) return;
        sendFullPayloadToIframe(payload, iframeDataKey);
        return;
      }

      if (seq === requestSeqRef.current) {
        setLoading(true);
        setProgress(0);
        setProgressCompleted(0);
        setProgressTotal(divisions.length);
        setAllRows([]);
      }

      try {
        const timerLabel = `fetchIotByRangeAllDivisions(parallel)[${dataKind}][seq:${seq}]`;
        console.time(timerLabel);

        const rows = await fetchIotByRangeAllDivisions(
          startDate,
          endDate,
          divisions,
          dataKind,
          seq
        );

        console.timeEnd(timerLabel);

        if (cancelled || seq !== requestSeqRef.current) {
          console.log("SKIP outdated ALL result in effect", { seq, dataKind });
          return;
        }

        rangeCacheRef.current.set(rangeKey, rows);
        setAllRows(rows);

        const payload: FullPayload = {
          viewState: currentViewState,
          rows,
        };
        latestFullPayloadRef.current = payload;

        if (seq !== requestSeqRef.current) return;
        sendFullPayloadToIframe(payload, iframeDataKey);
      } catch (err) {
        console.error(
          `fetchIotByRangeAllDivisions(parallel)[${dataKind}] error:`,
          err
        );

        if (!cancelled && seq === requestSeqRef.current) {
          setAllRows([]);

          const payload: FullPayload = {
            viewState: currentViewState,
            rows: [],
          };
          latestFullPayloadRef.current = payload;

          if (seq === requestSeqRef.current) {
            sendFullPayloadToIframe(payload, iframeDataKey);
          }

          setProgress(100);
        }
      } finally {
        if (!cancelled && seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    startDate,
    endDate,
    divisions,
    selectedDivision,
    dataKind,
    makeRangeCacheKey,
    makeIframeDataKey,
    buildViewState,
    fetchIotByRangeAllDivisions,
    sendFullPayloadToIframe,
  ]);

  /**
   * Division変更時:
   * 再取得せず、親が保持している allRows から選択Divisionの rows を iframe へ再送する
   */
  useEffect(() => {
    if (!selectedDivision) return;
    if (allRows.length === 0) return;

    const nextViewState = buildViewState(
      selectedDivision,
      startDate,
      endDate,
      dataKind
    );
    const prevViewState = prevViewStateRef.current;

    prevViewStateRef.current = nextViewState;
    latestViewStateRef.current = nextViewState;

    if (!prevViewState) return;

    const dateChanged =
      prevViewState.startDay !== nextViewState.startDay ||
      prevViewState.endDay !== nextViewState.endDay;

    const divisionChanged = prevViewState.division !== nextViewState.division;

    const kindChanged = prevViewState.dataKind !== nextViewState.dataKind;

    if (divisionChanged && !dateChanged && !kindChanged) {
      const payload: FullPayload = {
        viewState: nextViewState,
        rows: allRows,
      };

      latestFullPayloadRef.current = payload;

      const iframeDataKey = makeIframeDataKey(
        startDate,
        endDate,
        dataKind,
        selectedDivision
      );

      sendFullPayloadToIframe(payload, iframeDataKey);
    }
  }, [
    selectedDivision,
    startDate,
    endDate,
    dataKind,
    allRows,
    buildViewState,
    makeIframeDataKey,
    sendFullPayloadToIframe,
  ]);

  const viewState = useMemo(
    () => ({
      division: selectedDivision,
      startDay: format(startDate, "yyyy-MM-dd"),
      endDay: format(endDate, "yyyy-MM-dd"),
      dataKind,
    }),
    [selectedDivision, startDate, endDate, dataKind]
  );

  return (
    <main style={{ padding: 12 }}>
      <h2>ListIot2</h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <DatePicker
          selected={startDate}
          onChange={(d) => {
            if (d) setStartDate(d);
          }}
          dateFormat="yyyy-MM-dd"
        />

        <DatePicker
          selected={endDate}
          onChange={(d) => {
            if (d) setEndDate(d);
          }}
          dateFormat="yyyy-MM-dd"
        />

        <select
          value={dataKind}
          onChange={(e) => setDataKind(e.target.value as DataKind)}
        >
          <option value="iot">IotData</option>
          <option value="agg">IotDataAgg</option>
        </select>

        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value)}
        >
          {divisions.map((d) => (
            <option key={d.Division} value={d.Division}>
              {d.DivisionName}
            </option>
          ))}
        </select>

        <span>
          dataKind={viewState.dataKind} / selectedRows={selectedRowsCount} / totalRows=
          {allRows.length} / iframeReady={String(iframeReady)} / loading=
          {String(loading)} / division={viewState.division} / deviceNameMap=
          {deviceNameMap.size} / divisionGeomMap={divisionGeomMap.size}
        </span>
      </div>

      {loading && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            データ取得中... {displayProgress}% ({progressCompleted}/{progressTotal} divisions)
          </div>

          <div
            style={{
              width: "100%",
              height: 14,
              background: "#e5e7eb",
              borderRadius: 9999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${displayProgress}%`,
                height: "100%",
                background: "#2563eb",
                transition: "width 0.25s ease",
              }}
            />
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="/plotly-view/index.html?mode=embed"
        style={{ width: "100%", height: "900px", border: "none" }}
        title="plotly-view"
      />
    </main>
  );
}
