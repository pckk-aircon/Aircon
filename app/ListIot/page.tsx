/*


"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
//import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO } from "date-fns";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

import { saveAs } from 'file-saver'; // 追加: ファイル保存用ライブラリ
import Papa from 'papaparse'; // 追加: CSV変換用ライブラリ

//Amplify.configure(outputs);

const client = generateClient<Schema>();

interface ChartData {
  DeviceDatetime: string;
  ControlStage: string | null;
  Device: string;
  ActualTemp: number | null;
  WeightedTemp: number | null;
  TargetTemp: number | null;
  PresetTemp: number | null;
  ReferenceTemp: number | null;
  CumulativeEnergy: number | null;
  ActivePower: number | null;
  ApparentPower: number | null;
  Division: string;
  DivisionName?: string; // DivisionNameを追加
}

export default function App() {

  const [startDate, setStartDatetime] = useState(new Date()); 
  const [endDate, setEndDatetime] = useState(new Date());

  //ここに追加
  useEffect(() => {
    const nextDay = new Date(startDate);
    nextDay.setDate(startDate.getDate() + 1);
    setEndDatetime(nextDay); //ここでendDateを更新。
  }, [startDate]);

  const [chartData, setChartData] = useState<ChartData[]>([]);

  const [currentDivisionIndex, setCurrentDivisionIndex] = useState(0);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; Controller?: string | null }>>([]);
  const [deviceLists, setDevices] = useState<Array<{ Device: string; DeviceName: string; DeviceType: string; Division: string; Controller?: string | null }>>([]);

  const [FiltereddeviceLists, setFiltereddevice] = useState<Array<{ Device: string; DeviceName: string; DeviceType: string; Division: string; Controller?: string | null }>>([]);
 
  //console.log("divisionLists（State直後）=", divisionLists);
  //console.log("deviceLists（State直後）=", deviceLists);
  console.log("FiltereddeviceLists（State直後）=", FiltereddeviceLists);

  //デフォルトのdivision、device設定。
  useEffect(() => {
    if (divisionLists.length > 0 && deviceLists.length > 0) {
      const selectedDivision = divisionLists[currentDivisionIndex].Division;
      const filtered = deviceLists.filter(item => item.Division === selectedDivision && (item.DeviceType === 'Aircon' || item.DeviceType === 'Power'));
      setFiltereddevice(filtered);
      console.log('☆currentDivisionIndex（useEffect）=', currentDivisionIndex)
      console.log('☆selectedDivision（useEffect）=', selectedDivision)
      console.log('☆filtered（useEffect）=', filtered)
    }
  }, [divisionLists, deviceLists, currentDivisionIndex, currentDeviceIndex]);

  //グラフデータの抽出。
  useEffect(() => {
    async function fetchData() {
      await listIot();
    }
    fetchData();
  //}, [currentDivisionIndex, currentDeviceIndex]);
 // }, [startDate, endDate, currentDivisionIndex, currentDeviceIndex]);
  }, [endDate, currentDivisionIndex, currentDeviceIndex]);


  async function listIot() {

    //const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    //const endDatetime = `${format(endDate, "yyyy-MM-dd")} 23:59:59+09:00`;
    const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    const endDatetime = `${format(endDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    //const startDatetime = startDate.toISOString(); // 例: 2025-01-30T15:00:00.000Z
    //const endDatetime = endDate.toISOString();     // 例: 2025-01-31T14:59:59.999Z
    //const startDatetime = `${format(startDate, "yyyy-MM-dd'T'00:00:00xxx")}`; // JSTで +09:00 を含む
    //const endDatetime = `${format(endDate, "yyyy-MM-dd'T'23:59:59xxx")}`;
    //const startDatetime = `${format(startDate, "yyyy-MM-dd HH:mm:ssxxx")}`;
    //const endDatetime = `${format(endDate, "yyyy-MM-dd HH:mm:ssxxx")}`;

    console.log('★★★startDate（listIot-queries直前）=', startDate)
    console.log('★★★endDate（listIot-queries直前）=', endDate)
    console.log('★★★startDatetime（listIot-queries直前）=', startDatetime)
    console.log('★★★endDatetime（listIot-queries直前）=', endDatetime)
    const { data, errors } = await client.queries.listIot({
      Controller: "Mutsu01",
      StartDatetime: startDatetime,
      EndDatetime: endDatetime,
    });
    console.log('★★★Iotdata（listIot-queries直後）=', data)
    console.log('★★★errors（listIot-queries直後）=', errors)

    if (data && data.length > 2) {
      const third = data[2];
      console.log("3番目のIotデータ:", third);
    } 

    //console.log("StartDatetime=", startDate);
    //console.log("EndDatetime=", endDate);
    //追記部分: divisionListsのデータ取得と状態更新


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
          (
            (item?.DeviceType === 'Aircon' || item?.DeviceType === 'Power') && 
            FiltereddeviceLists[currentDeviceIndex]?.Device === item?.Device
          )
        )
      )

        .map(item => {
          return {
            DeviceDatetime: item?.DeviceDatetime ?? '',
            ActualTemp: item?.ActualTemp !== undefined && item.ActualTemp !== null ? parseFloat(item.ActualTemp) : null,
            ActivePower: item?.ActivePower !== undefined && item.ActivePower !== null ? parseFloat(item.ActivePower) : null,
            ApparentPower: item?.ApparentPower !== undefined && item.ApparentPower !== null ? parseFloat(item.ApparentPower) : null,
            CumulativeEnergy: item?.CumulativeEnergy !== undefined && item.CumulativeEnergy !== null ? parseFloat(item.CumulativeEnergy) : null,
            WeightedTemp: item?.WeightedTemp !== undefined && item.WeightedTemp !== null ? parseFloat(item.WeightedTemp) : null,
            TargetTemp: item?.TargetTemp !== undefined && item.TargetTemp !== null ? parseFloat(item.TargetTemp) : null,
            PresetTemp: item?.PresetTemp !== undefined && item.PresetTemp !== null ? parseFloat(item.PresetTemp) : null,
            ReferenceTemp: item?.ReferenceTemp !== undefined && item.ReferenceTemp !== null ? parseFloat(item.ReferenceTemp) : null,
            ControlStage: item?.ControlStage ?? null,
            Device: item?.Device ?? '',
            Division: item?.Division ?? '',
            DivisionName: divisionLists?.[currentDivisionIndex]?.DivisionName ?? '', // オプショナルチェーンを使用

          };
        });

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

  // デバイスごとのデータを統合して表示。
 
  const mergedData = chartData.map(item => {
    const newItem: Record<string, any> = {
      DeviceDatetime: item.DeviceDatetime,
      //DeviceName: item.Device ? (deviceNameMapping?.[item.Device] ?? item.Device) : "Unknown" //←consoleエラー。
    };

    Object.keys(groupedData).forEach(device => {
      const deviceData = groupedData[device].find(d => d.DeviceDatetime === item.DeviceDatetime);
      newItem[device] = deviceData ? deviceData.ActualTemp : null;
    });

    newItem.WeightedTemp = item.WeightedTemp;
    newItem.TargetTemp = item.TargetTemp;
    newItem.PresetTemp = item.PresetTemp;
    newItem.ReferenceTemp = item.ReferenceTemp;
    newItem.ControlStage = item.ControlStage;
    newItem.ActivePower = item.ActivePower;  
    newItem.ApparentPower = item.ApparentPower;   
    newItem.CumulativeEnergy = item.CumulativeEnergy;
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

  
  interface CustomTickProps {
    x: number;
    y: number;
    payload: {
      value: string;
    };
  }

  // カスタムのTickコンポーネント  
  const CustomTick: React.FC<CustomTickProps> = ({ x, y, payload }) => {
    const date = new Date(payload.value);
    const monthDay = `${date.getMonth() + 1}-${date.getDate()}`;
    const hour = date.getHours();
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="middle" fill="#666">
          {monthDay}
        </text>
        <text x={0} y={20} dy={16} textAnchor="middle" fill="#666">
          {hour}
        </text>
      </g>
    );
  };

  // DeviceとDeviceNameのマッピングを作成
  const deviceNameMapping = deviceLists
  .filter(item => item.DeviceType === 'Temp') //DeviceTypeが'Temp'である項目に限定して
  .reduce<Record<string, string>>((acc, item) => {
    acc[item.Device] = item.DeviceName;
    return acc;
  }, {});


  const handleDownloadCSV = () => {
    if (chartData.length === 0) {
      alert("データがありません");
      return;
  }

  const csv = Papa.unparse(chartData);

  const bom = new Uint8Array([0xef, 0xbb, 0xbf]); // 追加：BOM
  const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8;" }); // 修正：BOM付きでBlobを作成

  //const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const filename = `iot_data_${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}.csv`;
  saveAs(blob, filename);
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
        <button onClick={handleDownloadCSV}>CSVダウンロード</button>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="DeviceDatetime"  
              tick={props => <CustomTick {...props} />} 
              angle={0} 
              textAnchor="middle" 
              height={40} 
              //interval={1} // 1時間おきに目盛りを表示。
            />

            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <YAxis yAxisId="right2" orientation="right" axisLine={false} tickLine={false} />

            <YAxis />
            <Tooltip />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
            {Object.keys(groupedData).map((device, index) => (
              deviceNameMapping[device] && ( // deviceNameMappingに存在するデバイスのみ表示
              <Line
                key={device}
                type="monotone"
                dataKey={device}
                //name={device}
                name={deviceNameMapping[device]} // DeviceNameを使用
                stroke={colors[index % colors.length]} // デバイスごとに色を変更
                dot={false}
                connectNulls
              />
              )
            ))}

            <Line
              type="monotone"
              dataKey="WeightedTemp"
              name="WeightedTemp"
              stroke="#ff0000" // 赤色
              strokeWidth={3} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="TargetTemp"
              name="TargetTemp"
              stroke="#00ff00"
              strokeWidth={3} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="PresetTemp"
              name="PresetTemp"
              stroke="#0000ff"
              strokeWidth={3} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
              >
              <LabelList dataKey="ControlStage" position="top" style={{ fontSize: '6px', fill: '#000' }} />
            </Line>

            <Line
              type="monotone"
              dataKey="ReferenceTemp"
              name="ReferenceTemp"
              stroke="#800080"
              strokeWidth={3} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            <Line
              yAxisId="right2"
              type="monotone"
              dataKey="ActivePower"
              name="ActivePower"
              stroke="orange" // オレンジ色
              strokeWidth={2} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            <Line
              yAxisId="right2"
              type="monotone"
              dataKey="ApparentPower"
              name="ApparentPower"
              stroke="orange" // オレンジ色
              strokeWidth={1} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="CumulativeEnergy"
              name="CumulativeEnergy"
              stroke="orange" // オレンジ色
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

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
//import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, parseISO } from "date-fns";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

import { saveAs } from 'file-saver'; // 追加: ファイル保存用ライブラリ
import Papa from 'papaparse'; // 追加: CSV変換用ライブラリ

//Amplify.configure(outputs);

const client = generateClient<Schema>();

interface ChartData {
  DeviceDatetime: string;
  ControlStage: string | null;
  Device: string;
  ActualTemp: number | null;
  WeightedTemp: number | null;
  TargetTemp: number | null;
  PresetTemp: number | null;
  ReferenceTemp: number | null;
  CumulativeEnergy: number | null;
  ActivePower: number | null;
  ApparentPower: number | null;
  Division: string;
  DivisionName?: string; // DivisionNameを追加
}

export default function App() {

  const [startDate, setStartDatetime] = useState(new Date()); 
  const [endDate, setEndDatetime] = useState(new Date());

  //ここに追加
  useEffect(() => {
    const nextDay = new Date(startDate);
    nextDay.setDate(startDate.getDate() + 1);
    setEndDatetime(nextDay); //ここでendDateを更新。
  }, [startDate]);

  const [chartData, setChartData] = useState<ChartData[]>([]);

  const [currentDivisionIndex, setCurrentDivisionIndex] = useState(0);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);

  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; Controller?: string | null }>>([]);
  const [deviceLists, setDevices] = useState<Array<{ Device: string; DeviceName: string; DeviceType: string; Division: string; Controller?: string | null }>>([]);

  const [FiltereddeviceLists, setFiltereddevice] = useState<Array<{ Device: string; DeviceName: string; DeviceType: string; Division: string; Controller?: string | null }>>([]);
 
  //console.log("divisionLists（State直後）=", divisionLists);
  //console.log("deviceLists（State直後）=", deviceLists);
  console.log("FiltereddeviceLists（State直後）=", FiltereddeviceLists);

  //デフォルトのdivision、device設定。
  useEffect(() => {
    if (divisionLists.length > 0 && deviceLists.length > 0) {
      const selectedDivision = divisionLists[currentDivisionIndex].Division;
      const filtered = deviceLists.filter(item => item.Division === selectedDivision && (item.DeviceType === 'Aircon' || item.DeviceType === 'Power'));
      setFiltereddevice(filtered);
      console.log('☆currentDivisionIndex（useEffect）=', currentDivisionIndex)
      console.log('☆selectedDivision（useEffect）=', selectedDivision)
      console.log('☆filtered（useEffect）=', filtered)
    }
  }, [divisionLists, deviceLists, currentDivisionIndex, currentDeviceIndex]);

  //グラフデータの抽出。
  useEffect(() => {
    async function fetchData() {
      await listIot();
    }
    fetchData();
  //}, [currentDivisionIndex, currentDeviceIndex]);
 // }, [startDate, endDate, currentDivisionIndex, currentDeviceIndex]);
  }, [endDate, currentDivisionIndex, currentDeviceIndex]);


  async function listIot() {

    //const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    //const endDatetime = `${format(endDate, "yyyy-MM-dd")} 23:59:59+09:00`;
    const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    const endDatetime = `${format(endDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    //const startDatetime = startDate.toISOString(); // 例: 2025-01-30T15:00:00.000Z
    //const endDatetime = endDate.toISOString();     // 例: 2025-01-31T14:59:59.999Z
    //const startDatetime = `${format(startDate, "yyyy-MM-dd'T'00:00:00xxx")}`; // JSTで +09:00 を含む
    //const endDatetime = `${format(endDate, "yyyy-MM-dd'T'23:59:59xxx")}`;
    //const startDatetime = `${format(startDate, "yyyy-MM-dd HH:mm:ssxxx")}`;
    //const endDatetime = `${format(endDate, "yyyy-MM-dd HH:mm:ssxxx")}`;

    console.log('★★★startDate（listIot-queries直前）=', startDate)
    console.log('★★★endDate（listIot-queries直前）=', endDate)
    console.log('★★★startDatetime（listIot-queries直前）=', startDatetime)
    console.log('★★★endDatetime（listIot-queries直前）=', endDatetime)
    const { data, errors } = await client.queries.listIot({
      Controller: "Mutsu01",
      StartDatetime: startDatetime,
      EndDatetime: endDatetime,
    });
    console.log('★★★Iotdata（listIot-queries直後）=', data)
    console.log('★★★errors（listIot-queries直後）=', errors)

    //console.log("StartDatetime=", startDate);
    //console.log("EndDatetime=", endDate);
    //追記部分: divisionListsのデータ取得と状態更新

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
  
    //console.log('deviceLists（listIot）=', deviceLists)
    console.log('★currentDivisionIndex（listIot）=', currentDivisionIndex)
    console.log('★currentDeviceIndex（listIot）=', currentDeviceIndex)
    console.log('★currentDeviceIndex.Device（listIot）=', FiltereddeviceLists?.[currentDeviceIndex]?.Device) 
    //console.log('currentDeviceIndex[1]=', deviceLists?.[1]?.Device)

    const powerRows = chartData.filter(item => {
      return (
        item?.Device &&
        deviceLists?.find(d => d?.Device === item.Device && d.DeviceType === 'Power') &&
        item.CumulativeEnergy !== null &&
        item.CumulativeEnergy !== undefined
      );
    });
    const firstPowerRow = powerRows.sort((a, b) => new Date(a.DeviceDatetime).getTime() - new Date(b.DeviceDatetime).getTime())[0];
    console.log('☆☆☆firstPowerRow=', firstPowerRow)

    if (data) { 

      const formattedData = data

      .filter(item => 
        divisionLists?.[currentDivisionIndex]?.Division && // オプショナルチェーンを使用
        item?.Division === divisionLists[currentDivisionIndex].Division && 

        (
          item?.DeviceType === 'Temp' || 
          (
            (item?.DeviceType === 'Aircon' || item?.DeviceType === 'Power') && 
            FiltereddeviceLists[currentDeviceIndex]?.Device === item?.Device
          )
        )
      )

        .map(item => {
          return {
            DeviceDatetime: item?.DeviceDatetime ?? '',
            ActualTemp: item?.ActualTemp !== undefined && item.ActualTemp !== null ? parseFloat(item.ActualTemp) : null,
            ActivePower: item?.ActivePower !== undefined && item.ActivePower !== null ? parseFloat(item.ActivePower) : null,
            ApparentPower: item?.ApparentPower !== undefined && item.ApparentPower !== null ? parseFloat(item.ApparentPower) : null,
            CumulativeEnergy: item?.CumulativeEnergy !== undefined && item.CumulativeEnergy !== null ? parseFloat(item.CumulativeEnergy) : null,
            WeightedTemp: item?.WeightedTemp !== undefined && item.WeightedTemp !== null ? parseFloat(item.WeightedTemp) : null,
            TargetTemp: item?.TargetTemp !== undefined && item.TargetTemp !== null ? parseFloat(item.TargetTemp) : null,
            PresetTemp: item?.PresetTemp !== undefined && item.PresetTemp !== null ? parseFloat(item.PresetTemp) : null,
            ReferenceTemp: item?.ReferenceTemp !== undefined && item.ReferenceTemp !== null ? parseFloat(item.ReferenceTemp) : null,
            ControlStage: item?.ControlStage ?? null,
            Device: item?.Device ?? '',
            Division: item?.Division ?? '',
            DivisionName: divisionLists?.[currentDivisionIndex]?.DivisionName ?? '', // オプショナルチェーンを使用

          };
        });

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

  // デバイスごとのデータを統合して表示。
 
  const mergedData = chartData.map(item => {
    const newItem: Record<string, any> = {
      DeviceDatetime: item.DeviceDatetime,
      //DeviceName: item.Device ? (deviceNameMapping?.[item.Device] ?? item.Device) : "Unknown" //←consoleエラー。
    };

    Object.keys(groupedData).forEach(device => {
      const deviceData = groupedData[device].find(d => d.DeviceDatetime === item.DeviceDatetime);
      newItem[device] = deviceData ? deviceData.ActualTemp : null;
    });

    newItem.WeightedTemp = item.WeightedTemp;
    newItem.TargetTemp = item.TargetTemp;
    newItem.PresetTemp = item.PresetTemp;
    newItem.ReferenceTemp = item.ReferenceTemp;
    newItem.ControlStage = item.ControlStage;
    newItem.ActivePower = item.ActivePower;  
    newItem.ApparentPower = item.ApparentPower;   
    newItem.CumulativeEnergy = item.CumulativeEnergy;
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

  
  interface CustomTickProps {
    x: number;
    y: number;
    payload: {
      value: string;
    };
  }

  // カスタムのTickコンポーネント  
  const CustomTick: React.FC<CustomTickProps> = ({ x, y, payload }) => {
    const date = new Date(payload.value);
    const monthDay = `${date.getMonth() + 1}-${date.getDate()}`;
    const hour = date.getHours();
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="middle" fill="#666">
          {monthDay}
        </text>
        <text x={0} y={20} dy={16} textAnchor="middle" fill="#666">
          {hour}
        </text>
      </g>
    );
  };

  // DeviceとDeviceNameのマッピングを作成
  const deviceNameMapping = deviceLists
  .filter(item => item.DeviceType === 'Temp') //DeviceTypeが'Temp'である項目に限定して
  .reduce<Record<string, string>>((acc, item) => {
    acc[item.Device] = item.DeviceName;
    return acc;
  }, {});


  const handleDownloadCSV = () => {
    if (chartData.length === 0) {
      alert("データがありません");
      return;
  }

  const csv = Papa.unparse(chartData);

  const bom = new Uint8Array([0xef, 0xbb, 0xbf]); // 追加：BOM
  const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8;" }); // 修正：BOM付きでBlobを作成

  //const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const filename = `iot_data_${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}.csv`;
  saveAs(blob, filename);
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
        <button onClick={handleDownloadCSV}>CSVダウンロード</button>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="DeviceDatetime"  
              tick={props => <CustomTick {...props} />} 
              angle={0} 
              textAnchor="middle" 
              height={40} 
              //interval={1} // 1時間おきに目盛りを表示。
            />

            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <YAxis yAxisId="right2" orientation="right" axisLine={false} tickLine={false} />

            <YAxis />
            <Tooltip />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
            {Object.keys(groupedData).map((device, index) => (
              deviceNameMapping[device] && ( // deviceNameMappingに存在するデバイスのみ表示
              <Line
                key={device}
                type="monotone"
                dataKey={device}
                //name={device}
                name={deviceNameMapping[device]} // DeviceNameを使用
                stroke={colors[index % colors.length]} // デバイスごとに色を変更
                dot={false}
                connectNulls
              />
              )
            ))}

            <Line
              type="monotone"
              dataKey="WeightedTemp"
              name="WeightedTemp"
              stroke="#ff0000" // 赤色
              strokeWidth={3} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="TargetTemp"
              name="TargetTemp"
              stroke="#00ff00"
              strokeWidth={3} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="PresetTemp"
              name="PresetTemp"
              stroke="#0000ff"
              strokeWidth={3} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
              >
              <LabelList dataKey="ControlStage" position="top" style={{ fontSize: '6px', fill: '#000' }} />
            </Line>

            <Line
              type="monotone"
              dataKey="ReferenceTemp"
              name="ReferenceTemp"
              stroke="#800080"
              strokeWidth={3} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            <Line
              yAxisId="right2"
              type="monotone"
              dataKey="ActivePower"
              name="ActivePower"
              stroke="orange" // オレンジ色
              strokeWidth={2} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            <Line
              yAxisId="right2"
              type="monotone"
              dataKey="ApparentPower"
              name="ApparentPower"
              stroke="orange" // オレンジ色
              strokeWidth={1} // 太線にする
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="CumulativeEnergy"
              name="CumulativeEnergy"
              stroke="orange" // オレンジ色
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