import CartItem from "@/components/CartItem";
import CustomButton from "@/components/CustomButton";
import { PaymentInfoStripeProps } from "@/type";
import cn from "clsx";
import { useRouter } from "expo-router";
import React, { useContext } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { RootState } from "../../store/store";
import CartContext from "../lib/services/cart_services/CartContext";

const PaymentInfoStripe = ({
  label,
  value,
  labelStyle,
  valueStyle,
}: PaymentInfoStripeProps) => (
  <View className="flex-between flex-row my-1">
    <Text className={cn("paragraph-medium text-gray-200", labelStyle)}>
      {label}
    </Text>
    <Text className={cn("paragraph-bold text-dark-100", valueStyle)}>
      {value}
    </Text>
  </View>
);
const Cart = () => {
  const { items, getTotalItems, getTotalPrice } = useContext(CartContext);
  const { address, flatHouseNo } = useSelector(
    (state: RootState) => state.location,
  );
  const router = useRouter();
  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();
  const deliveryAddress = [flatHouseNo, address].filter(Boolean).join(", ");
  return (
    <SafeAreaView className="bg-white h-full">
      <FlatList
        data={items}
        renderItem={({ item }) => <CartItem item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerClassName="pb-28 px-5 pt-5"
        ListHeaderComponent={() =>
          totalItems > 0 && (
            <View className="flex-between flex-row w-full pt-5 pb-10">
              <View className="flex-start flex-1 mr-2">
                <Text className="small-bold uppercase text-primary">
                  Delivery Location
                </Text>
                <Text className="base-bold text-dark-100" numberOfLines={1}>
                  {deliveryAddress || "Select Location"}
                </Text>
              </View>
              <CustomButton
                title="Change Location"
                style="location-btn"
                textStyle="location-btn-text"
                onPress={() => router.push("/select-location" as any)}
              />
            </View>
          )
        }
        ListEmptyComponent={() => <Text>Your cart is empty</Text>}
        ListFooterComponent={() =>
          totalItems > 0 && (
            <View className="gap-5">
              <View className="mt-6 border border-gray-300 p-5 rounded-2xl">
                <Text className="h3-bold text-dark-100 mb-5">
                  Payment Summary
                </Text>
                <PaymentInfoStripe
                  label={`Total Items (${totalItems})`}
                  value={`$${totalPrice.toFixed(2)}`}
                />
                <PaymentInfoStripe label={`Delivery Fee`} value={`$5.00`} />
                <PaymentInfoStripe
                  label={`Discount`}
                  value={`- $0.50`}
                  valueStyle="!text-success"
                />
                <View className="border-t border-gray-300 my-2" />
                <PaymentInfoStripe
                  label={`Total`}
                  value={`$${(totalPrice + 5 - 0.5).toFixed(2)}`}
                  labelStyle="base-bold !text-dark-100"
                  valueStyle="base-bold !text-dark-100 !text-right"
                />
              </View>
              <CustomButton title="Order Now" />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

export default Cart;
