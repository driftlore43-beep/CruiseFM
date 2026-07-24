import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getAtmosphere, getAutoDim, getDataSaver, setAtmosphereStored, setAutoDimStored, setDataSaverStored } from '@/utils/motionSettings';

type MotionCtx = {
  /** When true, motion backgrounds are forced to stills everywhere. */
  dataSaver: boolean;
  setDataSaver: (value: boolean) => void;
  /** When true, the screen gently dims mid-drive after ~30s without a touch. */
  autoDim: boolean;
  setAutoDim: (value: boolean) => void;
  /** The smoke-machine haze behind every mode. Default ON. */
  atmosphere: boolean;
  setAtmosphere: (value: boolean) => void;
};

const Ctx = createContext<MotionCtx>({
  dataSaver: false, setDataSaver: () => {},
  autoDim: true, setAutoDim: () => {},
  atmosphere: true, setAtmosphere: () => {},
});

export function MotionProvider({ children }: { children: ReactNode }) {
  const [dataSaver, setDS] = useState(false);
  const [autoDim, setAD] = useState(true);
  const [atmosphere, setAT] = useState(true);

  useEffect(() => {
    getDataSaver().then(setDS);
    getAutoDim().then(setAD);
    getAtmosphere().then(setAT);
  }, []);

  const setDataSaver = (value: boolean) => {
    setDS(value);
    setDataSaverStored(value);
  };

  const setAutoDim = (value: boolean) => {
    setAD(value);
    setAutoDimStored(value);
  };

  const setAtmosphere = (value: boolean) => {
    setAT(value);
    setAtmosphereStored(value);
  };

  return (
    <Ctx.Provider value={{ dataSaver, setDataSaver, autoDim, setAutoDim, atmosphere, setAtmosphere }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMotion = () => useContext(Ctx);
