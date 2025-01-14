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


  //チュートリアル「クライアント側でカスタムサブスクリプションを購読する」にしたがって追加。
  const client = generateClient<Schema>()
  const sub = client.subscriptions.receivePost()
    .subscribe({
      next: event => {
        const eventDataArray = [
          event.id,
          event.title,
          event.content,
          event.author,
        ];
        //console.log(eventDataArray);
        console.log(event)
      }
    }
  )

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

  //step5にて追加。
  async function addPost () {
    const {data} = await client.mutations.addPost({
      title: window.prompt("Title"),
      content: "My Content",
      author: "Chris",
    },{authMode: "apiKey"});
    //console.log(data)
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
        {posts.map((event) => (
          <li key={event.id}>{event.content}</li>
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
