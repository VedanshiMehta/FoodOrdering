import CartContext from "@/app/lib/services/cart_services/CartContext";
import { images } from "@/constants";
import { router } from "expo-router";
import React, { useContext } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

const CartButton = () => {
  const { getTotalItems } = useContext(CartContext);
  const totalItems = getTotalItems(); // Example total items in the cart
  return (
    <TouchableOpacity className="cart-btn" onPress={() => router.push("/(tabs)/cart")}>
      <Image source={images.bag} className="size-5" resizeMode="contain" />
      {totalItems > 0 && (
        <View className="cart-badge">
          <Text className="small-bold text-white">{totalItems}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default CartButton;
