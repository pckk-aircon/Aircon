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

  // ✅ iframe READY
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

  // ✅ IoT取得（★修正済）
  async function fetchIotByDayRange(start: Date, end: Date) {
    const result: any[] = [];

    let cur = startOfDay(start);
    const last = startOfDay(end);

    while (!isAfter(cur, last)) {

      // ✅ ★DB形式と完全一致させる（最重要）
      const startDatetime = `${format(cur, "yyyy-MM-dd")} 00:00:00+09:00`;
      const endDatetime   = `${format(cur, "yyyy-MM-dd")} 23:59:59+09:00`;

      // ✅ デバッグログ（確認必須）
      console.log("QUERY:", startDatetime, "→", endDatetime);

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

          // ★ここ重要：DB形式をそのまま維持する（変換しない）
          if (typeof out.DeviceDatetime === "string") {
            out.DeviceDatetime = out.DeviceDatetime;
          }

          if (typeof out.DatetimeAgg === "string") {
            out.DatetimeAgg = out.DatetimeAgg;
          }

          return out;
        };

        const finalRows = filtered.map(toRow);

        console.log("取得件数:", finalRows.length);

        // ✅ データ確認ログ
        console.log("サンプル:", finalRows.slice(0, 5).map(r => r.DeviceDatetime));

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

  // =========================================================
  // iframe READY
  // =========================================================
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "PLOTLY_READY") setIframeReady(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // =========================================================
  // Division取得
  // =========================================================
  useEffect(() => {
    (async () => {
      const { data } = await client.queries.listDivision({ Controller: controller });
      const list = (data || []) as DivisionRow[];
      setDivisions(list);
      if (list.length > 0) setSelectedDivision(list[0].Division);
    })();
  }, []);

  // =========================================================
  // DBの文字列形式に合わせた日時フォーマット（スペース区切り +09:00）
  // =========================================================
  function fmtDb(dt: Date) {
    // 例: 2026-05-29 14:00:00+09:00
    return `${format(dt, "yyyy-MM-dd HH:mm:ss")}+09:00`;
  }

  // =========================================================
  // 1回のクエリ（この範囲だけ）
  // =========================================================
  async function fetchIotWindow(start: Date, end: Date) {
    const StartDatetime = fmtDb(start);
    const EndDatetime = fmtDb(end);

    // デバッグ
    console.log("QUERY:", StartDatetime, "→", EndDatetime);

    const { data, errors } = await client.queries.listIot({
      Controller: controller,
      StartDatetime,
      EndDatetime,
    });

    if (errors?.length) throw new Error(errors.map(e => e.message).join("\n"));
    return (data || []) as any[];
  }

  // =========================================================
  // ✅ 自動分割ページング（nextTokenが使えないので、範囲を二分割して取り切る）
  //   - 返却件数が limit(10000) 付近なら「打ち切り疑い」として分割
  // =========================================================
  const LIMIT = 10000;
  const NEAR_LIMIT = 9900; // ここ以上なら「切れてる疑い」とみなす
  const MAX_DEPTH = 10;    // 深掘り最大（2^10=1024分割まで）

  async function fetchIotWindowAdaptive(start: Date, end: Date, depth = 0): Promise<any[]> {
    const items = await fetchIotWindow(start, end);

    // 打ち切り疑い（件数が多すぎる）
    if (items.length >= NEAR_LIMIT && depth < MAX_DEPTH) {
      const midMs = Math.floor((start.getTime() + end.getTime()) / 2);
      const mid = new Date(midMs);

      // 左のendは mid - 1秒（BETWEENは両端含むので重複防止）
      const leftEnd = new Date(mid.getTime() - 1000);

      // もし分割不能（1秒未満）なら諦めて返す
      if (leftEnd.getTime() <= start.getTime()) {
        console.warn("Cannot split further:", start, end, "count=", items.length);
        return items;
      }

      console.warn(
        "Suspected truncation. Splitting window:",
        fmtDb(start), "→", fmtDb(end),
        "count=", items.length,
        "depth=", depth
      );

      const left = await fetchIotWindowAdaptive(start, leftEnd, depth + 1);
      const right = await fetchIotWindowAdaptive(mid, end, depth + 1);

      return [...left, ...right];
    }

    return items;
  }

  // =========================================================
  // 日別で全期間取得（内部は自動分割）
  // =========================================================
  async function fetchIotByDayRange(start: Date, end: Date) {
    const result: any[] = [];
    let cur = startOfDay(start);
    const last = startOfDay(end);

    while (!isAfter(cur, last)) {
      const dayStart = new Date(cur.getTime());
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(cur.getTime());
      dayEnd.setHours(23, 59, 59, 0);

      const dayItems = await fetchIotWindowAdaptive(dayStart, dayEnd, 0);
      result.push(...dayItems);

      cur = addDays(cur, 1);
    }

    return result;
  }

  // =========================================================
  // IoT取得
  // =========================================================
  useEffect(() => {
    if (!selectedDivision) return;

    (async () => {
      setLoading(true);
      try {
        const raw = await fetchIotByDayRange(startDate, endDate);

        // Divisionフィルタ
        const filtered = raw.filter(r => r.Division === selectedDivision);

        // 必要列の補完（変換はしない：DB形式維持）
        const finalRows = filtered.map((r: any) => {
          const out = { ...r };
          if (!out.DivisionAgg && out.Division) out.DivisionAgg = out.Division;
          return out;
        });

        // ✅ 重複排除（分割取得の境界で同じレコードが混ざる可能性があるため）
        const uniq = new Map<string, any>();
        for (const r of finalRows) {
          const key =
            `${r.Controller ?? ""}|${r.Device ?? ""}|${r.DeviceType ?? ""}|${r.Division ?? ""}|${r.DeviceDatetime ?? ""}`;
          if (!uniq.has(key)) uniq.set(key, r);
        }
        const deduped = Array.from(uniq.values());

        console.log("取得件数(raw):", raw.length);
        console.log("取得件数(filtered):", finalRows.length);
        console.log("取得件数(deduped):", deduped.length);
        console.log("サンプル(DeviceDatetime):", deduped.slice(0, 5).map(r => r.DeviceDatetime));

        setRows(deduped);
      } finally {
        setLoading(false);
      }
    })();
  }, [startDate, endDate, selectedDivision]);

  // =========================================================
  // viewState
  // =========================================================
  const viewState = useMemo(() => ({
    division: selectedDivision,
    startDay: format(startDate, "yyyy-MM-dd"),
    endDay: format(endDate, "yyyy-MM-dd"),
  }), [selectedDivision, startDate, endDate]);

  // =========================================================
  // iframe送信
  // =========================================================
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

  // =========================================================
  // UI
  // =========================================================
  return (
    <main style={{ padding: 12 }}>
      <h2>ListIot2</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
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
          rows={rows.length} / iframeReady={String(iframeReady)} / loading={String(loading)}
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