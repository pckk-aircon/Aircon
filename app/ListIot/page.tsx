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
  Division: string;
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
        Division: item?.Division ?? '',
      }));

      // DeviceDatetime順にソート（Deviceをソートキーに含めない）
      formattedData.sort((a, b) => parseISO(a.DeviceDatetime).getTime() - parseISO(b.DeviceDatetime).getTime());

      console.log('Formatted Data:', formattedData);

      setChartData(formattedData);
    }
  }

  // Divisionごとにデータをグループ化
  const groupedData = chartData.reduce<Record<string, ChartData[]>>((acc, item) => {
    if (!acc[item.Division]) {
      acc[item.Division] = [];
    }
    acc[item.Division].push(item);
    return acc;
  }, {});

  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#387908"];

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

      {Object.keys(groupedData).map((division, index) => (
        <div key={division} style={{ marginBottom: '50px' }}>
          <h2>{division}</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={groupedData[division]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="DeviceDatetime" />
              <YAxis />
              <Tooltip />
              <Legend />
              {groupedData[division].map((item, idx) => (
                <Line
                  key={item.Device}
                  type="monotone"
                  dataKey="ActualTemp"
                  name={item.Device}
                  stroke={colors[idx % colors.length]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </main>
  );
}