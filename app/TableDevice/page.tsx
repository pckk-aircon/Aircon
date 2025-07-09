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

import { useController } from "@/app/context/ControllerContext"; // ← 追加

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {

  const { controller } = useController(); // ← Sidebarで選択されたcontrollerを取得
  const [posts, setPosts] = useState<Array<{ Device: string; DeviceName: string; DeviceType: string; Controller?: string | null; Division: string }>>([]);

  useEffect(() => {

    listPost(); // Postの初期表示

    const sub = client.subscriptions.receiveDevice().subscribe({
      next: (event) => {
        console.log("event=", event);
        setPosts((prevPosts) => {
          // 重複を避けるために投稿が既に存在するか確認。これがないとreceiveが機能しない。
          if (!prevPosts.some((post) => post.Device === event.Device)) {
            return [...prevPosts, event as { Device: string; DeviceName: string; DeviceType: string; Controller?: string | null ; Division: string}];
          }
          return prevPosts;
        });
      },
    });

    return () => sub.unsubscribe(); // クリーンアップ関数を返してサブスクリプションを解除
  }, []); // 空の依存配列で一度だけ実行

  async function listPost() {
    const { data, errors } = await client.queries.listDevice({
      Controller: controller,
    });
    console.log('listDevice=', data);
    if (data) {
      setPosts(data as Array<{ Device: string; DeviceName: string; DeviceType: string; Controller?: string | null ; Division: string}>); // 型を明示的にキャストする
    }
  }

  async function addPost() {
    const { data } = await client.mutations.addDevice(
      {
        DeviceName: window.prompt("DeviceName"),
        DeviceType: window.prompt("DeviceType"),
        Controller: window.prompt("Controller"),
        Division: window.prompt("Division"),        
      },
      { authMode: "apiKey" }
    );
    console.log("add=", data);
  }

  return (
    <main>
      <h1>Device</h1>
      <button onClick={addPost}>+ new post</button>
      <ul>
        {posts.map((post) => (
          <li key={post.Controller}>
            {post.Device}{post.DeviceName}{post.DeviceType}{post.Controller}{post.Division}
          </li>
        ))}
      </ul>
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

import { useController } from "@/app/context/ControllerContext"; // ← 追加

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {
  const { controller } = useController(); // ← Sidebarで選択されたcontrollerを取得
  const [posts, setPosts] = useState<
    Array<{
      Device: string;
      DeviceName: string;
      DeviceType: string;
      Controller?: string | null;
      Division: string;
    }>
  >([]);

  // controllerが変更されたときにlistPostを実行
  useEffect(() => {
    if (controller) {
      listPost();
    }
  }, [controller]);

  // サブスクリプションは初回のみ設定
  useEffect(() => {
    const sub = client.subscriptions.receiveDevice().subscribe({
      next: (event) => {
        console.log("event=", event);
        setPosts((prevPosts) => {
          if (!prevPosts.some((post) => post.Device === event.Device)) {
            return [
              ...prevPosts,
              event as {
                Device: string;
                DeviceName: string;
                DeviceType: string;
                Controller?: string | null;
                Division: string;
              },
            ];
          }
          return prevPosts;
        });
      },
    });

    return () => sub.unsubscribe(); // クリーンアップ
  }, []);

  async function listPost() {
    if (!controller) return;
    const { data, errors } = await client.queries.listDevice({
      Controller: controller,
    });
    console.log("listDevice=", data);
    if (data) {
      setPosts(
        data as Array<{
          Device: string;
          DeviceName: string;
          DeviceType: string;
          Controller?: string | null;
          Division: string;
        }>
      );
    }
  }

  async function addPost() {
    const { data } = await client.mutations.addDevice(
      {
        DeviceName: window.prompt("DeviceName"),
        DeviceType: window.prompt("DeviceType"),
        Controller: window.prompt("Controller"),
        Division: window.prompt("Division"),
      },
      { authMode: "apiKey" }
    );
    console.log("add=", data);
  }

  return (
    <main>
      <h1>Device</h1>
      <button onClick={addPost}>+ new post</button>
      <ul>
        {posts.map((post) => (
          <li key={post.Device}>
            {post.Device} {post.DeviceName} {post.DeviceType}{" "}
            {post.Controller} {post.Division}
          </li>
        ))}
      </ul>
    </main>
  );
}
