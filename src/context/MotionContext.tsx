import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getDataSaver, setDataSaverStored } from '@/utils/motionSettings';

type MotionCtx = {
  /** When true, motion backgrounds are forced to stills everywhere. */
  dataSaver: boolean;
  setDataSaver: (value: boolean) => void;
};

const Ctx = createContext<MotionCtx>({
  dataSaver: false, setDataSaver: () => {},
});

export function MotionProvider({ children }: { children: ReactNode }) {
  const [dataSaver, setDS] = useState(false);

  useEffect(() => {
    getDataSaver().then(setDS);
  }, []);

  const setDataSaver = (value: boolean) => {
    setDS(value);
    setDataSaverStored(value);
  };

  return (
    <Ctx.Provider value={{ dataSaver, setDataSaver }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMotion = () => useContext(Ctx);
