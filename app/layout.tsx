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

'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar'; // Sidebar.tsxへのパスを調整してください。

//import { Inter } from "next/font/google";
//import "./app.css";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import outputs from "@/amplify_outputs.json";
import { Amplify } from "aws-amplify";

// ここで Amplify を初期化
Amplify.configure(outputs);

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <html lang="ja">
      <body>
        <div style={{ display: 'flex' }}>
          <Sidebar />
          <div style={{ flex: 1 }}>

              {children}

          </div>
        </div>
      </body>
    </html>
  );
}
