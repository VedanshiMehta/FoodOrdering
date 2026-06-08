import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  flatHouseNo: string | null;
  countryCode: string | null;
}

const initialState: LocationState = {
  latitude: null,
  longitude: null,
  address: null,
  flatHouseNo: null,
  countryCode: null,
};

export const locationSlice = createSlice({
  name: "location",
  initialState,
  reducers: {
    setLocation: (state, action: PayloadAction<LocationState>) => {
      state.latitude = action.payload.latitude;
      state.longitude = action.payload.longitude;
      state.address = action.payload.address;
      state.flatHouseNo = action.payload.flatHouseNo;
      state.countryCode = action.payload.countryCode;
    },
    clearLocation: (state) => {
      state.latitude = null;
      state.longitude = null;
      state.address = null;
      state.flatHouseNo = null;
      state.countryCode = null;
    },
  },
});

export const { setLocation, clearLocation } = locationSlice.actions;

export default locationSlice.reducer;
