import CartItem from "@/components/CartItem";
import CustomButton from "@/components/CustomButton";
import { images } from "@/constants";
import { PaymentInfoStripeProps } from "@/type";
import cn from "clsx";
import { useRouter } from "expo-router";
import React, { useContext } from "react";
import { FlatList, Text, View, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../store/store";
import CartContext from "../lib/services/cart_services/CartContext";
import { startCheckout } from "../../store/slices/orderSlice";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";

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
  const dispatch = useDispatch();
  const { items, getTotalItems, getTotalPrice } = useContext(CartContext);
  const { user } = useContext(AppwriteContext);
  const { address, flatHouseNo } = useSelector(
    (state: RootState) => state.location,
  );
  const router = useRouter();
  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();
  const deliveryAddress = [flatHouseNo, address].filter(Boolean).join(", ");

  const handleCheckout = () => {
    if (!address) {
      Alert.alert(
        "Location Required",
        "Please select a delivery location before placing your order.",
        [
          { text: "Select Location", onPress: () => router.push("/select-location" as any) },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    dispatch(startCheckout({
      items,
      total: totalPrice + 5 - 0.5,
      paymentMethod: "Card",
      address: deliveryAddress,
      userId: user?.$id || "guest",
      userName: user?.name || "Guest User"
    }));

    router.push("/checkout" as any);
  };

  return (
    <SafeAreaView className="bg-white h-full">
      <FlatList
        data={items}
        renderItem={({ item }) => <CartItem item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerClassName={cn(
          "pb-28 px-5 pt-5",
          totalItems === 0 && "flex-grow",
        )}
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
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center px-4 pb-16">
            <View className="size-36 rounded-full bg-primary/10 items-center justify-center mb-6">
              <View className="size-24 rounded-full bg-white items-center justify-center shadow-md shadow-black/10">
                <Image
                  source={images.bag}
                  className="size-12"
                  resizeMode="contain"
                  tintColor="#FE8C00"
                />
              </View>
            </View>

            <Image
              source={images.emptyState}
              className="w-64 h-44 mb-2"
              resizeMode="contain"
            />

            <Text className="h2-bold text-dark-100 text-center mt-2">
              Your cart is waiting
            </Text>
            <Text className="paragraph-medium text-gray-200 text-center mt-3 leading-6">
              Add your favorite meals and they will show up here ready for
              checkout.
            </Text>

            <CustomButton
              title="Browse Menu"
              style="bg-primary rounded-full py-4 px-8 mt-8 flex-row justify-center"
              textStyle="text-white-100 paragraph-bold"
              onPress={() =>
                router.push({
                  pathname: "/search",
                  params: { category: "all", query: "" },
                } as any)
              }
            />
          </View>
        )}
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
              <CustomButton title="Order Now" onPress={handleCheckout} />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

export default Cart;
