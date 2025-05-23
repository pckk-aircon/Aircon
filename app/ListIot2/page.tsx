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

            <YAxis />
            <Tooltip />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
            {Object.keys(groupedData).map((device, index) => (
              <Line
                key={device}
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