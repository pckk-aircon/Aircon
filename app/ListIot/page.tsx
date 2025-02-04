"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
//import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

import Layout from '../layout';

import DatePicker from "react-datepicker";//インストール要。
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";//フォーマット変換。インストール要。


Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {

  const [startDate, setStartDatetime] = useState(new Date());//本日の日付をデフォルト表示。
  const [endDate, setEndDatetime] = useState(new Date());//本日の日付をデフォルト表示。


  interface Device {
    Device: string;
    Controller: string;
    DeviceType: string;
  }

  useEffect(() => {
    listIot (); // Postの初期表示
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
  
    }


  return (
    <Layout>
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
    </Layout>
  );
}