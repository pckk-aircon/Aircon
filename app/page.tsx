
/*
import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>Welcome to the test site</h1>
    </main>
  );
}
*/

import type { Schema } from "@/amplify/data/resource";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

export default function HomePage() {

  const { signOut } = useAuthenticator();

  // ...

  return (
    <main>
      {/* ... */}
      <button onClick={signOut}>Sign out</button>
    </main>
  );
}

