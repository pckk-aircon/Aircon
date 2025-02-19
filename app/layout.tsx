import { ReactNode } from 'react';
import Sidebar from './Sidebar'; // Sidebar.tsxへのパスを調整してください。

import { Authenticator } from "@aws-amplify/ui-react"; //login認証
import "@aws-amplify/ui-react/styles.css"; //login認証
import { useForm, FormProvider, useFormContext } from 'react-hook-form'; //login認証

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
            <Authenticator>
              {children}
            </Authenticator>
          </div>
        </div>
      </body>
    </html>
  );
}