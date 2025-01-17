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


  function listTodos() {
    client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
  }

  useEffect(() => {
    listTodos();
    getPost(); // Postの初期表示

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
      title: window.prompt("Title"),
      content: "My Content",
      author: "Chris",
    },{authMode: "apiKey"});
    //console.log(data)
  }

  //getPostを追記
  async function getPost () {
    const { data, errors } = await client.queries.getPost({
      id: "ebd64f9d-e097-4f4c-b343-95d83f1d690b"
    });
    console.log('get=',data)

    //画面への転送を追記
    if (data) {
      setPosts(prevPosts => [...prevPosts, data]);
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
          <li key={post.id}>{post.title}</li>
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
