const { data, errors } = await client.mutations.addPost({
    title: "My Post",
    content: "My Content",
    author: "Chris",
  });

  const { data, errors } = await client.queries.getPost({
    id: "456"
  });