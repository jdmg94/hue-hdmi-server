import { ServerStatus } from "../utils/status";
import { createSlice } from "@reduxjs/toolkit";
import Hue, { BridgeClientCredentials } from "hue-sync";

export type RootState = {
  bridge?: Hue;
  status: ServerStatus;
  selectedArea?: string;
  credentials?: BridgeClientCredentials;
};

const initialState: RootState = {
  bridge: undefined,
  credentials: undefined,
  selectedArea: undefined,
  status: ServerStatus.NOT_READY,
};

const hueServerSlice = createSlice({
  name: "hueServer",
  initialState,
  reducers: {
    setBridge: (state, action) => {
      state.bridge = action.payload;
    },
    setCredentials: (state, action) => {
      state.credentials = action.payload;
    },
    setServerStatus: (state, action) => {
      state.status = action.payload;
    },
    setEntertainmentArea: (state, action) => {
      state.selectedArea = action.payload;
    },
  },
});

export const {
  setBridge,
  setCredentials,
  setServerStatus,
  setEntertainmentArea,
} = hueServerSlice.actions;

export default hueServerSlice.reducer;
