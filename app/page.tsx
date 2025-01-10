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

  //Postを追加。
  //function listPosts() {
    //client.models.Post.observeQuery().subscribe({
      //next: (data) => setPosts([...data.items]),
      //next: (data: { items: Array<Schema["Post"]["type"]> }) => setPosts([...data.items]),//生成AIの指示により修正
    //});
  //}

  useEffect(() => {
    listTodos();
    //listPosts();//Postを追加。
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
    console.log(data)
  }

  async function getPost() {
    //const postId = window.prompt("Enter post ID");
    const {data} = await client.queries.getPost({
      id: "a12b2004-a0ac-4dbe-9d90-00942a285a09",
    });
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

      <h1>My posts</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.content}</li>
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
