import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getAutoDim, getDataSaver, setAutoDimStored, setDataSaverStored } from '@/utils/motionSettings';

type MotionCtx = {
  /** When true, motion backgrounds are forced to stills everywhere. */
  dataSaver: boolean;
  setDataSaver: (value: boolean) => void;
  /** When true, the screen gently dims mid-drive after ~30s without a touch. */
  autoDim: boolean;
  setAutoDim: (value: boolean) => void;
};

const Ctx = createContext<MotionCtx>({
  dataSaver: false, setDataSaver: () => {},
  autoDim: true, setAutoDim: () => {},
});

export function MotionProvider({ children }: { children: ReactNode }) {
  const [dataSaver, setDS] = useState(false);
  const [autoDim, setAD] = useState(true);

  useEffect(() => {
    getDataSaver().then(setDS);
    getAutoDim().then(setAD);
  }, []);

  const setDataSaver = (value: boolean) => {
    setDS(value);
    setDataSaverStored(value);
  };

  const setAutoDim = (value: boolean) => {
    setAD(value);
    setAutoDimStored(value);
  };

  return (
    <Ctx.Provider value={{ dataSaver, setDataSaver, autoDim, setAutoDim }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMotion = () => useContext(Ctx);
