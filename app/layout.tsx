/*

'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar'; // パスは必要に応じて調整
import { ControllerProvider } from './context/ControllerContext';

import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import outputs from "@/amplify_outputs.json";
import { Amplify } from "aws-amplify";

// Amplify 初期化
Amplify.configure(outputs);

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <html lang="ja">
      <body>
        <Authenticator>
          <ControllerProvider>
            <div style={{ display: 'flex' }}>
              <Sidebar />
              <div style={{ flex: 1 }}>
                {children}
              </div>
            </div>
          </ControllerProvider>
        </Authenticator>
      </body>
    </html>
  );
}


*/


'use client';

import { ReactNode } from 'react';
import Sidebar from './Sidebar'; // パスは必要に応じて調整
import { ControllerProvider, useController } from './context/ControllerContext';

import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import outputs from "@/amplify_outputs.json";
import { Amplify } from "aws-amplify";

// Amplify 初期化
Amplify.configure(outputs);

interface LayoutProps {
  children: ReactNode;
}

// 拠点名表示用の内部コンポーネント
function ControllerHeader() {
  const { controller } = useController();
  return (
    <div style={{ padding: '10px', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
      現在の拠点: {controller}
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  return (
    <html lang="ja">
      <body>
        <Authenticator>
          <ControllerProvider>
            <div style={{ display: 'flex' }}>
              <Sidebar />
              <div style={{ flex: 1 }}>
                <ControllerHeader />
                {children}
              </div>
            </div>
          </ControllerProvider>
        </Authenticator>
      </body>
    </html>
  );
}

