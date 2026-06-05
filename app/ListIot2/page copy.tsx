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
     * 文字列の前後空白除去
     */
    const trimString = (v: unknown): unknown => {
      return typeof v === "string" ? v.trim() : v;
    };

    /**
     * "2026-06-01 00:00:00+09:00" → "2026-06-01T00:00:00+09:00"
     * のように、app.js 側で扱いやすい ISO 風に寄せる
     */
    const normalizeDateTimeString = (v: unknown): unknown => {
      if (typeof v !== "string") return v;

      let s = v.trim();
      if (!s) return s;

      // "YYYY-MM-DD HH:mm:ss+09:00" → "YYYY-MM-DDTHH:mm:ss+09:00"
      if (s.includes(" ") && !s.includes("T")) {
        s = s.replace(" ", "T");
      }

      // 末尾に timezone が無い場合は +09:00 を補完
      // 例: 2026-06-01T00:00:00 → 2026-06-01T00:00:00+09:00
      if (
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) &&
        !/[zZ]$|[+\-]\d{2}:\d{2}$/.test(s)
      ) {
        s += "+09:00";
      }

      return s;
    };

    /**
     * null / undefined / 空文字 の判定
     */
    const isNilLike = (v: unknown): boolean => {
      return v == null || (typeof v === "string" && v.trim() === "");
    };

    /**
     * 数値らしければ number 化、それ以外は元のまま
     * app.js 側は toNum() を持っているので必須ではないが、
     * 行データの揺れを少しでも減らす用途で使用
     */
    const tryNormalizeScalar = (v: unknown): unknown => {
      if (v == null) return v;
      if (typeof v === "number") return v;
      if (typeof v !== "string") return v;

      const s = v.trim();
      if (s === "") return s;

      // 数値候補だけ number 化
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
     * まず各 row の key / value をざっと掃除
     * - key 前後空白除去
     * - value 前後空白除去
     * - datetime っぽい列は ISO 風に寄せる
     */
    const normalized = rows
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const src = row as Record<string, unknown>;
        const out: Record<string, unknown> = {};

        // --------------------------------------------------
        // 1) key の前後空白を除去してコピー
        // --------------------------------------------------
        for (const [rawKey, rawValue] of Object.entries(src)) {
          const key = String(rawKey).trim();
          let value = trimString(rawValue);

          // datetime 系は先に文字列表現を揃える
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
        // 2) Division 系を揃える
        // app.js は DivisionAgg 優先 / なければ Division
        // --------------------------------------------------
        if (isNilLike(out.DivisionAgg) && !isNilLike(out.Division)) {
          out.DivisionAgg = out.Division;
        }
        if (isNilLike(out.Division) && !isNilLike(out.DivisionAgg)) {
          out.Division = out.DivisionAgg;
        }

        // --------------------------------------------------
        // 3) Device 系を揃える
        // app.js は Device 優先 / なければ DeviceName
        // --------------------------------------------------
        if (isNilLike(out.Device) && !isNilLike(out.DeviceName)) {
          out.Device = out.DeviceName;
        }
        if (isNilLike(out.DeviceName) && !isNilLike(out.Device)) {
          out.DeviceName = out.Device;
        }

        // --------------------------------------------------
        // 4) DeviceType の別名吸収（必要ならここで拡張）
        // --------------------------------------------------
        if (isNilLike(out.DeviceType) && !isNilLike(out.Type)) {
          out.DeviceType = out.Type;
        }

        // --------------------------------------------------
        // 5) Datetime 系を揃える（最重要）
        //
        // app.js の時刻候補:
        //   ["DatetimeAgg", "DeviceDatetime", "DeviceTimestamp"]
        //
        // embed では rows[0] の keys を見て列候補を作るので、
        // 少なくともこの3列は可能な限り埋めておくと安定する
        // --------------------------------------------------
        const primaryTs =
          !isNilLike(out.DeviceDatetime)
            ? out.DeviceDatetime
            : !isNilLike(out.DatetimeAgg)
            ? out.DatetimeAgg
            : !isNilLike(out.DeviceTimestamp)
            ? out.DeviceTimestamp
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

        // --------------------------------------------------
        // 6) app.js 側で存在チェックされる可能性がある列を必要に応じて補完
        // --------------------------------------------------
        if (isNilLike(out.DivisionName) && !isNilLike(out.DivisionAgg)) {
          out.DivisionName = out.DivisionAgg;
        }

        // --------------------------------------------------
        // 7) agg 用の列名差異吸収（必要に応じてここを拡張）
        // --------------------------------------------------
        if (kind === "agg") {
          // 例:
          // if (isNilLike(out.ActualTemp) && !isNilLike(out.AvgActualTemp)) {
          //   out.ActualTemp = out.AvgActualTemp;
          // }
          // if (isNilLike(out.ActivePower) && !isNilLike(out.AvgActivePower)) {
          //   out.ActivePower = out.AvgActivePower;
          // }
          // if (isNilLike(out.CumulativeEnergy) && !isNilLike(out.SumCumulativeEnergy)) {
          //   out.CumulativeEnergy = out.SumCumulativeEnergy;
          // }
        }

        // --------------------------------------------------
        // 8) Object.keys(rows[0]) に欲しい列をなるべく安定して出すため、
        //    主要列が欠損していても key だけは作る
        // --------------------------------------------------
        if (!("DivisionAgg" in out)) out.DivisionAgg = null;
        if (!("Division" in out)) out.Division = null;
        if (!("Device" in out)) out.Device = null;
        if (!("DeviceName" in out)) out.DeviceName = null;
        if (!("DeviceType" in out)) out.DeviceType = null;
        if (!("DatetimeAgg" in out)) out.DatetimeAgg = null;
        if (!("DeviceDatetime" in out)) out.DeviceDatetime = null;
        if (!("DeviceTimestamp" in out)) out.DeviceTimestamp = null;

        return out;
      });

    // --------------------------------------------------
    // 9) 先頭行に必要 key が無いと app.js 側の fields 判定がブレるので、
    //    すべての row に出現した key を先頭 row にも揃える
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
   */
  const fetchIotByRangeForDivision = useCallback(
    async (
      start: Date,
      end: Date,
      division: string,
      kind: DataKind
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
      kind: DataKind
    ): Promise<IotRow[]> => {
      if (divisionList.length === 0) {
        setProgress(100);
        setProgressCompleted(0);
        setProgressTotal(0);
        return [];
      }

      console.log("=== All Division Fetch Start (parallel) ===");
      console.log("dataKind:", kind);
      console.log("Division count:", divisionList.length);
      console.log("MAX_CONCURRENT_FETCHES:", MAX_CONCURRENT_FETCHES);

      const resultsByIndex: IotRow[][] = new Array(divisionList.length)
        .fill(null)
        .map(() => []);

      const errors: string[] = [];
      let cursor = 0;
      let completed = 0;
      const total = divisionList.length;

      setProgress(0);
      setProgressCompleted(0);
      setProgressTotal(total);

      const updateProgress = () => {
        completed += 1;
        const percent = Math.round((completed / total) * 100);
        setProgress(percent);
        setProgressCompleted(completed);
        setProgressTotal(total);

        console.log(`[progress][${kind}] ${completed}/${total} (${percent}%)`);
      };

      const worker = async (workerId: number) => {
        while (true) {
          const currentIndex = cursor++;
          if (currentIndex >= divisionList.length) return;

          const target = divisionList[currentIndex];
          const division = target.Division;

          try {
            console.time(`[worker:${workerId}][${kind}] ${division}`);
            const rows = await fetchIotByRangeForDivision(start, end, division, kind);
            console.timeEnd(`[worker:${workerId}][${kind}] ${division}`);

            resultsByIndex[currentIndex] = rows;
          } catch (err) {
            console.error(`[worker:${workerId}][${kind}] ${division} error:`, err);
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

      setProgress(100);
      setProgressCompleted(total);
      setProgressTotal(total);

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
        console.log("[range cache hit]", rangeKey, "rows=", cached.length);

        if (cancelled || seq !== requestSeqRef.current) return;

        setAllRows(cached);
        setLoading(false);

        // キャッシュヒット時は即完了扱い
        setProgress(100);
        setProgressCompleted(divisions.length);
        setProgressTotal(divisions.length);

        const payload: FullPayload = {
          viewState: currentViewState,
          rows: cached,
        };
        latestFullPayloadRef.current = payload;

        sendFullPayloadToIframe(payload, rangeKey);
        return;
      }

      setLoading(true);
      setProgress(0);
      setProgressCompleted(0);
      setProgressTotal(divisions.length);

      try {
        console.time(`fetchIotByRangeAllDivisions(parallel)[${dataKind}]`);
        const rows = await fetchIotByRangeAllDivisions(
          startDate,
          endDate,
          divisions,
          dataKind
        );
        console.timeEnd(`fetchIotByRangeAllDivisions(parallel)[${dataKind}]`);

        if (cancelled || seq !== requestSeqRef.current) return;

        rangeCacheRef.current.set(rangeKey, rows);
        setAllRows(rows);

        const payload: FullPayload = {
          viewState: currentViewState,
          rows,
        };
        latestFullPayloadRef.current = payload;

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

          sendFullPayloadToIframe(payload, rangeKey);

          // エラーでも処理終了として progress 表示は閉じやすくする
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

    const divisionChanged = prevViewState.division !== nextViewState.division;

    const kindChanged = prevViewState.dataKind !== nextViewState.dataKind;

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