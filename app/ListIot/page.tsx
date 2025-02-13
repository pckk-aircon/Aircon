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

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter } from 'recharts';

Amplify.configure(outputs);

const client = generateClient<Schema>();

interface ChartData {
  DeviceDatetime: string;
  ActualTemp: number | null;
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
        .filter(item => item?.Division === divisions[currentDivisionIndex])
        .map(item => ({
          DeviceDatetime: item?.DeviceDatetime ?? '',
          ActualTemp: item?.ActualTemp !== undefined && item.ActualTemp !== null ? parseFloat(item.ActualTemp) : null,
          TargetTemp: item?.TargetTemp !== undefined && item.TargetTemp !== null ? parseFloat(item.TargetTemp) : null,
          PresetTemp: item?.PresetTemp !== undefined && item.PresetTemp !== null ? parseFloat(item.PresetTemp) : null,
          ReferenceTemp: item?.ReferenceTemp !== undefined && item.ReferenceTemp !== null ? parseFloat(item.ReferenceTemp) : null,
          ControlStage: item?.ControlStage ?? null,
          Device: item?.Device ?? '',
          Division: item?.Division ?? '',
        }));

      formattedData.sort((a, b) => parseISO(a.DeviceDatetime).getTime() - parseISO(b.DeviceDatetime).getTime());

      console.log('Formatted Data:', formattedData);

      setChartData(formattedData);
    }
  }

  const groupedData = chartData.reduce<Record<string, ChartData[]>>((acc, item) => {
    if (!acc[item.Device]) {
      acc[item.Device] = [];
    }
    acc[item.Device].push(item);
    return acc;
  }, {});

  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#387908"];

  const mergedData = chartData.map(item => {
    const newItem: Record<string, any> = { DeviceDatetime: item.DeviceDatetime };
    Object.keys(groupedData).forEach(device => {
      const deviceData = groupedData[device].find(d => d.DeviceDatetime === item.DeviceDatetime);
      newItem[device] = deviceData ? deviceData.ActualTemp : null;
    });
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

  const getDotColor = (ControlStage: string | null) => {
    switch (ControlStage) {
      case '1a':
        return '#ff0000';
      case '1b':
        return '#00ff00';
      case '2a':
        return '#0000ff';
      case '2b':
        return '#ffff00';
      case '3a':
        return '#ff00ff';
      case '3b':
        return '#00ffff';
      default:
        return '#000000';
    }
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    console.log('CustomDot props:', props); // ここでログを確認
    const color = getDotColor(payload.ControlStage);
    const size = 4;

    return <circle cx={cx} cy={cy} r={size} fill={color} />;
  };

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
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="DeviceDatetime" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {Object.keys(groupedData).map((device, index) => (
              <Line
                key={device}
                type="monotone"
                dataKey={device}
                name={device}
                stroke={colors[index % colors.length]}
                dot={{ r: 0.2, fill: colors[index % colors.length] }}
                connectNulls
              />
            ))}
            <Line
              type="monotone"
              dataKey="TargetTemp"
              name="TargetTemp"
              stroke="#00ff00"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="PresetTemp"
              name="PresetTemp"
              stroke="#0000ff"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="ReferenceTemp"
              name="ReferenceTemp"
              stroke="#800080"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Scatter
              name="ControlStage"
              data={chartData}
              fill="#000000"
              shape={<CustomDot />}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}