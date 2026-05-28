

/*


"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO } from "date-fns";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

Amplify.configure(outputs);

const client = generateClient<Schema>();

interface ChartData {
  DeviceDatetime: string;
  ActualTemp: number | null;
  CumulativeEnergy: number | null;
  ControlStage: string | null;
  Device: string;
  Division: string;
  DivisionName?: string; // DivisionNameを追加
}

export default function App() {

  const [startDate, setStartDatetime] = useState(new Date()); 
  const [endDate, setEndDatetime] = useState(new Date());

  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [currentDivisionIndex, setCurrentDivisionIndex] = useState(0);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; Controller?: string | null }>>([]);
  const [deviceLists, setDevices] = useState<Array<{ Device: string; DeviceName: string; DeviceType: string; Division: string; Controller?: string | null }>>([]);

  const [FiltereddeviceLists, setFiltereddevice] = useState<Array<{ Device: string; DeviceName: string; DeviceType: string; Division: string; Controller?: string | null }>>([]);
 
  //console.log("divisionLists（State直後）=", divisionLists);
  //console.log("deviceLists（State直後）=", deviceLists);
  console.log("FiltereddeviceLists（State直後）=", FiltereddeviceLists);


  useEffect(() => {
    if (divisionLists.length > 0 && deviceLists.length > 0) {
      const selectedDivision = divisionLists[currentDivisionIndex].Division;
      //const filtered = deviceLists.filter(item => item.Division === selectedDivision && item.DeviceType === 'Aircon');
      const filtered = deviceLists.filter(item => item.Division === selectedDivision && item.DeviceType === 'Power');
      setFiltereddevice(filtered);
      console.log('☆currentDivisionIndex（useEffect）=', currentDivisionIndex)
      console.log('☆selectedDivision（useEffect）=', selectedDivision)
      console.log('☆filtered（useEffect）=', filtered)
    }
  }, [divisionLists, deviceLists, currentDivisionIndex, currentDeviceIndex]);

  useEffect(() => {
    async function fetchData() {
        await listIot();
    }
    fetchData();
  }, [startDate, endDate, currentDivisionIndex, currentDeviceIndex]);

  async function listIot() {
    const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    const endDatetime = `${format(endDate, "yyyy-MM-dd")} 23:59:59+09:00`;

    //console.log("StartDatetime=", startDate);
    //console.log("EndDatetime=", endDate);

    // 追記部分: divisionListsのデータ取得と状態更新

    const {data: divisionLists, errors: divisionErrors } = await client.queries.listDivision({
      Controller: "Mutsu01",
    });
    if (divisionLists) {
      setPosts(divisionLists as Array<{ Division: string; DivisionName: string; Controller?: string | null }>); // 型を明示的にキャストする
    }

    const {data: deviceLists, errors: deviceErrors } = await client.queries.listDevice({
      Controller: "Mutsu01",
    });
    if (deviceLists) {
      setDevices(deviceLists as Array<{ Device: string; DeviceName: string; DeviceType: string; Division: string; Controller?: string | null }>); // 型を明示的にキャストする
    }

    const { data, errors } = await client.queries.listIot({
      Controller: "Mutsu01",
      StartDatetime: startDatetime,
      EndDatetime: endDatetime,
    });

    console.log('★Iotdata（listIot）=', data)
    //console.log('deviceLists（listIot）=', deviceLists)
    console.log('★currentDivisionIndex（listIot）=', currentDivisionIndex)
    console.log('★currentDeviceIndex（listIot）=', currentDeviceIndex)
    console.log('★currentDeviceIndex.Device（listIot）=', FiltereddeviceLists?.[currentDeviceIndex]?.Device) 
    //console.log('currentDeviceIndex[1]=', deviceLists?.[1]?.Device)   

    if (data) { 

      const formattedData = data

      .filter(item => 
        divisionLists?.[currentDivisionIndex]?.Division && // オプショナルチェーンを使用
        item?.Division === divisionLists[currentDivisionIndex].Division && 

        (
          item?.DeviceType === 'Temp' || 
          //item?.DeviceType === 'Aircon' ||
          item?.DeviceType === 'Power'
          //(item?.DeviceType === 'Power' && 
          //FiltereddeviceLists[currentDeviceIndex]?.Device === item?.Device
          //)
        )

      )

      .map(item => {
        return {
          DeviceDatetime: item?.DeviceDatetime ?? '',
          ActualTemp: item?.ActualTemp !== undefined && item.ActualTemp !== null ? parseFloat(item.ActualTemp) : null,
          //WeightedTemp: item?.WeightedTemp !== undefined && item.WeightedTemp !== null ? parseFloat(item.WeightedTemp) : null,
          CumulativeEnergy: item?.CumulativeEnergy !== undefined && item.CumulativeEnergy !== null ? parseFloat(item.CumulativeEnergy) : null,            
          ControlStage: item?.ControlStage ?? null,
          Device: item?.Device ?? '',
          Division: item?.Division ?? '',
          DivisionName: divisionLists?.[currentDivisionIndex]?.DivisionName ?? '', // オプショナルチェーンを使用
        };
      });

      console.log('★★formattedData=', formattedData) 

      formattedData.sort((a, b) => parseISO(a.DeviceDatetime).getTime() - parseISO(b.DeviceDatetime).getTime());
      setChartData(formattedData);
    }
  }

  // データが存在しない場合はローディング表示やスキップ
  if (divisionLists.length === 0 || deviceLists.length === 0)  {
    console.log("return");
    return <div>Loading...</div>;
  }

  //console.log("selectedDivision（handle直前1）=", selectedDivision); 
  //console.log("divisionLists（handle直前1）=", divisionLists);
  //console.log("deviceLists（handle直前1）=", deviceLists);
  //console.log("filtereddeviceLists（handle直前1）=", filtereddeviceLists);
 
  // デバイスごとにデータをグループ化
  const groupedData = chartData.reduce<Record<string, ChartData[]>>((acc, item) => {
    if (!acc[item.Device]) {
      acc[item.Device] = [];
    }
    acc[item.Device].push(item);
    return acc;
  }, {});

  const colors = ["mediumvioletred","deeppink", "hotpink", "palevioletred", "pink"];

  // デバイスごとのデータを統合して表示
  const mergedData = chartData.map(item => {
    const newItem: Record<string, any> = { DeviceDatetime: item.DeviceDatetime };
    Object.keys(groupedData).forEach(device => {
      const deviceData = groupedData[device].find(d => d.DeviceDatetime === item.DeviceDatetime);
      newItem[device] = deviceData ? deviceData.ActualTemp : null;
    });
    newItem.CumulativeEnergy = item.CumulativeEnergy;
    newItem.ControlStage = item.ControlStage;
    return newItem;
  });

  //console.log("divisionLists（handle直前）=", divisionLists);
  //console.log("deviceLists（handle直前）=", deviceLists);

  const handleNext = () => {
    setCurrentDivisionIndex((prevIndex) => (prevIndex + 1) % divisionLists.length);
    //setCurrentDeviceIndex(0); // Deviceのインデックスを0にリセット

  };
  const handlePrevious = () => {
    setCurrentDivisionIndex((prevIndex) => (prevIndex - 1 + divisionLists.length) % divisionLists.length);
    //setCurrentDeviceIndex(0); // Deviceのインデックスを0にリセット
  };

  const DevicehandleNext = () => {
    setCurrentDeviceIndex((prevIndex) => (prevIndex + 1) % FiltereddeviceLists.length);
  };

  const DevicehandlePrevious = () => {
    setCurrentDeviceIndex((prevIndex) => (prevIndex - 1 + FiltereddeviceLists.length) % FiltereddeviceLists.length);
  };  



  const formatXAxis = (tickItem: string) => {
    return format(parseISO(tickItem), "MM-dd HH:mm");
  };


  return (
    <main>
      <div>
        <label>
          StartDatetime:
          <DatePicker selected={startDate} onChange={(date: Date | null) => setStartDatetime(date ? date : new Date())} />
        </label>
        <label>
          EndDatetime:
          <DatePicker selected={endDate} onChange={(date: Date | null) => setEndDatetime(date ? date : new Date())} />  
        </label>
      </div>
      <div>
        <button onClick={handlePrevious}>prevDivision</button>
        <button onClick={handleNext}>nextDivision</button>
      </div>
      <div>
        <button onClick={DevicehandlePrevious}>prevDevice</button>
        <button onClick={DevicehandleNext}>nextDevice</button>
      </div>
      <div>
        <h1>Temperature Data for {divisionLists[currentDivisionIndex].DivisionName} _ {FiltereddeviceLists[currentDeviceIndex]?.DeviceName}</h1>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="1 1" vertical={false} />

            <XAxis 
              dataKey="DeviceDatetime" 
              tickFormatter={formatXAxis} 
              angle={45} 
              textAnchor="end" 
              height={20} 
              //interval={0} // すべてのラベルを表示。1にするとうまくいかない。
            />


            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />


            <Tooltip />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
            {Object.keys(groupedData).map((device, index) => (
              <Line
                key={device}
                yAxisId="left"
                type="monotone"
                dataKey={device}
                name={device}
                stroke={colors[index % colors.length]} // デバイスごとに色を変更
                //dot={{ r: 0.1, fill: colors[index % colors.length] }} //デフォルトで〇が表示されることを回避
                dot={false}
                connectNulls
              />
            ))}


            <Line
              yAxisId="right"
              type="monotone"
              dataKey="CumulativeEnergy"
              name="CumulativeEnergy"
              stroke="#ff0000" // 赤色
              strokeWidth={3} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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