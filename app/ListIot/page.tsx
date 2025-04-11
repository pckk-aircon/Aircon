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
  WeightedTemp: number | null;
  TargetTemp: number | null;
  PresetTemp: number | null;
  ReferenceTemp: number | null;
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
  console.log("currentDivisionIndex（State直後）=", currentDivisionIndex);
  console.log("currentDeviceIndex（State直後）=", currentDeviceIndex);

  //const DeviceLists = ["1234-kaki2", "1234-kaki3"];
  
  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; DeviceType:string; Controller?: string | null }>>([]);
  const [deviceLists, setDevices] = useState<Array<{ Device: string; DeviceName: string; DeviceType:string; Division: string; Controller?: string | null }>>([]);
  console.log("divisionLists（State直後）=", divisionLists);
  console.log("deviceLists（State直後）=", deviceLists);


  useEffect(() => {
    async function fetchData() {
        await listIot();
    }
    fetchData();
  }, [startDate, endDate, currentDivisionIndex, currentDeviceIndex]);

  async function listIot() {
    const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    const endDatetime = `${format(endDate, "yyyy-MM-dd")} 23:59:59+09:00`;

    console.log("StartDatetime=", startDate);
    console.log("EndDatetime=", endDate);

    // 追記部分: divisionListsのデータ取得と状態更新

    const {data: divisionLists, errors: divisionErrors } = await client.queries.listDivision({
      Controller: "Mutsu01",
    });
    if (divisionLists) {
      setPosts(divisionLists as Array<{ Division: string; DivisionName: string; DeviceType:string; Controller?: string | null }>); // 型を明示的にキャストする
    }

    const {data: deviceLists, errors: deviceErrors } = await client.queries.listDevice({
      Controller: "Mutsu01",
    });
    if (deviceLists) {
      setDevices(deviceLists as Array<{ Device: string; DeviceName: string; DeviceType:string; Division: string; Controller?: string | null }>); // 型を明示的にキャストする
    }

    console.log('divisionLists（queries後）=', divisionLists)

    const { data, errors } = await client.queries.listIot({
      Controller: "Mutsu01",
      StartDatetime: startDatetime,
      EndDatetime: endDatetime,
    });

    console.log('Iotdata=', data)

    if (data) { 

      const formattedData = data

      .filter(item => 
        divisionLists?.[currentDivisionIndex]?.Division && // オプショナルチェーンを使用
        item?.Division === divisionLists[currentDivisionIndex].Division && 
        (
         item?.DeviceType === 'Temp' || 
        (item?.DeviceType === 'Aircon' && deviceLists?.[currentDeviceIndex]?.Device === item?.Device))
      ) //ここはグラフ表示部分なので、'Temp'と'Aircon'両方を抽出する。

        .map(item => {
          return {
            DeviceDatetime: item?.DeviceDatetime ?? '',
            ActualTemp: item?.ActualTemp !== undefined && item.ActualTemp !== null ? parseFloat(item.ActualTemp) : null,
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

  const selectedDivision = divisionLists[currentDivisionIndex].Division
  //const filtereddeviceLists = deviceLists.filter(item => item.Division === selectedDivision);
  const filtereddeviceLists = deviceLists.filter(item => item.Division === selectedDivision && item.DeviceType === 'Aircon');

  console.log("selectedDivision（handle直前1）=", selectedDivision); 
  console.log("divisionLists（handle直前1）=", divisionLists);
  console.log("deviceLists（handle直前1）=", deviceLists);
  console.log("filtereddeviceLists（handle直前1）=", filtereddeviceLists);

  // デバイスごとにデータをグループ化
  const groupedData = chartData.reduce<Record<string, ChartData[]>>((acc, item) => {
    if (!acc[item.Device]) {
      acc[item.Device] = [];
    }
    acc[item.Device].push(item);
    return acc;
  }, {});

  //deviceNameMapを作成。
  const deviceNameMap = deviceLists.reduce<Record<string, string>>((acc, item) => {
    acc[item.Device] = item.DeviceName;
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
    newItem.WeightedTemp = item.WeightedTemp;
    newItem.TargetTemp = item.TargetTemp;
    newItem.PresetTemp = item.PresetTemp;
    newItem.ReferenceTemp = item.ReferenceTemp;
    newItem.ControlStage = item.ControlStage;
    return newItem;
  });

  console.log("selectedDivision（handle直前1）=", selectedDivision); 
  console.log("divisionLists（handle直前2）=", divisionLists);
  console.log("deviceLists（handle直前2）=", deviceLists);
  console.log("filtereddeviceLists（handle直前2）=", filtereddeviceLists);

  const handleNext = () => {
    setCurrentDivisionIndex((prevIndex) => (prevIndex + 1) % divisionLists.length);
  };
  const handlePrevious = () => {
    setCurrentDivisionIndex((prevIndex) => (prevIndex - 1 + divisionLists.length) % divisionLists.length);
  };

  const DevicehandleNext = () => {
    setCurrentDeviceIndex((prevIndex) => (prevIndex + 1) % filtereddeviceLists.length);
  };
  const DevicehandlePrevious = () => {
    setCurrentDeviceIndex((prevIndex) => (prevIndex - 1 + filtereddeviceLists.length) % filtereddeviceLists.length);
  };

  // ControlStageに応じたプロットの色を設定
  const getDotColor = (controlStage: string | null) => {
    switch (controlStage) {
      case '1a':
        return 'lightsteelblue';
      case '1b':
        return 'royalblue';
      case '1c':
        return 'darkblue';
      case '1cD':
        return 'aqua';
      case '2a':
        return 'darkgreen';
      case '2b':
        return 'green';
      case '2c1':
        return 'yellow';
      case '2c2':
        return 'orangered';
      case '2c3':
        return 'red';
      case '2d':
        return 'lightgreen';
      default:
        return '#000000'; // その他
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="custom-tooltip">
          <p className="label">{`Time: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
          <p>{`ControlStage: ${payload[0].payload.ControlStage}`}</p>
        </div>
      );
    }
    return null;
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
        <h1>Temperature Data for {divisionLists[currentDivisionIndex].DivisionName} _ {filtereddeviceLists[currentDeviceIndex].DeviceName}</h1>
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
                name={deviceNameMap[device]} // ★★★Use DeviceName here
                stroke={colors[index % colors.length]} // デバイスごとに色を変更
                //dot={{ r: 0.1, fill: colors[index % colors.length] }} //デフォルトで〇が表示されることを回避
                dot={false}
                connectNulls
              />
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
              //dot={false}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const color = getDotColor(payload.ControlStage);
                return <circle cx={cx} cy={cy} r={4} fill={color} />;
              }}
              connectNulls
              isAnimationActive={false}
            />
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
  WeightedTemp: number | null;
  TargetTemp: number | null;
  PresetTemp: number | null;
  ReferenceTemp: number | null;
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
  console.log("currentDivisionIndex（State直後）=", currentDivisionIndex);
  console.log("currentDeviceIndex（State直後）=", currentDeviceIndex);

  //const DeviceLists = ["1234-kaki2", "1234-kaki3"];
  
  const [divisionLists, setPosts] = useState<Array<{ Division: string; DivisionName: string; DeviceType:string; Controller?: string | null }>>([]);
  const [deviceLists, setDevices] = useState<Array<{ Device: string; DeviceName: string; DeviceType:string; Division: string; Controller?: string | null }>>([]);
  console.log("divisionLists（State直後）=", divisionLists);
  console.log("deviceLists（State直後）=", deviceLists);


  useEffect(() => {
    async function fetchData() {
        await listIot();
    }
    fetchData();
  }, [startDate, endDate, currentDivisionIndex, currentDeviceIndex]);

  async function listIot() {
    const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    const endDatetime = `${format(endDate, "yyyy-MM-dd")} 23:59:59+09:00`;

    console.log("StartDatetime=", startDate);
    console.log("EndDatetime=", endDate);

    // 追記部分: divisionListsのデータ取得と状態更新

    const {data: divisionLists, errors: divisionErrors } = await client.queries.listDivision({
      Controller: "Mutsu01",
    });
    if (divisionLists) {
      setPosts(divisionLists as Array<{ Division: string; DivisionName: string; DeviceType:string; Controller?: string | null }>); // 型を明示的にキャストする
    }

    const {data: deviceLists, errors: deviceErrors } = await client.queries.listDevice({
      Controller: "Mutsu01",
    });
    if (deviceLists) {
      setDevices(deviceLists as Array<{ Device: string; DeviceName: string; DeviceType:string; Division: string; Controller?: string | null }>); // 型を明示的にキャストする
    }

    console.log('divisionLists（queries後）=', divisionLists)

    const { data, errors } = await client.queries.listIot({
      Controller: "Mutsu01",
      StartDatetime: startDatetime,
      EndDatetime: endDatetime,
    });

    console.log('Iotdata=', data)

    if (data) { 

      const formattedData = data

      .filter(item => 
        divisionLists?.[currentDivisionIndex]?.Division && // オプショナルチェーンを使用
        item?.Division === divisionLists[currentDivisionIndex].Division && 
        (
         item?.DeviceType === 'Temp' || 
        (item?.DeviceType === 'Aircon' && deviceLists?.[currentDeviceIndex]?.Device === item?.Device))
      ) //ここはグラフ表示部分なので、'Temp'と'Aircon'両方を抽出する。

        .map(item => {
          return {
            DeviceDatetime: item?.DeviceDatetime ?? '',
            ActualTemp: item?.ActualTemp !== undefined && item.ActualTemp !== null ? parseFloat(item.ActualTemp) : null,
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

  const selectedDivision = divisionLists[currentDivisionIndex].Division
  //const filtereddeviceLists = deviceLists.filter(item => item.Division === selectedDivision);
  const filtereddeviceLists = deviceLists.filter(item => item.Division === selectedDivision && item.DeviceType === 'Aircon');

  console.log("selectedDivision（handle直前1）=", selectedDivision); 
  console.log("divisionLists（handle直前1）=", divisionLists);
  console.log("deviceLists（handle直前1）=", deviceLists);
  console.log("filtereddeviceLists（handle直前1）=", filtereddeviceLists);

  // デバイスごとにデータをグループ化
  const groupedData = chartData.reduce<Record<string, ChartData[]>>((acc, item) => {
    if (!acc[item.Device]) {
      acc[item.Device] = [];
    }
    acc[item.Device].push(item);
    return acc;
  }, {});

  //deviceNameMapを作成。
  const deviceNameMap = deviceLists.reduce<Record<string, string>>((acc, item) => {
    acc[item.Device] = item.DeviceName;
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
    newItem.WeightedTemp = item.WeightedTemp;
    newItem.TargetTemp = item.TargetTemp;
    newItem.PresetTemp = item.PresetTemp;
    newItem.ReferenceTemp = item.ReferenceTemp;
    newItem.ControlStage = item.ControlStage;
    return newItem;
  });

  console.log("selectedDivision（handle直前1）=", selectedDivision); 
  console.log("divisionLists（handle直前2）=", divisionLists);
  console.log("deviceLists（handle直前2）=", deviceLists);
  console.log("filtereddeviceLists（handle直前2）=", filtereddeviceLists);

  const handleNext = () => {
    setCurrentDivisionIndex((prevIndex) => (prevIndex + 1) % divisionLists.length);
  };
  const handlePrevious = () => {
    setCurrentDivisionIndex((prevIndex) => (prevIndex - 1 + divisionLists.length) % divisionLists.length);
  };

  const DevicehandleNext = () => {
    setCurrentDeviceIndex((prevIndex) => (prevIndex + 1) % filtereddeviceLists.length);
  };
  const DevicehandlePrevious = () => {
    setCurrentDeviceIndex((prevIndex) => (prevIndex - 1 + filtereddeviceLists.length) % filtereddeviceLists.length);
  };

  // ControlStageに応じたプロットの色を設定
  const getDotColor = (controlStage: string | null) => {
    switch (controlStage) {
      case '1a':
        return 'lightsteelblue';
      case '1b':
        return 'royalblue';
      case '1c':
        return 'darkblue';
      case '1cD':
        return 'aqua';
      case '2a':
        return 'darkgreen';
      case '2b':
        return 'green';
      case '2c1':
        return 'yellow';
      case '2c2':
        return 'orangered';
      case '2c3':
        return 'red';
      case '2d':
        return 'lightgreen';
      default:
        return '#000000'; // その他
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="custom-tooltip">
          <p className="label">{`Time: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
          <p>{`ControlStage: ${payload[0].payload.ControlStage}`}</p>
        </div>
      );
    }
    return null;
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
        <h1>Temperature Data for {divisionLists[currentDivisionIndex].DivisionName} _ {filtereddeviceLists[currentDeviceIndex].DeviceName}</h1>
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
                name={deviceNameMap[device]} // ★★★Use DeviceName here
                stroke={colors[index % colors.length]} // デバイスごとに色を変更
                //dot={{ r: 0.1, fill: colors[index % colors.length] }} //デフォルトで〇が表示されることを回避
                dot={false}
                connectNulls
              />
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
              //dot={false}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const color = getDotColor(payload.ControlStage);
                return <circle cx={cx} cy={cy} r={4} fill={color} />;
              }}
              connectNulls
              isAnimationActive={false}
            />
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}