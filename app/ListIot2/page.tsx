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
   * どの rangeKey の rows を最後に送ったか
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

  /**
   * app.js は rows[0] の keys をヘッダ相当として扱う前提なので、
   * page.tsx 側で key / 列名ゆれ / 日時列揺れを吸収しておく。
   */
  const normalizeRows = useCallback((rows: IotRow[], kind: DataKind): IotRow[] => {
    /**
     * null / undefined / 空文字 判定
     */
    const isNilLike = (v: unknown): boolean => {
      return v == null || (typeof v === "string" && v.trim() === "");
    };

    /**
     * 文字列の前後空白除去
     */
    const trimString = (v: unknown): unknown => {
      return typeof v === "string" ? v.trim() : v;
    };

    /**
     * "2026-06-01 00:00:00+09:00" → "2026-06-01T00:00:00+09:00"
     * のように app.js 側で扱いやすい ISO 風にそろえる
     */
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

    /**
     * 数値らしければ number 化
     * - number は壊さず保持（重要）
     * - 空文字は null 化
     * - それ以外の文字列はそのまま残す
     */
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
        .replace(/^["']|["']$/g, "")
        .replace(/[−ー―]/g, "-")
        .replace(/,/g, "");

      if (/^-?\d+(\.\d+)?$/.test(normalized)) {
        const n = Number(normalized);
        if (Number.isFinite(n)) return n;
      }

      return s;
    };

    /**
     * out[target] が空なら out[source] をコピー
     */
    const fillIfEmpty = (
      out: Record<string, unknown>,
      target: string,
      source: string
    ) => {
      if (isNilLike(out[target]) && !isNilLike(out[source])) {
        out[target] = out[source];
      }
    };

    /**
     * 複数候補のうち、最初に値が入っているものを target にコピー
     */
    const fillFromCandidates = (
      out: Record<string, unknown>,
      target: string,
      candidates: string[]
    ) => {
      if (!isNilLike(out[target])) return;

      for (const c of candidates) {
        if (!isNilLike(out[c])) {
          out[target] = out[c];
          return;
        }
      }
    };

    /**
     * agg 用の prefix 自動マッピング
     * 例:
     *   AvgActivePower -> ActivePower
     *   AveActualTemp -> ActualTemp
     *   SumCumulativeEnergy -> CumulativeEnergy
     *   MaxApparentPower -> ApparentPower
     */
    const autoMapByPrefix = (out: Record<string, unknown>) => {
      const keys = Object.keys(out);

      for (const key of keys) {
        const value = out[key];
        if (isNilLike(value)) continue;

        let base: string | null = null;

        if (key.startsWith("Avg")) {
          base = key.replace(/^Avg/, "");
        } else if (key.startsWith("Ave")) {
          base = key.replace(/^Ave/, "");
        } else if (key.startsWith("Sum")) {
          base = key.replace(/^Sum/, "");
        } else if (key.startsWith("Min")) {
          base = key.replace(/^Min/, "");
        } else if (key.startsWith("Max")) {
          base = key.replace(/^Max/, "");
        }

        if (base && isNilLike(out[base])) {
          out[base] = value;
        }
      }
    };

    /**
     * 別名マッピング（必要に応じて拡張）
     * prefix では吸いきれないものをここで補完
     */
    const applyAliasMapping = (out: Record<string, unknown>, kind: DataKind) => {
      // 共通
      fillIfEmpty(out, "DeviceType", "Type");
      fillIfEmpty(out, "Device", "DeviceName");
      fillIfEmpty(out, "DeviceName", "Device");
      fillIfEmpty(out, "DivisionAgg", "Division");
      fillIfEmpty(out, "Division", "DivisionAgg");

      // iot / agg 共通のよくある差異
      fillIfEmpty(out, "ActualTemp", "AvgActualTemp");
      fillIfEmpty(out, "ActualTemp", "AveActualTemp");

      fillIfEmpty(out, "ActualHumidity", "AvgActualHumidity");
      fillIfEmpty(out, "ActualHumidity", "AveActualHumidity");

      fillIfEmpty(out, "ActivePower", "AvgActivePower");
      fillIfEmpty(out, "ActivePower", "AveActivePower");

      fillIfEmpty(out, "ApparentPower", "AvgApparentPower");
      fillIfEmpty(out, "ApparentPower", "AveApparentPower");

      fillIfEmpty(out, "CumulativeEnergy", "SumCumulativeEnergy");

      // CumulativeEnergy の候補順位（必要に応じて調整）
      fillFromCandidates(out, "CumulativeEnergy", [
        "SumCumulativeEnergy",
        "CumulativeEnergyLast",
        "CumulativeEnergyEnd",
        "CumulativeEnergyStart",
        "CumulativeEnergyMax",
        "CumulativeEnergyMin",
      ]);

      // EnergyDeltaPerEffectiveMinute の候補
      fillFromCandidates(out, "EnergyDeltaPerEffectiveMinute", [
        "EnergyDeltaPerEffectiveMinute",
        "EnergyDeltaPerMinute",
        "EnergyDelta",
      ]);

      // 外気温（WtTemp）
      fillFromCandidates(out, "WtTemp", [
        "WtTemp",
        "OutsideTemp",
        "OutdoorTemp",
        "ExternalTemp",
        "OAT",
      ]);

      // agg で特に重要な prefix 自動吸収
      if (kind === "agg") {
        autoMapByPrefix(out);
      }
    };

    const normalized = rows
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const src = row as Record<string, unknown>;
        const out: Record<string, unknown> = {};

        // --------------------------------------------------
        // 1) key / value 基本コピー
        // --------------------------------------------------
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

        // --------------------------------------------------
        // 2) 別名マッピング / prefix 自動マッピング
        // --------------------------------------------------
        applyAliasMapping(out, kind);

        // --------------------------------------------------
        // 3) Datetime 系補完（最重要）
        // dataKind ごとに優先順位を分ける
        // --------------------------------------------------
        let primaryTs: unknown = null;

        if (kind === "agg") {
          primaryTs =
            !isNilLike(out["DatetimeAgg"])
              ? out["DatetimeAgg"]
              : !isNilLike(out["DeviceDatetime"])
              ? out["DeviceDatetime"]
              : !isNilLike(out["DeviceTimestamp"])
              ? out["DeviceTimestamp"]
              : null;
        } else {
          primaryTs =
            !isNilLike(out["DeviceDatetime"])
              ? out["DeviceDatetime"]
              : !isNilLike(out["DatetimeAgg"])
              ? out["DatetimeAgg"]
              : !isNilLike(out["DeviceTimestamp"])
              ? out["DeviceTimestamp"]
              : null;
        }

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

        // --------------------------------------------------
        // 4) app.js が fields 判定で見落としにくいように
        //    主要キーは必ず存在させる
        // --------------------------------------------------
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

          // よく使うメトリクス
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

    // --------------------------------------------------
    // 5) 先頭行に全キーをそろえて rows[0] 判定のブレを防ぐ
    // --------------------------------------------------
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
  }, []);

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
   * Division変更時に使用
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
   * 日付変更時 / dataKind変更時に使用
   */
  const sendFullPayloadToIframe = useCallback(
    (payload: FullPayload, dataKey: string) => {
      latestFullPayloadRef.current = payload;
      latestViewStateRef.current = payload.viewState;

      if (!iframeReady) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;

      const origin = getTargetOrigin();

      console.log("[postMessage] SET_VIEWSTATE", payload.viewState);
      console.log("[postMessage] SET_DATA rows=", payload.rows.length);
      if (payload.rows.length > 0) {
        console.log("[postMessage] first row keys=", Object.keys(payload.rows[0]));
        console.log("[postMessage] first row=", payload.rows[0]);
        console.log(
          "[postMessage] first row DatetimeAgg=",
          payload.rows[0]["DatetimeAgg"]
        );
        console.log(
          "[postMessage] first row DeviceDatetime=",
          payload.rows[0]["DeviceDatetime"]
        );
        console.log(
          "[postMessage] first row DeviceTimestamp=",
          payload.rows[0]["DeviceTimestamp"]
        );
        console.log(
          "[postMessage] first row DivisionAgg=",
          payload.rows[0]["DivisionAgg"]
        );
        console.log("[postMessage] first row Device=", payload.rows[0]["Device"]);
      }

      // app.js の想定どおり、先に viewState、そのあと rows
      win.postMessage({ type: "SET_VIEWSTATE", ...payload.viewState }, origin);
      win.postMessage({ type: "SET_DATA", rows: payload.rows }, origin);

      lastSentDataKeyRef.current = dataKey;
    },
    [iframeReady, getTargetOrigin]
  );

  /**
   * iframe READY待ち
   */
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      // 必要なら origin も見る
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

    const rangeKey = makeRangeCacheKey(startDate, endDate, dataKind);

    if (
      latestFullPayloadRef.current &&
      lastSentDataKeyRef.current !== rangeKey
    ) {
      sendFullPayloadToIframe(latestFullPayloadRef.current, rangeKey);
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
    makeRangeCacheKey,
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
        setDivisions(list);

        if (list.length > 0) {
          setSelectedDivision((prev) => prev || list[0].Division);
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
      items = ((raw?.items ?? []).filter(Boolean) as IotRow[]);
      nextToken = raw?.nextToken ?? null;
    }

    return { items, nextToken };
  }, []);

  /**
   * 1 Division 分の取得（ページングあり）
   * kind = "iot" なら listIot
   * kind = "agg" なら listIotAgg
   *
   * ✅ seq を受け取り、古い結果を返さない
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

      const startDatetime = `${format(startOfDay(start), "yyyy-MM-dd")} 00:00:00+09:00`;
      const endDatetime = `${format(startOfDay(end), "yyyy-MM-dd")} 23:59:59+09:00`;

      console.log("=== Query Start ===");
      console.log("dataKind:", kind);
      console.log("Controller:", controller);
      console.log("Division:", division);
      console.log("StartDatetime:", startDatetime);
      console.log("EndDatetime:", endDatetime);

      let nextToken: string | null | undefined = null;
      let page = 0;

      do {
        // stale request は即中断
        if (seq !== requestSeqRef.current) {
          console.log("SKIP outdated division request(before query)", { seq, kind, division });
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
            console.log("SKIP outdated division request(after query)", { seq, kind, division });
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
            console.log("SKIP outdated division request(after query)", { seq, kind, division });
            return [];
          }

          data = res.data as QueryPageData;
          errors = res.errors as QueryErrors;
        }

        if (errors?.length) {
          throw new Error(errors.map((e) => e.message).join("\n"));
        }

        const { items, nextToken: newNextToken } = unwrapQueryData(data);

        if (kind === "agg") {
          console.log("RAW AGG DATA", items);
        }

        const normalizedItems = normalizeRows(items, kind);
        nextToken = newNextToken;

        page += 1;

        console.log(
          `[${kind}][${division}] page=${page} items=${normalizedItems.length} nextToken=${nextToken ? "あり" : "なし"}`
        );

        if (normalizedItems.length > 0) {
          console.log(
            `[${kind}][${division}] first keys=`,
            Object.keys(normalizedItems[0])
          );
          console.log(
            `[${kind}][${division}] first row=`,
            normalizedItems[0]
          );
        }

        result.push(...normalizedItems);
      } while (nextToken);

      if (seq !== requestSeqRef.current) {
        console.log("SKIP outdated division result(final)", { seq, kind, division });
        return [];
      }

      console.log(`[${kind}][${division}] 取得総件数:`, result.length);

      return result;
    },
    [controller, normalizeRows, unwrapQueryData]
  );

  /**
   * 同時数制御つき並列取得
   *
   * ✅ seq を受け取り、古い worker / 結果を無効化
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
            console.log("STOP worker due to stale seq", { workerId, kind, seq });
            return;
          }

          const currentIndex = cursor++;
          if (currentIndex >= divisionList.length) return;

          const target = divisionList[currentIndex];
          const division = target.Division;
          const timerLabel = `[worker:${workerId}][${kind}][seq:${seq}] ${division}`;

          try {
            console.time(timerLabel);
            const rows = await fetchIotByRangeForDivision(start, end, division, kind, seq);
            console.timeEnd(timerLabel);

            if (seq !== requestSeqRef.current) {
              console.log("SKIP outdated worker result", { workerId, kind, division, seq });
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
      const currentViewState = buildViewState(
        selectedDivision,
        startDate,
        endDate,
        dataKind
      );

      latestViewStateRef.current = currentViewState;

      const cached = rangeCacheRef.current.get(rangeKey);
      if (cached) {
        console.log("[range cache hit]", rangeKey, "rows=", cached.length, "seq=", seq);

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
        sendFullPayloadToIframe(payload, rangeKey);
        return;
      }

      if (seq === requestSeqRef.current) {
        setLoading(true);
        setProgress(0);
        setProgressCompleted(0);
        setProgressTotal(divisions.length);
        // stale UI を消す
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
        sendFullPayloadToIframe(payload, rangeKey);
      } catch (err) {
        console.error(`fetchIotByRangeAllDivisions(parallel)[${dataKind}] error:`, err);

        if (!cancelled && seq === requestSeqRef.current) {
          setAllRows([]);

          const payload: FullPayload = {
            viewState: currentViewState,
            rows: [],
          };
          latestFullPayloadRef.current = payload;

          if (seq === requestSeqRef.current) {
            sendFullPayloadToIframe(payload, rangeKey);
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
    buildViewState,
    fetchIotByRangeAllDivisions,
    sendFullPayloadToIframe,
  ]);

  /**
   * Division変更時:
   * 再取得せず viewState だけ送る
   *
   * ※ dataKind変更時は別データ取得が必要なので、このuseEffectではなく
   *    上の「日付範囲変更時 / dataKind変更時」のuseEffectで full fetch させる
   */
  useEffect(() => {
    if (!selectedDivision) return;

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

    const divisionChanged =
      prevViewState.division !== nextViewState.division;

    const kindChanged =
      prevViewState.dataKind !== nextViewState.dataKind;

    if (divisionChanged && !dateChanged && !kindChanged) {
      sendViewStateToIframe(nextViewState);
    }
  }, [
    selectedDivision,
    startDate,
    endDate,
    dataKind,
    buildViewState,
    sendViewStateToIframe,
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
          {String(loading)} / division={viewState.division}
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