import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getAtmosphere, getAutoDim, getDataSaver, getSoftAtmosphere, setAtmosphereStored, setAutoDimStored, setDataSaverStored, setSoftAtmosphereStored } from '@/utils/motionSettings';

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
  /** Haze at about half strength. Default ON. Ignored when atmosphere is off. */
  softAtmosphere: boolean;
  setSoftAtmosphere: (value: boolean) => void;
};

const Ctx = createContext<MotionCtx>({
  dataSaver: false, setDataSaver: () => {},
  autoDim: true, setAutoDim: () => {},
  atmosphere: true, setAtmosphere: () => {},
  softAtmosphere: true, setSoftAtmosphere: () => {},
});

export function MotionProvider({ children }: { children: ReactNode }) {
  const [dataSaver, setDS] = useState(false);
  const [autoDim, setAD] = useState(true);
  const [atmosphere, setAT] = useState(true);
  const [softAtmosphere, setSA] = useState(true);

  useEffect(() => {
    getDataSaver().then(setDS);
    getAutoDim().then(setAD);
    getAtmosphere().then(setAT);
    getSoftAtmosphere().then(setSA);
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

  const setSoftAtmosphere = (value: boolean) => {
    setSA(value);
    setSoftAtmosphereStored(value);
  };

  return (
    <Ctx.Provider value={{ dataSaver, setDataSaver, autoDim, setAutoDim, atmosphere, setAtmosphere, softAtmosphere, setSoftAtmosphere }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMotion = () => useContext(Ctx);
