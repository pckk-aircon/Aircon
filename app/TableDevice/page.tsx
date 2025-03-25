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

  const [posts, setPosts] = useState<Array<Schema["Post"]["type"]>>([]); //Postを追加。

  useEffect(() => {
    getPost(); // Postの初期表示

    //サブスクリプションの設定をuseEffect()の中に移動。
    const sub = client.subscriptions.receivePost()
    .subscribe({
      next: event => {
        console.log(event)
        setPosts(prevPosts => [...prevPosts, event]);
      },
    });

    return () => sub.unsubscribe(); // クリーンアップ関数を返してサブスクリプションを解除
  }, [posts]); // 依存配列に posts を追加

  //step5にて追加。
  async function addPost () {
    const {data} = await client.mutations.addPost({
      Controller: window.prompt("Controller"),

    },{authMode: "apiKey"});
    console.log('add=',data)
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

  return (
    <main>

      <h1>My posts</h1>
      <button onClick={addPost}>+ new post</button>
      <ul>
        {posts.map((post) => (
          <li key={post.Device}>{post.Controller}</li>
        ))}
      </ul>

    </main>
  );
}