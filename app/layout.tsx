/*

import { ReactNode } from 'react';
import Sidebar from './Sidebar'; // Sidebar.tsxへのパスを調整してください。

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

*/

import { ReactNode } from 'react';
import Sidebar from './Sidebar'; // Sidebar.tsxへのパスを調整してください。

import { Amplify } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import outputs from "@/amplify_outputs.json";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex' }}>
          <Sidebar />
          <div style={{ flex: 1 }}>
          <Authenticator>
            {children}
          </Authenticator>
          </div>
        </div>
      </body>
    </html>
  );
}
