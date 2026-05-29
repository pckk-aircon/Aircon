/*
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

Amplify.configure(outputs);
const client = generateClient<Schema>();

type DivisionRow = { Division: string; DivisionName: string; Controller?: string | null };

export default function Page() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reactでキー選択（想定通り）
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("");

  // iframe handshake
  const [iframeReady, setIframeReady] = useState(false);

  // HTMLへ渡すrows（Division/日付で絞ったものだけ）
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string>("");

  const controller = "Mutsu01";

  // 1) iframeから READY を受信
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      // 同一オリジン前提（Next.js public配下）[1](https://js-guide.com/nextjs/457)[2](https://qiita.com/KRofLife/items/53333b6f64ca53a8fd00)
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "PLOTLY_READY") setIframeReady(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // 2) Division一覧取得（初回）
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        const { data, errors } = await client.queries.listDivision({ Controller: controller });
        if (errors?.length) throw new Error(errors.map(e => e.message).join("\n"));

        const list = (data || []) as DivisionRow[];
        setDivisions(list);

        // 初期Division未選択なら先頭を採用
        if (!selectedDivision && list.length > 0) {
          setSelectedDivision(list[0].Division);
        }
      } catch (e: any) {
        setErrMsg(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) IoT取得（start/end/divisionが変わったら）
  useEffect(() => {
    if (!selectedDivision) return;

    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
        const endDatetime = `${format(endDate, "yyyy-MM-dd")} 23:59:59+09:00`;

        const { data, errors } = await client.queries.listIot({
          Controller: controller,
          StartDatetime: startDatetime,
          EndDatetime: endDatetime,
        });

        if (errors?.length) throw new Error(errors.map(e => e.message).join("\n"));

        const raw = (data || []) as any[];

        // React側でDivision/日付に絞る（＝生データ全部は渡さない）
        // listIotがすでに日付範囲で返す想定なので、Divisionだけは確実にフィルタ
        const filtered = raw.filter((r) => r?.Division === selectedDivision);

        // HTML側（Plotly）へ渡すRecordを作る
        // 重要：HTML側が期待するキー（Division/Device/DeviceType/DeviceDatetime など）を維持
        const toRow = (r: any): Record<string, any> => {
          const out: Record<string, any> = { ...r };

          // ①HTML側は DivisionAgg を優先（無ければDivision）。無い場合は補完
          if (out.DivisionAgg == null && out.Division != null) out.DivisionAgg = out.Division;

          // ②日時：HTML側は " "→"T" 変換も持っているが、ここで整えてもOK
          //    既存のDeviceDatetimeをそのまま渡し、HTML側でnormalizeしてもOK
          if (out.DeviceDatetime && typeof out.DeviceDatetime === "string") {
            out.DeviceDatetime = out.DeviceDatetime.replace(" ", "T");
          }
          if (out.DatetimeAgg && typeof out.DatetimeAgg === "string") {
            out.DatetimeAgg = out.DatetimeAgg.replace(" ", "T");
          }
          if (out.DeviceTimestamp && typeof out.DeviceTimestamp === "string") {
            out.DeviceTimestamp = out.DeviceTimestamp.replace(" ", "T");
          }

          // ③DeviceTypeはHTML側の Power/Aircon判定に重要。無ければ落とさない（そのまま）
          //    ここでは補完はしない（元データを尊重）

          return out;
        };

        setRows(filtered.map(toRow));
      } catch (e: any) {
        setErrMsg(e?.message ?? String(e));
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [startDate, endDate, selectedDivision]);

  // 4) iframeへ送るviewstate（HTMLにも反映させる）
  const viewState = useMemo(() => {
    return {
      division: selectedDivision,
      startDay: format(startDate, "yyyy-MM-dd"),
      endDay: format(endDate, "yyyy-MM-dd"),
    };
  }, [selectedDivision, startDate, endDate]);

  // 5) iframeへ送信（READY後）
  useEffect(() => {
    if (!iframeReady) return;
    if (!iframeRef.current?.contentWindow) return;

    // 先に表示条件、次にデータ
    iframeRef.current.contentWindow.postMessage(
      { type: "SET_VIEWSTATE", ...viewState },
      window.location.origin
    );

    iframeRef.current.contentWindow.postMessage(
      { type: "SET_DATA", rows },
      window.location.origin
    );
  }, [iframeReady, viewState, rows]);

  const selectedDivisionName =
    divisions.find(d => d.Division === selectedDivision)?.DivisionName || selectedDivision;

  return (
    <main style={{ padding: 12 }}>
      <h2>ListIot2（React: Division/日付選択 → HTML(Plotly)描画）</h2>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Start:
          <DatePicker
            selected={startDate}
            onChange={(d: Date | null) => setStartDate(d ?? new Date())}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          End:
          <DatePicker
            selected={endDate}
            onChange={(d: Date | null) => setEndDate(d ?? new Date())}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Division:
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            disabled={divisions.length === 0}
          >
            {divisions.map((d) => (
              <option key={d.Division} value={d.Division}>
                {d.DivisionName}（{d.Division}）
              </option>
            ))}
          </select>
        </label>

        <span style={{ color: "#666" }}>
          状態: {loading ? "Loading..." : `rows=${rows.length}`} / iframeReady={String(iframeReady)}
        </span>
      </div>

      {errMsg && (
        <div style={{ color: "crimson", whiteSpace: "pre-wrap", marginBottom: 12 }}>
          {errMsg}
        </div>
      )}

      <div style={{ marginBottom: 8, color: "#333" }}>
        表示: {selectedDivisionName} / {format(startDate, "yyyy-MM-dd")} ～ {format(endDate, "yyyy-MM-dd")}
      </div>

      <iframe
        ref={iframeRef}
        src="/plotly-view/index.html?mode=embed"
        style={{ width: "100%", height: "900px" }}
      />

    </main>
  );
}
*/
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, addDays, startOfDay, isAfter } from "date-fns";

Amplify.configure(outputs);
const client = generateClient<Schema>();

type DivisionRow = { Division: string; DivisionName: string };

export default function Page() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [selectedDivision, setSelectedDivision] = useState("");

  const [iframeReady, setIframeReady] = useState(false);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);

  const controller = "Mutsu01";

  // ✅ iframe READY受信（originに依存しない安全判定）
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

  // ✅ Division取得
  useEffect(() => {
    (async () => {
      const { data } = await client.queries.listDivision({ Controller: controller });
      const list = (data || []) as DivisionRow[];
      setDivisions(list);

      if (list.length > 0) {
        setSelectedDivision(list[0].Division);
      }
    })();
  }, []);




  
  // ✅ ★本質：日別で全期間取得（nextTokenなし）
  async function fetchIotByDayRange(start: Date, end: Date) {
    const result: any[] = [];

    let cur = startOfDay(start);
    const last = startOfDay(end);

    while (!isAfter(cur, last)) {
      const startDatetime = `${format(cur, "yyyy-MM-dd")} 00:00:00+09:00`;
      const endDatetime   = `${format(cur, "yyyy-MM-dd")} 23:59:59+09:00`;

      const { data, errors } = await client.queries.listIot({
        Controller: controller,
        StartDatetime: startDatetime,
        EndDatetime: endDatetime,
      });

      if (errors?.length) {
        throw new Error(errors.map(e => e.message).join("\n"));
      }

      result.push(...(data || []));

      cur = addDays(cur, 1);
    }

    return result;
  }

  // ✅ IoT取得
  useEffect(() => {
    if (!selectedDivision) return;

    (async () => {
      setLoading(true);

      try {
        const raw = await fetchIotByDayRange(startDate, endDate);

        const filtered = raw.filter(r => r.Division === selectedDivision);

        const toRow = (r: any) => {
          const out = { ...r };

          if (!out.DivisionAgg && out.Division) {
            out.DivisionAgg = out.Division;
          }

          if (typeof out.DeviceDatetime === "string") {
            out.DeviceDatetime = out.DeviceDatetime.replace(" ", "T");
          }
          if (typeof out.DatetimeAgg === "string") {
            out.DatetimeAgg = out.DatetimeAgg.replace(" ", "T");
          }

          return out;
        };

        const finalRows = filtered.map(toRow);

        console.log("取得件数:", finalRows.length);
        setRows(finalRows);

      } finally {
        setLoading(false);
      }
    })();
  }, [startDate, endDate, selectedDivision]);

  // ✅ viewState
  const viewState = useMemo(() => ({
    division: selectedDivision,
    startDay: format(startDate, "yyyy-MM-dd"),
    endDay: format(endDate, "yyyy-MM-dd"),
  }), [selectedDivision, startDate, endDate]);

  // ✅ iframe送信
  useEffect(() => {
    if (!iframeReady) return;

    iframeRef.current?.contentWindow?.postMessage(
      { type: "SET_VIEWSTATE", ...viewState },
      "*"
    );

    iframeRef.current?.contentWindow?.postMessage(
      { type: "SET_DATA", rows },
      "*"
    );

  }, [iframeReady, viewState, rows]);

  return (
    <main style={{ padding: 12 }}>
      <h2>ListIot2</h2>

      <div style={{ display: "flex", gap: 12 }}>
        <DatePicker selected={startDate} onChange={(d) => setStartDate(d!)} />
        <DatePicker selected={endDate} onChange={(d) => setEndDate(d!)} />

        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value)}
        >
          {divisions.map(d => (
            <option key={d.Division} value={d.Division}>
              {d.DivisionName}
            </option>
          ))}
        </select>

        <span>
          rows={rows.length} / iframeReady={String(iframeReady)}
        </span>
      </div>

      <iframe
        ref={iframeRef}
        src="/plotly-view/index.html?mode=embed"
        style={{ width: "100%", height: "900px" }}
      />
    </main>
  );
}
