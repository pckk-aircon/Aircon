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

  function listTodos() {
    client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
  }

  useEffect(() => {
    listTodos();
  }, []);

  function createTodo() {
    client.models.Todo.create({
      content: window.prompt("Todo content"),
    });
  }

  //以下は追加部分。
  async function addPost() {
    const title = window.prompt("Title");
    const content = "My Content";
    const author = "Chris";

    const { data } = await client.mutations.addPost({
      title,
      content,
      author,
    }, { authMode: "apiKey" });

    console.log(data);
    // 必要に応じて、todosの状態を更新する処理を追加できます
  }

  return (
    <main>
      <h1>My todos</h1>
      <button onClick={createTodo}>+ new</button>
      <button onClick={addPost}>+ new post</button>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.content}</li>
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
