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
  ActualTemp: number;
  Device: string;
}

export default function App() {

  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [posts, setPosts] = useState<Array<Schema["Post"]["type"]>>([]);
  const [devices, setDevices] = useState<Array<Schema["Post"]["type"]>>([]);

  const [startDate, setStartDatetime] = useState(new Date());
  const [endDate, setEndDatetime] = useState(new Date());

  const [chartData, setChartData] = useState<ChartData[]>([]);

  interface Device {
    Device: string;
    Controller: string;
    DeviceType: string;
  }

  useEffect(() => {
    listIot();

    const sub = client.subscriptions.receivePost()
    .subscribe({
      next: event => {
        console.log(event)
        setPosts(prevPosts => [...prevPosts, event]);
      },
    });

    return () => sub.unsubscribe();

  }, [startDate, endDate]);

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
      const formattedData = data.map(item => ({
        DeviceDatetime: item?.DeviceDatetime ?? '',
        ActualTemp: item?.ActualTemp !== undefined && item.ActualTemp !== null ? parseFloat(item.ActualTemp) : 0,
        Device: item?.Device ?? '',
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

  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#387908"];

  // デバイスごとのデータを統合して表示
  const mergedData = chartData.map(item => {
    const newItem: Record<string, any> = { DeviceDatetime: item.DeviceDatetime };
    Object.keys(groupedData).forEach(device => {
      const deviceData = groupedData[device].find(d => d.DeviceDatetime === item.DeviceDatetime);
      newItem[device] = deviceData ? deviceData.ActualTemp : null;
    });
    return newItem;
  });

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
        <h1>Temperature Data</h1>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="DeviceDatetime" />
            <YAxis />
            <Tooltip />
            <Legend />
            {Object.keys(groupedData).map((device, index) => (
              <Line
                key={device}
                type="monotone"
                dataKey={device}
                name={device}
                stroke={colors[index % colors.length]}
                dot={{ r: 0.2, fill: colors[index % colors.length] }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}