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

import {
  buildDeviceNameMap,
  buildDivisionNameMap,
  enrichWithMasterNames,
} from "@/app/lib/masterEnrich";

Amplify.configure(outputs);
const client = generateClient<Schema>();

type DivisionRow = {
  Division: string;
  DivisionName: string;

  // Map/Babylon 用
  // DynamoDB / AppSync 側に存在する場合、そのまま map-app.js へ渡す
  DivisionOutline?: unknown;
  divisionOutline?: unknown;
  DivisionPolygon?: unknown;
  divisionPolygon?: unknown;
  Polygon?: unknown;
  polygon?: unknown;
  Height?: number | string | null;
  height?: number | string | null;
};

type DeviceRow = {
  Device: string;
  DeviceName?: string | null;
  Controller?: string | null;
  DeviceType?: string | null;
  Division?: string | null;

  // Map/Babylon 用
  Longitude?: number | string | null;
  longitude?: number | string | null;
  Lon?: number | string | null;
  lon?: number | string | null;
  Latitude?: number | string | null;
  latitude?: number | string | null;
  Lat?: number | string | null;
  lat?: number | string | null;
  Height?: number | string | null;
  height?: number | string | null;
  Rotation?: number | string | null;
  rotation?: number | string | null;
  Rot?: number | string | null;
  rot?: number | string | null;
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
  const iframeRef = useRef<HTMLIFrameElement>(null); // Plotly
  const mapIframeRef = useRef<HTMLIFrameElement>(null); // Map

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [selectedDivision, setSelectedDivision] = useState("");

  // Device master 全体
  // Map iframe へ Device配置情報を送るために保持する
  const [deviceRows, setDeviceRows] = useState<DeviceRow[]>([]);

  // マスタ由来の DeviceCode -> DeviceName map
  const [deviceNameMap, setDeviceNameMap] = useState<Map<string, string>>(
    new Map()
  );

  const [divisionNameMap, setDivisionNameMap] = useState<Map<string, string>>(
    new Map()
  );

  // IotData / IotDataAgg の切替
  const [dataKind, setDataKind] = useState<DataKind>("iot");

  const [iframeReady, setIframeReady] = useState(false); // Plotly ready
  const [mapReady, setMapReady] = useState(false); // Map ready

  const [allRows, setAllRows] = useState<IotRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 進捗表示用
  const [progress, setProgress] = useState(0);
  const [progressCompleted, setProgressCompleted] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  const controller = "Mutsu01";

  /**
   * Division単位のキャッシュ
   * key = controller|division|dataKind|yyyy-MM-dd|yyyy-MM-dd
   */
  const rangeCacheRef = useRef<Map<string, IotRow[]>>(new Map());

  /**
   * iframe未準備時にあとで送る用
   */
  const latestViewStateRef = useRef<ViewState | null>(null);
  const latestFullPayloadRef = useRef<FullPayload | null>(null);

  /**
   * どの iframeDataKey の rows を最後に送ったか
   */
  const lastSentDataKeyRef = useRef<string>("");

  const buildViewState = useCallback(
    (division: string, start: Date, end: Date, kind: DataKind): ViewState => ({
      division,
      startDay: format(start, "yyyy-MM-dd"),
      endDay: format(end, "yyyy-MM-dd"),
      dataKind: kind,
    }),
    []
  );

  /**
   * キャッシュキー（Division込み）
   */
  const makeRangeCacheKey = useCallback(
    (start: Date, end: Date, kind: DataKind, division: string) =>
      [
        controller,
        division,
        kind,
        format(startOfDay(start), "yyyy-MM-dd"),
        format(startOfDay(end), "yyyy-MM-dd"),
      ].join("|"),
    [controller]
  );

  /**
   * iframeへ送ったデータを識別するキー
   */
  const makeIframeDataKey = useCallback(
    (start: Date, end: Date, kind: DataKind, division: string) =>
      [
        controller,
        division,
        kind,
        format(startOfDay(start), "yyyy-MM-dd"),
        format(startOfDay(end), "yyyy-MM-dd"),
      ].join("|"),
    [controller]
  );

  /**
   * UI表示用
   * allRows は常に選択Division 分だけ保持するため、そのまま件数になる
   */
  const selectedRowsCount = useMemo(() => allRows.length, [allRows]);

  /**
   * startDate ～ endDate を 1日ずつ列挙
   */
  const enumerateDays = useCallback((start: Date, end: Date): Date[] => {
    const arr: Date[] = [];
    const d = new Date(startOfDay(start));
    const last = new Date(startOfDay(end));

    while (d <= last) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }

    return arr;
  }, []);

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
            // DeviceName <- Device はしない
            fillIfEmpty(out, "DivisionAgg", "Division");
            fillIfEmpty(out, "Division", "DivisionAgg");

            // マスタから DeviceName / DivisionName を補完
            enrichWithMasterNames(out, {
              deviceNameMap,
              divisionNameMap,
            });

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
                out.DeviceTimestamp = normalizeDateTimeString(
                  out.DeviceTimestamp
                );
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

            // ① 基本コピー
            for (const [rawKey, rawValue] of Object.entries(src)) {
              const key = String(rawKey).trim();

              const value =
                key === "DatetimeAgg"
                  ? trimStringLocal(rawValue)
                  : tryNormalizeScalarLocal(trimStringLocal(rawValue));

              out[key] = value;
            }

            // ② 共通別名補完
            if (isNilLikeLocal(out["DivisionAgg"])) {
              out["DivisionAgg"] = out["Division"];
            }
            if (isNilLikeLocal(out["Division"])) {
              out["Division"] = out["DivisionAgg"];
            }

            if (isNilLikeLocal(out["Device"])) {
              out["Device"] = out["DeviceName"];
            }
            // DeviceName <- Device はしない

            if (isNilLikeLocal(out["DeviceType"])) {
              out["DeviceType"] = out["Type"];
            }

            // マスタから DeviceName / DivisionName を補完
            enrichWithMasterNames(out, {
              deviceNameMap,
              divisionNameMap,
            });

            // ③ 集計列 → 通常列マッピング
            if (
              !isNilLikeLocal(out["AvgActivePower"]) &&
              isNilLikeLocal(out["ActivePower"])
            ) {
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

            if (
              !isNilLikeLocal(out["AvgActualTemp"]) &&
              isNilLikeLocal(out["ActualTemp"])
            ) {
              out["ActualTemp"] = out["AvgActualTemp"];
            }

            if (
              !isNilLikeLocal(out["AvgActualHumidity"]) &&
              isNilLikeLocal(out["ActualHumidity"])
            ) {
              out["ActualHumidity"] = out["AvgActualHumidity"];
            }

            if (
              !isNilLikeLocal(out["AvgWtTemp"]) &&
              isNilLikeLocal(out["WtTemp"])
            ) {
              out["WtTemp"] = out["AvgWtTemp"];
            }

            if (
              !isNilLikeLocal(out["SumEnergyDeltaPerEffectiveMinute"]) &&
              isNilLikeLocal(out["EnergyDeltaPerEffectiveMinute"])
            ) {
              out["EnergyDeltaPerEffectiveMinute"] =
                out["SumEnergyDeltaPerEffectiveMinute"];
            }

            // ④ DatetimeAgg取得
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
              }
            }

            // fallback（DeviceDatetime）
            if (!ts && !isNilLikeLocal(src["DeviceDatetime"])) {
              ts = normalizeDateTimeStringLocal(src["DeviceDatetime"]);
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
            }

            // ⑤ 必須キー補完
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
              if (!(k in out)) out[k] = null;
            }

            return out;
          });

        return finalizeFirstRowKeys(normalized);
      };

      if (kind === "agg") {
        return normalizeAggRows(rows);
      }
      return normalizeIotRows(rows);
    },
    [deviceNameMap, divisionNameMap]
  );

  /**
   * postMessage 送信先 origin
   */
  const getTargetOrigin = useCallback(() => {
    return window.location.origin;
  }, []);

  /**
   * iframeへ viewState だけ送る
   * Plotly / Map 両方へ送る
   */
  const sendViewStateToIframe = useCallback(
    (viewState: ViewState) => {
      latestViewStateRef.current = viewState;

      const origin = getTargetOrigin();

      if (iframeReady) {
        const plotWin = iframeRef.current?.contentWindow;
        if (plotWin) {
          console.log("[postMessage] SET_VIEWSTATE -> plotly", viewState);
          plotWin.postMessage({ type: "SET_VIEWSTATE", ...viewState }, origin);
        }
      }

      if (mapReady) {
        const mapWin = mapIframeRef.current?.contentWindow;
        if (mapWin) {
          console.log("[postMessage] SET_VIEWSTATE -> map", viewState);
          mapWin.postMessage({ type: "SET_VIEWSTATE", ...viewState }, origin);
        }
      }
    },
    [iframeReady, mapReady, getTargetOrigin]
  );

  /**
   * iframeへ viewState + rows を送る
   * Plotly:
   *   SET_VIEWSTATE / SET_DATA
   *
   * Map:
   *   MAP_SET_ALL
   *   - divisions: Division master
   *   - devices: Device master
   *   - rows: IoT rows
   */
  const sendFullPayloadToIframe = useCallback(
    (payload: FullPayload, dataKey: string) => {
      latestFullPayloadRef.current = payload;
      latestViewStateRef.current = payload.viewState;

      console.log("[SEND ENTRY]", {
        dataKey,
        rows: payload.rows.length,
        divisions: divisions.length,
        devices: deviceRows.length,
        iframeReady,
        mapReady,
        hasPlotWindow: !!iframeRef.current?.contentWindow,
        hasMapWindow: !!mapIframeRef.current?.contentWindow,
        viewState: payload.viewState,
      });

      const origin = getTargetOrigin();

      if (!iframeReady && !mapReady) {
        console.log("[SEND SKIP] both iframes are not ready");
        return;
      }

      const plotWin = iframeRef.current?.contentWindow;
      if (iframeReady && plotWin) {
        plotWin.postMessage({ type: "SET_VIEWSTATE", ...payload.viewState }, origin);
        plotWin.postMessage({ type: "SET_DATA", rows: payload.rows }, origin);

        console.log("[SEND DATA] -> plotly", {
          rows: payload.rows.length,
          viewState: payload.viewState,
        });
      }

      const mapWin = mapIframeRef.current?.contentWindow;
      if (mapReady && mapWin) {
        // 既存Adapter向けに viewState も送る
        mapWin.postMessage({ type: "SET_VIEWSTATE", ...payload.viewState }, origin);

        // Map/Babylon 側の新しい受信口
        mapWin.postMessage(
          {
            type: "MAP_SET_ALL",
            divisions,
            devices: deviceRows,
            rows: payload.rows,
          },
          origin
        );

        console.log("[SEND DATA] -> map MAP_SET_ALL", {
          divisions: divisions.length,
          devices: deviceRows.length,
          rows: payload.rows.length,
          viewState: payload.viewState,
        });
      }

      lastSentDataKeyRef.current = dataKey;
    },
    [
      iframeReady,
      mapReady,
      getTargetOrigin,
      divisions,
      deviceRows,
    ]
  );

  /**
   * iframe READY待ち + iframe側からのDivision変更通知を受け取る
   */
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      console.log("[PARENT RECV RAW]", {
        origin: event.origin,
        type: event.data?.type,
        hasPlotIframeWindow: !!iframeRef.current?.contentWindow,
        hasMapIframeWindow: !!mapIframeRef.current?.contentWindow,
        samePlotSource: event.source === iframeRef.current?.contentWindow,
        sameMapSource: event.source === mapIframeRef.current?.contentWindow,
      });

      if (event.origin !== window.location.origin) return;

      // PLOTLY_READY
      if (event.data?.type === "PLOTLY_READY") {
        console.log("[iframe] PLOTLY_READY");
        setIframeReady(true);
        return;
      }

      // MAP_READY
      if (event.data?.type === "MAP_READY") {
        console.log("[iframe] MAP_READY");
        setMapReady(true);
        return;
      }

      // sourceチェックは READY 以外で行う
      const isPlotSource = event.source === iframeRef.current?.contentWindow;
      const isMapSource = event.source === mapIframeRef.current?.contentWindow;

      if (!isPlotSource && !isMapSource) return;

      // Division変更通知は現状 Plotly 側想定
      if (event.data?.type === "DIVISION_CHANGED") {
        const nextDivision = String(event.data?.division ?? "").trim();
        if (!nextDivision) return;

        console.log("[iframe] DIVISION_CHANGED", nextDivision);
        setSelectedDivision(nextDivision);
        return;
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  /**
   * iframe readyになったら最新状態を流す
   * Plotly ready / Map ready のどちらかが変化したら最新payloadを再送
   *
   * divisions / deviceRows が後からロードされた場合も、
   * sendFullPayloadToIframe の依存関係経由で再送される。
   */
  useEffect(() => {
    if (!iframeReady && !mapReady) return;

    const iframeDataKey = makeIframeDataKey(
      startDate,
      endDate,
      dataKind,
      selectedDivision
    );

    if (latestFullPayloadRef.current) {
      sendFullPayloadToIframe(latestFullPayloadRef.current, iframeDataKey);
      return;
    }

    if (latestViewStateRef.current) {
      sendViewStateToIframe(latestViewStateRef.current);
    }
  }, [
    iframeReady,
    mapReady,
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

        const sorted = [...list].sort((a, b) =>
          String(a.DivisionName ?? "").localeCompare(
            String(b.DivisionName ?? ""),
            "ja"
          )
        );

        console.log("[MASTER] divisions loaded", {
          count: sorted.length,
          first: sorted[0],
        });

        setDivisions(sorted);
        setDivisionNameMap(buildDivisionNameMap(sorted));

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

        console.log("deviceRows sample raw", list[0]);

        const map = buildDeviceNameMap(list);

        console.log("[MASTER] devices loaded", {
          count: list.length,
          first: list[0],
        });
        console.log("deviceNameMap size=", map.size);

        setDeviceRows(list);
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
   * - DeviceName
   * - DivisionName
   */
  useEffect(() => {
    if (deviceNameMap.size === 0 && divisionNameMap.size === 0) return;

    // cache の再normalize
    if (rangeCacheRef.current.size > 0) {
      const nextCache = new Map<string, IotRow[]>();

      for (const [key, rows] of rangeCacheRef.current.entries()) {
        const parts = key.split("|");
        const kind = (parts[2] === "agg" ? "agg" : "iot") as DataKind;
        nextCache.set(key, normalizeRows(rows, kind));
      }

      rangeCacheRef.current = nextCache;
    }

    // 現在 rows の再normalize
    if (allRows.length > 0 && selectedDivision) {
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceNameMap, divisionNameMap]);

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
      kind: DataKind
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
          `[${kind}][${division}] page=${page} items=${
            normalizedItems.length
          } nextToken=${nextToken ? "あり" : "なし"}`
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

      console.log(`[${kind}][${division}] 取得総件数:`, result.length);

      return result;
    },
    [controller, normalizeRows, unwrapQueryData]
  );

  /**
   * 日付範囲変更時 / dataKind変更時 / Division変更時:
   * 選択中Divisionのみ取得（キャッシュあり）
   * 日単位で取得し、進捗バーを更新
   */
  useEffect(() => {
    if (deviceNameMap.size === 0) return;
    if (!selectedDivision) return;

    let cancelled = false;

    (async () => {
      const rangeKey = makeRangeCacheKey(
        startDate,
        endDate,
        dataKind,
        selectedDivision
      );

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

      const days = enumerateDays(startDate, endDate);

      // キャッシュヒット時も progress 表示を整える
      const cached = rangeCacheRef.current.get(rangeKey);
      if (cached) {
        console.log("[range cache hit]", rangeKey, "rows=", cached.length);

        if (cancelled) return;

        setProgressTotal(days.length);
        setProgressCompleted(days.length);
        setProgress(100);

        setAllRows(cached);
        setLoading(false);

        const payload: FullPayload = {
          viewState: currentViewState,
          rows: cached,
        };

        latestFullPayloadRef.current = payload;

        sendFullPayloadToIframe(payload, iframeDataKey);
        return;
      }

      setLoading(true);
      setAllRows([]);

      setProgressTotal(days.length);
      setProgressCompleted(0);
      setProgress(0);

      const all: IotRow[] = [];

      try {
        for (let i = 0; i < days.length; i++) {
          const day = days[i];

          console.log("[DAY FETCH]", format(day, "yyyy-MM-dd"));

          const rows = await fetchIotByRangeForDivision(
            day,
            day,
            selectedDivision,
            dataKind
          );

          if (cancelled) return;

          all.push(...rows);

          const completed = i + 1;
          const percent = Math.round((completed / days.length) * 100);

          setProgressCompleted(completed);
          setProgress(percent);
        }

        if (cancelled) return;

        rangeCacheRef.current.set(rangeKey, all);
        setAllRows(all);

        const payload: FullPayload = {
          viewState: currentViewState,
          rows: all,
        };

        latestFullPayloadRef.current = payload;

        sendFullPayloadToIframe(payload, iframeDataKey);
      } catch (err) {
        console.error(`day fetch error [${dataKind}]`, err);

        if (!cancelled) {
          setAllRows([]);

          const payload: FullPayload = {
            viewState: currentViewState,
            rows: [],
          };

          latestFullPayloadRef.current = payload;

          sendFullPayloadToIframe(payload, iframeDataKey);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    deviceNameMap,
    startDate,
    endDate,
    selectedDivision,
    dataKind,
    enumerateDays,
    makeRangeCacheKey,
    makeIframeDataKey,
    buildViewState,
    fetchIotByRangeForDivision,
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

        {/* app.js 側のリストボックスに一本化するなら、この select は削除してOK */}
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
          dataKind={viewState.dataKind} / selectedRows={selectedRowsCount} /
          totalRows={allRows.length} / iframeReady={String(iframeReady)} /
          mapReady={String(mapReady)} / loading={String(loading)} /
          division={viewState.division} / deviceNameMap={deviceNameMap.size} /
          divisions={divisions.length} / devices={deviceRows.length}
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
            データ取得中... {progress}% ({progressCompleted}/{progressTotal} days)
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
                width: `${progress}%`,
                height: "100%",
                background: "#2563eb",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Plotly iframe */}
      <iframe
        ref={iframeRef}
        src="/plotly-view/index.html?mode=embed"
        style={{ width: "100%", height: "900px", border: "none" }}
        title="plotly-view"
        onLoad={() => {
          console.log("[plotly iframe onLoad] loaded");
          console.log(
            "[plotly iframe onLoad] contentWindow=",
            !!iframeRef.current?.contentWindow
          );
        }}
      />

      {/* Map iframe */}
      <iframe
        ref={mapIframeRef}
        src="/plotly-view/map-index.html"
        style={{
          width: "100%",
          height: "700px",
          border: "none",
          marginTop: 16,
        }}
        title="maplibre-view"
        onLoad={() => {
          console.log("[map iframe onLoad] loaded");
          console.log(
            "[map iframe onLoad] contentWindow=",
            !!mapIframeRef.current?.contentWindow
          );

          // map-app.js 側の MAP_READY を基本にするが、
          // onLoad時点でも contentWindow が存在するため最低限 ready 扱いにする
          setMapReady(true);
        }}
      />
    </main>
  );
}