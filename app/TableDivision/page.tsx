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

Amplify.configure(outputs);

const client = generateClient<Schema>();

export default function App() {

  const [posts, setPosts] = useState<Array<{ Division: string; Controller?: string | null }>>([]);

  useEffect(() => {

    listPost(); // Postの初期表示

    const sub = client.subscriptions.receiveDivision().subscribe({
      next: (event) => {
        console.log("event=", event);
        setPosts((prevPosts) => {
          return prevPosts;
        });
      },
    });

    return () => sub.unsubscribe(); // クリーンアップ関数を返してサブスクリプションを解除
  }, []); // 空の依存配列で一度だけ実行

  async function listPost() {
    const { data, errors } = await client.queries.listDivision({
      Controller: "Mutsu01",
    });
    console.log('listDivision=', data);
    if (data) {
      setPosts(data as Array<{ Division: string; Controller?: string | null }>); // 型を明示的にキャストする
    }
  }

  async function addPost() {
    const { data } = await client.mutations.addDivision(
      {
        Controller: window.prompt("Controller"),
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
            {post.Division} {post.Controller}
          </li>
        ))}
      </ul>
    </main>
  );
}

*/