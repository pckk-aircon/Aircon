// app/context/ControllerContext.tsx
'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

type ControllerContextType = {
  controller: string;
  setController: (value: string) => void;
};

const ControllerContext = createContext<ControllerContextType | undefined>(undefined);

export const ControllerProvider = ({ children }: { children: ReactNode }) => {
  const [controller, setController] = useState('tokyo'); // 初期値は東京など

  return (
    <ControllerContext.Provider value={{ controller, setController }}>
      {children}
    </ControllerContext.Provider>
  );
};

export const useController = () => {
  const context = useContext(ControllerContext);
  if (!context) {
    throw new Error('useController must be used within a ControllerProvider');
  }
  return context;
};


