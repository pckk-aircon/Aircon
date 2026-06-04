"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, startOfDay } from "date-fns";

Amplify.configure(outputs);
const client = generateClient<Schema>();

type IotRow = Record<string, unknown>;
type DataKind = "iot" | "agg";

type ViewState = {
  division: string;
  startDay: string;
  endDay: string;
  dataKind: DataKind;
};

export default function Page() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const [selectedDivision, setSelectedDivision] = useState("");

  const [dataKind, setDataKind] = useState<DataKind>("iot");

  const [iframeReady, setIframeReady] = useState(false);
  const [allRows, setAllRows] = useState<IotRow[]>([]);

  const controller = "Mutsu01";

  const latestPayloadRef = useRef<{ viewState: ViewState; rows: IotRow[] } | null>(null);

  // =========================================================
  // ✅ normalize（最重要）
  // =========================================================
  const normalizeRows = useCallback((rows: IotRow[], kind: DataKind): IotRow[] => {
    return rows.map((row) => {
      const out = { ...row } as Record<string, unknown>;

      // Division統一
      if (!out.DivisionAgg && out.Division) out.DivisionAgg = out.Division;
      if (!out.Division && out.DivisionAgg) out.Division = out.DivisionAgg;

      // Device統一
      if (!out.Device && out.DeviceName) out.Device = out.DeviceName;

      // Datetime統一（重要）
      if (kind === "agg") {
        if (!out.DeviceDatetime && out.DatetimeAgg) {
          out.DeviceDatetime = out.DatetimeAgg;
        }
      }

      if (kind === "iot") {
        if (!out.DatetimeAgg && out.DeviceDatetime) {
          out.DatetimeAgg = out.DeviceDatetime;
        }
      }

      return out;
    });
  }, []);

  // =========================================================
  // iframe通信
  // =========================================================
  const sendToIframe = useCallback(
    (rows: IotRow[], viewState: ViewState) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;

      const origin = window.location.origin;

      console.log("SEND rows:", rows.length);

      win.postMessage({ type: "SET_VIEWSTATE", ...viewState }, origin);
      win.postMessage({ type: "SET_DATA", rows }, origin);
    },
    []
  );

  // =========================================================
  // iframe ready
  // =========================================================
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "PLOTLY_READY") {
        setIframeReady(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // =========================================================
  // 取得ロジック（簡略版）
  // =========================================================
  const fetchData = useCallback(async () => {
    const start = `${format(startOfDay(startDate), "yyyy-MM-dd")} 00:00:00+09:00`;
    const end = `${format(startOfDay(endDate), "yyyy-MM-dd")} 23:59:59+09:00`;

    let res;

    if (dataKind === "iot") {
      res = await client.queries.listIot({
        Controller: controller,
        Division: selectedDivision,
        StartDatetime: start,
        EndDatetime: end,
      });
    } else {
      res = await client.queries.listIotAgg({
        Controller: controller,
        Division: selectedDivision,
        StartDatetime: start,
        EndDatetime: end,
      });
    }

    const items = (res.data?.items ?? []).filter(Boolean) as IotRow[];

    const normalized = normalizeRows(items, dataKind);

    console.log("FETCH rows:", normalized.length);

    setAllRows(normalized);

    const viewState: ViewState = {
      division: selectedDivision,
      startDay: format(startDate, "yyyy-MM-dd"),
      endDay: format(endDate, "yyyy-MM-dd"),
      dataKind,
    };

    latestPayloadRef.current = { viewState, rows: normalized };

    if (iframeReady) {
      sendToIframe(normalized, viewState);
    }
  }, [startDate, endDate, selectedDivision, dataKind, iframeReady, normalizeRows, sendToIframe]);

  // =========================================================
  // iframe ready後に再送
  // =========================================================
  useEffect(() => {
    if (!iframeReady) return;
    if (!latestPayloadRef.current) return;

    sendToIframe(
      latestPayloadRef.current.rows,
      latestPayloadRef.current.viewState
    );
  }, [iframeReady, sendToIframe]);

  // =========================================================
  // UI変更時
  // =========================================================
  useEffect(() => {
    if (!selectedDivision) return;
    fetchData();
  }, [selectedDivision, startDate, endDate, dataKind, fetchData]);

  return (
    <main style={{ padding: 12 }}>
      <h2>Plotly Iot Viewer</h2>

      <DatePicker selected={startDate} onChange={(d) => d && setStartDate(d)} />
      <DatePicker selected={endDate} onChange={(d) => d && setEndDate(d)} />

      <select value={dataKind} onChange={(e) => setDataKind(e.target.value as DataKind)}>
        <option value="iot">IotData</option>
        <option value="agg">IotDataAgg</option>
      </select>

      <input
        value={selectedDivision}
        onChange={(e) => setSelectedDivision(e.target.value)}
        placeholder="Division"
      />

      <iframe
        ref={iframeRef}
        src="/plotly-view/index.html?mode=embed"
        style={{ width: "100%", height: "800px" }}
      />
    </main>
  );
}