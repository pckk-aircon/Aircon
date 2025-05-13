/*

import { ReactNode } from 'react';
import Sidebar from './Sidebar';

import { Amplify } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import outputs from "@/amplify_outputs.json";

Amplify.configure(outputs);

interface LayoutProps {
  children: ReactNode;
}


export default function Layout({ children }: LayoutProps) {
  return (

      <main style={{ display: 'flex' }}>
        <Sidebar />
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </main>

  );
}

*/

import { ReactNode } from 'react';
import Sidebar from './Sidebar';

import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import outputs from '@/amplify_outputs.json';

Amplify.configure(outputs);

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <div style={{ display: 'flex' }}>
          <Sidebar />
          <main style={{ flex: 1, padding: '1rem' }}>
            <header style={{ marginBottom: '1rem' }}>
              <h2>Hello, {user?.username}</h2>
              <button onClick={signOut}>Sign out</button>
            </header>
            {children}
          </main>
        </div>
      )}
    </Authenticator>
  );
}

