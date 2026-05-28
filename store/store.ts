import { configureStore } from '@reduxjs/toolkit';
import locationReducer from './slices/locationSlice';
import orderReducer from './slices/orderSlice';

export const store = configureStore({
  reducer: {
    location: locationReducer,
    order: orderReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
