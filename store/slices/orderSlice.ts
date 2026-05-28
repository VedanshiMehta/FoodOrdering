import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CartItemType } from '../../type';

export interface Order {
  id: string;
  items: CartItemType[];
  total: number;
  paymentMethod: string;
  address: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}

export interface OrderState {
  currentOrder: Order | null;
  paymentStatus: 'idle' | 'processing' | 'success' | 'failed';
  trackingStatus: 'idle' | 'preparing' | 'delivering' | 'delivered';
  orderHistory: Order[];
}

const initialState: OrderState = {
  currentOrder: null,
  paymentStatus: 'idle',
  trackingStatus: 'idle',
  orderHistory: [],
};

export const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    startCheckout: (state, action: PayloadAction<Omit<Order, 'timestamp' | 'id'>>) => {
      state.currentOrder = {
        ...action.payload,
        id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        timestamp: new Date().toISOString(),
      };
      state.paymentStatus = 'idle';
      state.trackingStatus = 'idle';
    },
    processPayment: (state) => {
      state.paymentStatus = 'processing';
    },
    paymentSuccess: (state) => {
      state.paymentStatus = 'success';
      state.trackingStatus = 'preparing'; // Start tracking immediately upon payment success
    },
    paymentFailed: (state) => {
      state.paymentStatus = 'failed';
    },
    setTrackingStatus: (state, action: PayloadAction<OrderState['trackingStatus']>) => {
      state.trackingStatus = action.payload;
    },
    addOrderToHistory: (state, action: PayloadAction<Order>) => {
      // Avoid duplicates
      const exists = state.orderHistory.some(o => o.id === action.payload.id);
      if (!exists) {
        state.orderHistory.unshift(action.payload);
      }
    },
    setOrderHistory: (state, action: PayloadAction<Order[]>) => {
      state.orderHistory = action.payload;
    },
    resetPayment: (state) => {
      state.paymentStatus = 'idle';
      state.trackingStatus = 'idle';
    },
  },
});

export const {
  startCheckout,
  processPayment,
  paymentSuccess,
  paymentFailed,
  setTrackingStatus,
  addOrderToHistory,
  setOrderHistory,
  resetPayment
} = orderSlice.actions;
export default orderSlice.reducer;
