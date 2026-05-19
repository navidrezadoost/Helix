import React from 'react';
import type { ReactiveStore } from '@helix/core';

interface HelixContextValue {
  store: ReactiveStore | null;
}

const HelixContext = React.createContext<HelixContextValue>({ store: null });

interface HelixProviderProps {
  store: ReactiveStore | null;
  children?: React.ReactNode;
}

export const HelixProvider = ({ store, children }: HelixProviderProps) => {
  return <HelixContext.Provider value={{ store }}>{children}</HelixContext.Provider>;
};

export function useHelixContext(): HelixContextValue {
  return React.useContext(HelixContext);
}