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
  status?: string;
  $id?: string;
  deliveryBoyId?: string;
  deliveryBoyName?: string;
  deliveryBoyPhone?: string;
  pickupBranchId?: string;
  pickupBranchName?: string;
  pickupBranchAddress?: string;
  pickupBranchLat?: string;
  pickupBranchLng?: string;
  pickupBranchLong?: string;
  userLat?: string;
  userLong?: string;
  rating?: number;
  comment?: string;
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
    updateCurrentOrderDbId: (state, action: PayloadAction<string>) => {
      if (state.currentOrder) {
        state.currentOrder.$id = action.payload;
      }
    },
    loadOrderForTracking: (state, action: PayloadAction<Order>) => {
      state.currentOrder = action.payload;
      state.trackingStatus = action.payload.status === "delivered"
        ? "delivered"
        : action.payload.status === "picked_up"
        ? "delivering"
        : "preparing";
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
  updateCurrentOrderDbId,
  loadOrderForTracking,
  addOrderToHistory,
  setOrderHistory,
  resetPayment
} = orderSlice.actions;
export default orderSlice.reducer;
