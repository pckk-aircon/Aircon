/*



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

type IotRow = Record<string, any>;

export default function Page() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [selectedDivision, setSelectedDivision] = useState("");

  const [iframeReady, setIframeReady] = useState(false);
  const [rows, setRows] = useState<IotRow[]>([]);
  const [loading, setLoading] = useState(false);

  const controller = "Mutsu01";

  // 追加: キャッシュ
  const cacheRef = useRef<Map<string, IotRow[]>>(new Map());

  // 追加: 最終リクエスト管理
  const requestSeqRef = useRef(0);

  // 追加: iframeへ送る最後の payload を保持
  const latestPayloadRef = useRef<{
    viewState: {
      division: string;
      startDay: string;
      endDay: string;
    };
    rows: IotRow[];
  } | null>(null);

  const buildViewState = useCallback(
    (division: string, start: Date, end: Date) => ({
      division,
      startDay: format(start, "yyyy-MM-dd"),
      endDay: format(end, "yyyy-MM-dd"),
    }),
    []
  );

  const makeCacheKey = useCallback(
    (start: Date, end: Date, division: string) =>
      [
        controller,
        division,
        format(startOfDay(start), "yyyy-MM-dd"),
        format(startOfDay(end), "yyyy-MM-dd"),
      ].join("|"),
    [controller]
  );

  const sendToIframe = useCallback(
    (payload: { viewState: { division: string; startDay: string; endDay: string }; rows: IotRow[] }) => {
      if (!iframeReady) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;

      // viewState と rows を同じタイミングで送る
      win.postMessage({ type: "SET_VIEWSTATE", ...payload.viewState }, "*");
      win.postMessage({ type: "SET_DATA", rows: payload.rows }, "*");
    },
    [iframeReady]
  );

  // iframe READY
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "PLOTLY_READY") {
        setIframeReady(true);
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // iframeReady になったら最後の payload を流す
  useEffect(() => {
    if (!iframeReady) return;
    if (latestPayloadRef.current) {
      sendToIframe(latestPayloadRef.current);
    }
  }, [iframeReady, sendToIframe]);

  // Division取得
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

  // IoT取得（Multi-GSI版）
  async function fetchIotByRange(
    start: Date,
    end: Date,
    division: string
  ): Promise<IotRow[]> {
    const result: IotRow[] = [];

    const startDatetime = `${format(startOfDay(start), "yyyy-MM-dd")} 00:00:00+09:00`;
    const endDatetime = `${format(startOfDay(end), "yyyy-MM-dd")} 23:59:59+09:00`;

    console.log("=== Multi-GSI Query Start ===");
    console.log("Controller:", controller);
    console.log("Division:", division);
    console.log("StartDatetime:", startDatetime);
    console.log("EndDatetime:", endDatetime);

    let nextToken: string | null | undefined = null;
    let page = 0;

    do {
      const res = await client.queries.listIot({
        Controller: controller,
        Division: division,
        StartDatetime: startDatetime,
        EndDatetime: endDatetime,
        nextToken: nextToken ?? undefined,
      });

      const data = res.data;
      const errors = res.errors;

      if (errors?.length) {
        throw new Error(errors.map((e) => e.message).join("\n"));
      }

      const items = ((data?.items ?? []).filter(Boolean) as IotRow[]);
      nextToken = data?.nextToken ?? null;

      page += 1;

      console.log(
        `[range] page=${page} items=${items.length} nextToken=${nextToken ? "あり" : "なし"}`
      );

      result.push(...items);
    } while (nextToken);

    console.log("取得総件数:", result.length);

    const sorted = result
      .map((r) => r?.DeviceDatetime)
      .filter(Boolean)
      .sort();

    console.log("min DeviceDatetime:", sorted[0] ?? null);
    console.log("max DeviceDatetime:", sorted.length ? sorted[sorted.length - 1] : null);
    console.log("=== Multi-GSI Query End ===");

    return result;
  }

  // メイン処理
  useEffect(() => {
    if (!selectedDivision) return;

    let cancelled = false;
    const seq = ++requestSeqRef.current;

    (async () => {
      const cacheKey = makeCacheKey(startDate, endDate, selectedDivision);
      const cached = cacheRef.current.get(cacheKey);

      // 1) キャッシュがあれば即表示
      if (cached) {
        console.log("[cache hit]", cacheKey, "rows=", cached.length);
        if (cancelled || seq !== requestSeqRef.current) return;

        setRows(cached);

        const payload = {
          viewState: buildViewState(selectedDivision, startDate, endDate),
          rows: cached,
        };
        latestPayloadRef.current = payload;
        sendToIframe(payload);
        return;
      }

      setLoading(true);

      try {
        const raw = await fetchIotByRange(startDate, endDate, selectedDivision);

        if (cancelled || seq !== requestSeqRef.current) return;

        const finalRows = raw.map((r) => {
          const out = { ...r };
          if (!out.DivisionAgg && out.Division) {
            out.DivisionAgg = out.Division;
          }
          return out;
        });

        console.log("=== 最終データ確認 ===");
        console.log("selectedDivision:", selectedDivision);
        console.log("最終 rows件数:", finalRows.length);

        const finalSorted = finalRows
          .map((r) => r?.DeviceDatetime)
          .filter(Boolean)
          .sort();

        console.log("final min DeviceDatetime:", finalSorted[0] ?? null);
        console.log(
          "final max DeviceDatetime:",
          finalSorted.length ? finalSorted[finalSorted.length - 1] : null
        );

        // 2) キャッシュ保存
        cacheRef.current.set(cacheKey, finalRows);

        if (cancelled || seq !== requestSeqRef.current) return;

        setRows(finalRows);

        const payload = {
          viewState: buildViewState(selectedDivision, startDate, endDate),
          rows: finalRows,
        };
        latestPayloadRef.current = payload;
        sendToIframe(payload);
      } catch (err) {
        console.error("fetchIotByRange error:", err);
        if (!cancelled && seq === requestSeqRef.current) {
          setRows([]);
          const payload = {
            viewState: buildViewState(selectedDivision, startDate, endDate),
            rows: [],
          };
          latestPayloadRef.current = payload;
          sendToIframe(payload);
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
  }, [startDate, endDate, selectedDivision, makeCacheKey, buildViewState, sendToIframe]);

  const viewState = useMemo(
    () => ({
      division: selectedDivision,
      startDay: format(startDate, "yyyy-MM-dd"),
      endDay: format(endDate, "yyyy-MM-dd"),
    }),
    [selectedDivision, startDate, endDate]
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
          rows={rows.length} / iframeReady={String(iframeReady)} / loading={String(loading)} / division={viewState.division}
        </span>
      </div>

      <iframe
        ref={iframeRef}
        src="/plotly-view/index.html?mode=embed"
        style={{ width: "100%", height: "900px", border: "none" }}
        title="plotly-view"
      />
    </main>
  );
}

*/

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

type IotRow = Record<string, any>;

type ViewState = {
  division: string;
  startDay: string;
  endDay: string;
};

type FullPayload = {
  viewState: ViewState;
  rows: IotRow[];
};

export default function Page() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [selectedDivision, setSelectedDivision] = useState("");

  const [iframeReady, setIframeReady] = useState(false);

  // 現在の日付範囲で取得済みの「全Division分」のrows
  const [allRows, setAllRows] = useState<IotRow[]>([]);

  const [loading, setLoading] = useState(false);

  const controller = "Mutsu01";

  // 日付範囲単位のキャッシュ（Divisionを含めない）
  const rangeCacheRef = useRef<Map<string, IotRow[]>>(new Map());

  // リクエスト競合防止
  const requestSeqRef = useRef(0);

  // iframe 未準備時に後で流すため
  const latestViewStateRef = useRef<ViewState | null>(null);
  const latestFullPayloadRef = useRef<FullPayload | null>(null);

  // 同じ full payload を何度も送らないための目印
  const lastSentDataKeyRef = useRef<string>("");

  const buildViewState = useCallback(
    (division: string, start: Date, end: Date): ViewState => ({
      division,
      startDay: format(start, "yyyy-MM-dd"),
      endDay: format(end, "yyyy-MM-dd"),
    }),
    []
  );

  // 日付範囲キャッシュキー（Divisionを含めない）
  const makeRangeCacheKey = useCallback(
    (start: Date, end: Date) =>
      [
        controller,
        format(startOfDay(start), "yyyy-MM-dd"),
        format(startOfDay(end), "yyyy-MM-dd"),
      ].join("|"),
    [controller]
  );

  // rows件数表示用（現在選択Divisionの件数）
  const selectedRowsCount = useMemo(() => {
    if (!selectedDivision || allRows.length === 0) return 0;

    return allRows.filter((r) => {
      const div = r?.DivisionAgg ?? r?.Division;
      return div === selectedDivision;
    }).length;
  }, [allRows, selectedDivision]);

  const sendViewStateToIframe = useCallback(
    (viewState: ViewState) => {
      latestViewStateRef.current = viewState;

      if (!iframeReady) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;

      win.postMessage({ type: "SET_VIEWSTATE", ...viewState }, "*");
    },
    [iframeReady]
  );

  const sendFullPayloadToIframe = useCallback(
    (payload: FullPayload, dataKey: string) => {
      latestFullPayloadRef.current = payload;
      latestViewStateRef.current = payload.viewState;

      if (!iframeReady) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;

      // app.js を変えない前提なので、まず viewState、次に rows を送る
      // （SET_DATA受信時に pendingViewState が使われるため）
      win.postMessage({ type: "SET_VIEWSTATE", ...payload.viewState }, "*");
      win.postMessage({ type: "SET_DATA", rows: payload.rows }, "*");

      lastSentDataKeyRef.current = dataKey;
    },
    [iframeReady]
  );

  // iframe READY
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "PLOTLY_READY") {
        setIframeReady(true);
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // iframe ready 後に、未送信の最新状態があれば流す
  useEffect(() => {
    if (!iframeReady) return;

    const rangeKey = makeRangeCacheKey(startDate, endDate);

    // rows を持っていれば full payload を優先して送る
    if (
      latestFullPayloadRef.current &&
      lastSentDataKeyRef.current !== rangeKey
    ) {
      sendFullPayloadToIframe(latestFullPayloadRef.current, rangeKey);
      return;
    }

    // full payload が無いが viewState はある場合は viewState だけ送る
    if (latestViewStateRef.current) {
      sendViewStateToIframe(latestViewStateRef.current);
    }
  }, [
    iframeReady,
    startDate,
    endDate,
    makeRangeCacheKey,
    sendFullPayloadToIframe,
    sendViewStateToIframe,
  ]);

  // Division一覧取得
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

  // 1 Division 分の IoT取得（ページングあり）
  const fetchIotByRangeForDivision = useCallback(
    async (start: Date, end: Date, division: string): Promise<IotRow[]> => {
      const result: IotRow[] = [];

      const startDatetime = `${format(startOfDay(start), "yyyy-MM-dd")} 00:00:00+09:00`;
      const endDatetime = `${format(startOfDay(end), "yyyy-MM-dd")} 23:59:59+09:00`;

      console.log("=== Query Start ===");
      console.log("Controller:", controller);
      console.log("Division:", division);
      console.log("StartDatetime:", startDatetime);
      console.log("EndDatetime:", endDatetime);

      let nextToken: string | null | undefined = null;
      let page = 0;

      do {
        const res = await client.queries.listIot({
          Controller: controller,
          Division: division,
          StartDatetime: startDatetime,
          EndDatetime: endDatetime,
          nextToken: nextToken ?? undefined,
        });

        const data = res.data;
        const errors = res.errors;

        if (errors?.length) {
          throw new Error(errors.map((e) => e.message).join("\n"));
        }

        const items = ((data?.items ?? []).filter(Boolean) as IotRow[]);
        nextToken = data?.nextToken ?? null;

        page += 1;

        console.log(
          `[${division}] page=${page} items=${items.length} nextToken=${nextToken ? "あり" : "なし"}`
        );

        result.push(...items);
      } while (nextToken);

      console.log(`[${division}] 取得総件数:`, result.length);

      return result;
    },
    [controller]
  );

  // 現在の日付範囲に対して、全Division分を集める
  const fetchIotByRangeAllDivisions = useCallback(
    async (
      start: Date,
      end: Date,
      divisionList: DivisionRow[]
    ): Promise<IotRow[]> => {
      const merged: IotRow[] = [];

      console.log("=== All Division Fetch Start ===");
      console.log("Division count:", divisionList.length);

      // app.js未変更前提のため、まずは実装を分かりやすくシンプルにする
      // （日付変更は遅くてもOKの方針）
      for (const d of divisionList) {
        const rows = await fetchIotByRangeForDivision(start, end, d.Division);
        merged.push(...rows);
      }

      console.log("All divisions merged rows:", merged.length);

      // DivisionAgg を補完
      const finalRows = merged.map((r) => {
        const out = { ...r };
        if (!out.DivisionAgg && out.Division) {
          out.DivisionAgg = out.Division;
        }
        return out;
      });

      const sorted = finalRows
        .map((r) => r?.DeviceDatetime)
        .filter(Boolean)
        .sort();

      console.log("all min DeviceDatetime:", sorted[0] ?? null);
      console.log(
        "all max DeviceDatetime:",
        sorted.length ? sorted[sorted.length - 1] : null
      );
      console.log("=== All Division Fetch End ===");

      return finalRows;
    },
    [fetchIotByRangeForDivision]
  );

  // 日付範囲が変わったら「全Division分」を取得してキャッシュ
  useEffect(() => {
    if (divisions.length === 0) return;
    if (!selectedDivision) return;

    let cancelled = false;
    const seq = ++requestSeqRef.current;

    (async () => {
      const rangeKey = makeRangeCacheKey(startDate, endDate);
      const cached = rangeCacheRef.current.get(rangeKey);

      // まず現在の viewState は保持しておく
      const currentViewState = buildViewState(selectedDivision, startDate, endDate);
      latestViewStateRef.current = currentViewState;

      if (cached) {
        console.log("[range cache hit]", rangeKey, "rows=", cached.length);

        if (cancelled || seq !== requestSeqRef.current) return;

        setAllRows(cached);

        const payload: FullPayload = {
          viewState: currentViewState,
          rows: cached,
        };
        latestFullPayloadRef.current = payload;

        sendFullPayloadToIframe(payload, rangeKey);
        return;
      }

      setLoading(true);

      try {
        console.time("fetchIotByRangeAllDivisions");
        const rows = await fetchIotByRangeAllDivisions(startDate, endDate, divisions);
        console.timeEnd("fetchIotByRangeAllDivisions");

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
        console.error("fetchIotByRangeAllDivisions error:", err);

        if (!cancelled && seq === requestSeqRef.current) {
          setAllRows([]);

          const payload: FullPayload = {
            viewState: currentViewState,
            rows: [],
          };
          latestFullPayloadRef.current = payload;

          sendFullPayloadToIframe(payload, rangeKey);
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
    makeRangeCacheKey,
    buildViewState,
    fetchIotByRangeAllDivisions,
    sendFullPayloadToIframe,
  ]);

  // Division変更時は viewState だけ送る（再取得しない）
  useEffect(() => {
    if (!selectedDivision) return;

    const viewState = buildViewState(selectedDivision, startDate, endDate);
    latestViewStateRef.current = viewState;

    // allRows がまだ無い初回直後でも、app.js側は sourceData が無ければupdatePlotしないので問題なし
    sendViewStateToIframe(viewState);
  }, [selectedDivision, startDate, endDate, buildViewState, sendViewStateToIframe]);

  const viewState = useMemo(
    () => ({
      division: selectedDivision,
      startDay: format(startDate, "yyyy-MM-dd"),
      endDay: format(endDate, "yyyy-MM-dd"),
    }),
    [selectedDivision, startDate, endDate]
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
          selectedRows={selectedRowsCount} / totalRows={allRows.length} / iframeReady=
          {String(iframeReady)} / loading={String(loading)} / division=
          {viewState.division}
        </span>
      </div>

      <iframe
        ref={iframeRef}
        src="/plotly-view/index.html?mode=embed"
        style={{ width: "100%", height: "900px", border: "none" }}
        title="plotly-view"
      />
    </main>
  );
}
