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

  useEffect(() => {
    if (!selectedDivision) return;

    (async () => {
      setLoading(true);

      try {
        const raw = await fetchIotByDayRange(startDate, endDate);

        const filtered = raw.filter(r => r.Division === selectedDivision);

        // ✅ ★ここが最重要修正
        const fixTZ = (s: string) => {
          if (!s) return s;
          let out = s.replace(" ", "T");
          if (!/[zZ]$|[+\-]\d{2}:\d{2}$/.test(out)) {
            out += "+09:00";   // ← これが核心
          }
          return out;
        };

        const toRow = (r: any) => {
          const out = { ...r };

          if (!out.DivisionAgg && out.Division) {
            out.DivisionAgg = out.Division;
          }

          if (typeof out.DeviceDatetime === "string") {
            out.DeviceDatetime = fixTZ(out.DeviceDatetime);
          }

          if (typeof out.DatetimeAgg === "string") {
            out.DatetimeAgg = fixTZ(out.DatetimeAgg);
          }

          return out;
        };

        const finalRows = filtered.map(toRow);

        console.log("取得件数:", finalRows.length);

        // ★確認ログ（必ず一度出す）
        console.log("サンプル時刻:",
          finalRows.slice(0,5).map(r => ({
            raw: r.DeviceDatetime,
            local: new Date(r.DeviceDatetime).toString()
          }))
        );

        setRows(finalRows);

      } finally {
        setLoading(false);
      }
    })();
  }, [startDate, endDate, selectedDivision]);

  const viewState = useMemo(() => ({
    division: selectedDivision,
    startDay: format(startDate, "yyyy-MM-dd"),
    endDay: format(endDate, "yyyy-MM-dd"),
  }), [selectedDivision, startDate, endDate]);

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

