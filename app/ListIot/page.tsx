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


Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {


  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [posts, setPosts] = useState<Array<Schema["Post"]["type"]>>([]); //Postを追加。
  const [devices, setDevices] = useState<Array<Schema["Post"]["type"]>>([]); //Postを追加。


  const [startDate, setStartDatetime] = useState(new Date());//本日の日付をデフォルト表示。
  const [endDate, setEndDatetime] = useState(new Date());//本日の日付をデフォルト表示。


  interface Device {
    Device: string;
    Controller: string;
    DeviceType: string;
  }

  useEffect(() => {
    listIot (); // Postの初期表示

    /*
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
    */

  }, [startDate, endDate]);//★startDatetimeとendDatetimeが変更されたときにlistIot関数を呼び出す

  //Iotのデータを抽出。
    async function listIot () {

      const startDatetime = `${format(startDate, "yyyy-MM-dd")} 00:00:00+09:00`;
      const endDatetime = `${format(endDate, "yyyy-MM-dd")} 23:59:59+09:00`;

      console.log("StartDatetime=", startDate); // デバッグ用のログ出力
      console.log("EndDatetime=", endDate); // デバッグ用のログ出力

      const { data, errors } = await client.queries.listIot({

        Controller: "Mutsu01",//Controllerで抽出。
        StartDatetime: startDatetime,//範囲で検索
        EndDatetime: endDatetime,//範囲で検索
      });
      console.log('listIot=',data)//★ブラウザの検査画面にて確認表示
  
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

    </main>
  );
}