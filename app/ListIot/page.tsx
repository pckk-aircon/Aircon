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
}

export default function App() {

  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [posts, setPosts] = useState<Array<Schema["Post"]["type"]>>([]);
  const [devices, setDevices] = useState<Array<Schema["Post"]["type"]>>([]);

  const [startDate, setStartDatetime] = useState(new Date());
  const [endDate, setEndDatetime] = useState(new Date());

  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [currentDivisionIndex, setCurrentDivisionIndex] = useState(0);

  const divisions = ["MUTS-Flower", "MUTS-Dining", "MUTS-Rest"];

  interface Device {
    Device: string;
    Controller: string;
    DeviceType: string;
  }

  useEffect(() => {
    listIot();
  }, [startDate, endDate, currentDivisionIndex]);

  async function listIot() {

    const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
    const endDatetime = `${format(endDate, "yyyy-MM-dd")} 23:59:59+09:00`;

    console.log("StartDatetime=", startDate);
    console.log("EndDatetime=", endDate);

    const { data, errors } = await client.queries.listIot({
      Controller: "Mutsu01",
      StartDatetime: startDatetime,
      EndDatetime: endDatetime,
    });
    console.log('listIot=', data)

    if (data) {
      const formattedData = data
        .filter(item => item?.Division === divisions[currentDivisionIndex]) // Divisionでフィルタリング
        .map(item => ({
          DeviceDatetime: item?.DeviceDatetime ?? '',
          ActualTemp: item?.ActualTemp !== undefined && item.ActualTemp !== null ? parseFloat(item.ActualTemp) : null,
          WeightedTemp: item?.WeightedTemp !== undefined && item.WeightedTemp !== null ? parseFloat(item.WeightedTemp) : null,
          TargetTemp: item?.TargetTemp !== undefined && item.TargetTemp !== null ? parseFloat(item.TargetTemp) : null,
          PresetTemp: item?.PresetTemp !== undefined && item.PresetTemp !== null ? parseFloat(item.PresetTemp) : null,
          ReferenceTemp: item?.ReferenceTemp !== undefined && item.ReferenceTemp !== null ? parseFloat(item.ReferenceTemp) : null,
          ControlStage: item?.ControlStage ?? null,
          Device: item?.Device ?? '',
          Division: item?.Division ?? '',
        }));

      // DeviceDatetime順にソート（Deviceをソートキーに含めない）
      formattedData.sort((a, b) => parseISO(a.DeviceDatetime).getTime() - parseISO(b.DeviceDatetime).getTime());

      console.log('Formatted Data:', formattedData);

      setChartData(formattedData);
    }
  }

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
    newItem.WeightedTemp = item.WeightedTemp;
    newItem.TargetTemp = item.TargetTemp;
    newItem.PresetTemp = item.PresetTemp;
    newItem.ReferenceTemp = item.ReferenceTemp;
    newItem.ControlStage = item.ControlStage;
    return newItem;
  });

  const handleNext = () => {
    setCurrentDivisionIndex((prevIndex) => (prevIndex + 1) % divisions.length);
  };

  const handlePrevious = () => {
    setCurrentDivisionIndex((prevIndex) => (prevIndex - 1 + divisions.length) % divisions.length);
  };

  // ControlStageに応じたプロットの色を設定
  const getDotColor = (controlStage: string | null) => {
    switch (controlStage) {
      case '1a':
        return 'aliceblue';
      case '1b':
        return 'lightsteelblue';
      case '1c':
        return 'steelblue';
      case '1cD':
        return 'royalblue';
      case '2a':
        return 'midnightblue';
      case '2b':
        return 'mediumblue';
      case '2c1':
        return 'dodgerblue';
      case '2c2':
        return 'deepskyblue';
      case '2c3':
        return 'skyblue';
      case '2d':
        return 'cyan';
      default:
        return '#000000'; // その他
    }
  };

  // カスタムドットコンポーネント
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const color = getDotColor(payload.ControlStage);
    const size = 4;

    return <circle cx={cx} cy={cy} r={size} fill={color} />;
  };

  // カスタムツールチップコンポーネント
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
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
    return format(parseISO(tickItem), "MM-dd HH");
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
        <button onClick={handlePrevious}>前へ</button>
        <button onClick={handleNext}>次へ</button>
      </div>

      <div>
        <h1>Temperature Data for {divisions[currentDivisionIndex]}</h1>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="1 1" vertical={false} />
            <XAxis dataKey="DeviceDatetime" tickFormatter={formatXAxis} angle={45} textAnchor="end" height={70} />

            <XAxis 
              dataKey="DeviceDatetime" 
              tickFormatter={formatXAxis} 
              angle={45} 
              textAnchor="end" 
              height={70} 
              interval={0} // すべてのラベルを表示
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
                return <circle cx={cx} cy={cy} r={5} fill={color} />;
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