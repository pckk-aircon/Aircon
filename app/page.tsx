"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import "./../app/app.css";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";


Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {


  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [posts, setPosts] = useState<Array<Schema["Post"]["type"]>>([]); //Postを追加。
  const [devices, setDevices] = useState<Array<Schema["Post"]["type"]>>([]); //Postを追加。
  //const [Iotdatas, setIots] = useState<Array<Schema["IotData"]["type"]>>([]); //Postを追加。

  interface Device {
    Device: string;
    Controller: string;
    DeviceType: string;
  }


  function listTodos() {
    client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
  }

  useEffect(() => {
    listTodos();
    getPost(); // Postの初期表示
    listIot (); // Postの初期表示
    listIotDataByController (); // Postの初期表示

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

  }, []);

  function createTodo() {
    client.models.Todo.create({
      content: window.prompt("Todo content"),
    });
  }

  //step5にて追加。
  async function addPost () {
    const {data} = await client.mutations.addPost({
      Controller: window.prompt("Controller"),

    },{authMode: "apiKey"});
    //console.log(data)
  }

  //getPostを追記
  async function getPost () {

    const { data, errors } = await client.queries.getPost({
      Device: "AC233FA3DA16" ,//任意のDeviceをキーに1件抽出。
    });
    console.log('get=',data)

    //画面への転送を追記
    if (data) {
      setPosts(prevPosts => [...prevPosts, data]);
    }
  }

  //Iotのデータを抽出。
    async function listIot () {

      const { data, errors } = await client.queries.listIot({
        Controller: "Mutsu01",//Controllerが"Mutsu01"であるデータを抽出。
        //DeviceDatetime: "2024-06-30 23:28:28+09:00",
        startDatetime: "2024-06-30 00:00:00+09:00",//★範囲検索
        endDatetime: "2024-06-30 23:59:59+09:00",//★範囲検索
      });
      console.log('listIot=',data)
  
    }

  //listIotByControllerを追記。
  async function listIotDataByController () {



    console.log('page called'); // 関数が呼び出されたことを確認
    try {  
      const { data, errors } = await client.queries.listIotDataByController({
        Controller: "Mutsu01",//Controllerが"Mutsu01"であるデータを抽出。
        DeviceDatetime: "2024-06-30 23:28:28+09:00",
      });
    
      if (errors) {
        console.error('Query エラー', errors); // エラーがある場合にログ出力
      } else if (data) {
        console.log('Query 結果', data); // クエリ結果をログ出力
      } else {
        console.log('データ無し'); // データが返されなかった場合
      }

    } catch (error) {
      console.error('予期しないエラー', error); // 予期しないエラーをログ出力
    }
  }

  return (
    <main>
      <h1>My todos</h1>
      <button onClick={createTodo}>+ new</button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.content}</li>
        ))}
      </ul>

      <h1>My posts</h1>
      <button onClick={addPost}>+ new post</button>
      <ul>
        {posts.map((post) => (
          <li key={post.Device}>{post.Controller}</li>
        ))}
      </ul>

      <h1>My lists</h1>
      <button onClick={addPost}>+ new post</button>
      <ul>
        {devices.map((device) => (
          <li key={device.Device}>{device.Controller}</li>
        ))}
      </ul>



      <div>
        🥳 App successfully hosted. Try creating a new todo.
        <br />
        <a href="https://docs.amplify.aws/nextjs/start/quickstart/nextjs-app-router-client-components/">
          Review next steps of this tutorial.
        </a>
      </div>
    </main>
  );
}