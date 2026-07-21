import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getDataSaver, setDataSaverStored } from '@/utils/motionSettings';
import { getMicReactive, setMicReactiveStored } from '@/utils/micSettings';

type MotionCtx = {
  /** When true, motion backgrounds are forced to stills everywhere. */
  dataSaver: boolean;
  setDataSaver: (value: boolean) => void;
  /** When true, visualisers pulse to the sound around the phone (mic). */
  micReactive: boolean;
  setMicReactive: (value: boolean) => void;
};

const Ctx = createContext<MotionCtx>({
  dataSaver: false, setDataSaver: () => {},
  micReactive: true, setMicReactive: () => {},
});

export function MotionProvider({ children }: { children: ReactNode }) {
  const [dataSaver, setDS] = useState(false);
  const [micReactive, setMic] = useState(true);

  useEffect(() => {
    getDataSaver().then(setDS);
    getMicReactive().then(setMic);
  }, []);

  const setDataSaver = (value: boolean) => {
    setDS(value);
    setDataSaverStored(value);
  };

  const setMicReactive = (value: boolean) => {
    setMic(value);
    setMicReactiveStored(value);
  };

  return (
    <Ctx.Provider value={{ dataSaver, setDataSaver, micReactive, setMicReactive }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMotion = () => useContext(Ctx);
