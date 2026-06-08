import { Models } from "react-native-appwrite";

export interface MenuItem extends Models.Document {
  name: string;
  hotelName?: string;
  userId?: string;
  price: number;
  image_url: string;
  description: string;
  calories: number;
  protein: number;
  rating: number;
  type: string;
}

export interface Category extends Models.Document {
  name: string;
  description: string;
}

export interface User extends Models.Document {
  name: string;
  email: string;
  avatar: string;
  role?: "customer" | "admin" | "hotel" | "delivery" | "rider" | "manager" | string;
  phoneNumber?: string;
  address?: string;
  addressLabel?: string;
  latitude?: string | number;
  longitude?: string | number;
  openTime?: string;
  closeTime?: string;
}

export interface CartCustomization {
  id: string;
  name: string;
  price: number;
  type: string;
}

export interface CartItemType {
  id: string; // menu item id
  name: string;
  price: number;
  image_url: string;
  quantity: number;
  customizations?: CartCustomization[];
  pickupBranchId?: string;
  pickupBranchName?: string;
  pickupBranchAddress?: string;
  pickupBranchLat?: string;
  pickupBranchLng?: string;
  pickupBranchLong?: string;
}

export interface CartStore {
  items: CartItemType[];
  addItem: (item: Omit<CartItemType, "quantity">) => void;
  removeItem: (id: string, customizations: CartCustomization[]) => void;
  increaseQty: (id: string, customizations: CartCustomization[]) => void;
  decreaseQty: (id: string, customizations: CartCustomization[]) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

interface TabBarIconProps {
  focused: boolean;
  icon: ImageSourcePropType;
  title: string;
}

interface PaymentInfoStripeProps {
  label: string;
  value: string;
  labelStyle?: string;
  valueStyle?: string;
}

interface CustomButtonProps {
  onPress?: () => void;
  title?: string;
  style?: string;
  leftIcon?: React.ReactNode;
  textStyle?: string;
  isLoading?: boolean;
}

interface CustomHeaderProps {
  title?: string;
}

interface CustomInputProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  label: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  returnKeyType?: "done" | "go" | "next" | "search" | "send";
  maxLength?: number;
}

interface ProfileFieldProps {
  label: string;
  value: string;
  icon: ImageSourcePropType;
}

interface CreateUserPrams {
  email: string;
  password: string;
  name: string;
  role?: string;
}

interface SignInParams {
  email: string;
  password: string;
}

interface GetMenuParams {
  category?: string;
  query?: string;
  limit?: number;
}

import "react-native";
declare module "react-native" {
  interface ViewProps { className?: string; }
  interface TextProps { className?: string; }
  interface ScrollViewProps { className?: string; }
  interface ImageProps { className?: string; }
  interface ImageBackgroundProps { className?: string; }
  interface TouchableOpacityProps { className?: string; }
  interface TextInputProps { className?: string; }
}
