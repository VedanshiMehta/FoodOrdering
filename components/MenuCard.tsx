import CartContext from "@/app/lib/services/cart_services/CartContext";
import { MenuItem } from "@/type";
import React, { useContext, useEffect, useState } from "react";
import AppwriteContext from "@/app/lib/services/auth_services/AppwirteContext";
import { Image, Platform, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { formatPrice } from "@/app/lib/currency";

const MenuCard = ({
  item: { $id, image_url, name, price, hotelName, userId },
}: {
  item: MenuItem;
}) => {
  const router = useRouter();
  const { appwrite } = useContext(AppwriteContext);
  const [managerName, setManagerName] = useState<string | null>(null);

  useEffect(() => {
    if (userId && !hotelName) {
      appwrite.getHotelDetails(userId).then(u => {
        if (u && u.name) setManagerName(u.name);
      }).catch(() => {});
    }
  }, [userId, hotelName]);

  let parsedHotelName = hotelName || managerName;
  if (!parsedHotelName && (name.toLowerCase().startsWith("domino's") || name.toLowerCase().startsWith("domino’s"))) {
    parsedHotelName = "Domino's";
  }
  
  let parsedFoodName = name;
  if (parsedHotelName) {
    if (parsedHotelName.toLowerCase() === "domino's" || parsedHotelName.toLowerCase() === "domino’s") {
      parsedFoodName = name.replace(/^domino['’]s\s*/i, '');
    } else {
      parsedFoodName = name.replace(new RegExp(`^${parsedHotelName}\\s*`, 'i'), '');
    }
  }

  const { addItem } = useContext(CartContext);
  const countryCode = useSelector((state: RootState) => state.location.countryCode);
  return (
    <TouchableOpacity
      className="menu-card"
      style={
        Platform.OS === "android"
          ? { elevation: 10, shadowColor: "#878787" }
          : {}
      }
      onPress={() => router.push(`/(details)/${$id}` as any)}
    >
      <View className="size-32 absolute -top-10 self-center rounded-full overflow-hidden">
        <Image
          source={{ uri: image_url }}
          className="w-full h-full"
          resizeMode="contain"
        />
      </View>
      {parsedHotelName ? (
        <Text
          className="text-center text-[11px] text-primary uppercase tracking-widest mb-1 mt-2"
          style={{ fontFamily: "Quicksand-Bold" }}
          numberOfLines={1}
        >
          {parsedHotelName}
        </Text>
      ) : (
        <View className="mt-2" />
      )}
      <Text
        className="text-center base-bold text-dark-100 mb-2"
        numberOfLines={1}
      >
        {parsedFoodName}
      </Text>
      <Text className="body-regular text-gray-200 mb-4">From {formatPrice(price, countryCode)}</Text>
      <TouchableOpacity
        onPress={() => {
          addItem({
            id: $id,
            name,
            price,
            image_url: image_url,
            customizations: [],
          });
        }}
      >
        <Text className="paragraph-bold text-primary">Add to Cart +</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default MenuCard;
