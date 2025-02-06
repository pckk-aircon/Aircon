"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
//import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import DatePicker from "react-datepicker";//インストール要。
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";//フォーマット変換。インストール要。


import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { ChartData } from 'chart.js';


Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {


  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [posts, setPosts] = useState<Array<Schema["Post"]["type"]>>([]); //Postを追加。
  const [devices, setDevices] = useState<Array<Schema["Post"]["type"]>>([]); //Postを追加。

  const [startDate, setStartDatetime] = useState(new Date());//本日の日付をデフォルト表示。
  const [endDate, setEndDatetime] = useState(new Date());//本日の日付をデフォルト表示。

  const [chartData, setChartData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: [],
  });// ここを追加


  const options = {
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2,
      },
    },
  };

  interface Device {
    Device: string;
    Controller: string;
    DeviceType: string;
  }


  useEffect(() => {
    listIot (); // Postの初期表示

    //サブスクリプションの設定をuseEffect()の中に移動。
    const sub = client.subscriptions.receivePost()
    .subscribe({
      next: event => {
        console.log(event)
        setPosts(prevPosts => [...prevPosts, event]);
      },
    });

    // クリーンアップ関数を返してサブスクリプションを解除
    return () => sub.unsubscribe();

  //}, []);
  }, [startDate, endDate]);//★startDatetimeとendDatetimeが変更されたときにlistIot関数を呼び出す

  //Iotのデータを抽出。
    async function listIot () {

      const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
      const endDatetime = `${format(endDate, "yyyy-MM-dd")} 23:59:59+09:00`;

      console.log("StartDatetime=", startDate); // デバッグ用のログ出力
      console.log("EndDatetime=", endDate); // デバッグ用のログ出力

      const { data, errors } = await client.queries.listIot({

        Controller: "Mutsu01",//Controllerが"Mutsu01"であるデータを抽出。
        StartDatetime: startDatetime,//★修正
        EndDatetime: endDatetime,//★修正
      });
      console.log('listIot=',data)
  
      if (data) {
        const labels = data.map(item => item?.DeviceDatetime ?? '');
        //const temps = data.map(item => item?.ActualTemp ?? 0);
        const temps = data.map(item => {
          const temp = item?.ActualTemp !== undefined && item.ActualTemp !== null ? parseFloat(item.ActualTemp) : NaN;
          console.log('ActualTemp:', temp); // デバッグ用
          return !isNaN(temp) ? temp : 0;
        });


        setChartData({
          labels: labels,
          datasets: [
            {
              label: 'Actual Temperature',
              data: temps.map(temp => typeof temp === 'number' ? temp : 0), // 数値に変換
              borderColor: 'rgba(75,192,192,1)',
              backgroundColor: 'rgba(75,192,192,0.2)',
              fill: false,
              pointRadius: 0, // ポイントを非表示
              borderWidth: 2, // ラインの太さを設定
              //showLine: true, // 縦のラインを表示
            },
          ],
        });

      }
}

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
        <Line data={chartData} options={options} />
      </div>

    </main>

  );
}