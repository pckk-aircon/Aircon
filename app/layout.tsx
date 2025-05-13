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

