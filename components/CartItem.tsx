import CartContext from "@/app/lib/services/cart_services/CartContext";
import { images } from "@/constants";
import { CartItemType } from "@/type";
import { useContext } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { formatPrice } from "@/app/lib/currency";

const CartItem = ({ item }: { item: CartItemType }) => {
  const { increaseQty, decreaseQty, removeItem } = useContext(CartContext);
  const countryCode = useSelector((state: RootState) => state.location.countryCode);

  const customizationPrice = item.customizations?.reduce((sum, c) => sum + c.price, 0) ?? 0;
  const singleItemTotal = item.price + customizationPrice;

  const customizationsList = item.customizations
    ?.filter((c) => c.price > 0 || c.type === "Bun Type")
    .map((c) => c.name)
    .join(", ");

  return (
    <View className="cart-item items-end px-4 py-3">
      <View className="flex flex-row items-center gap-x-3 flex-1 mr-4">
        <View className="cart-item__image">
          <Image
            source={{ uri: item.image_url }}
            className="size-4/5 rounded-lg"
            resizeMode="cover"
          />
        </View>

        <View className="flex-1 justify-center">
          <Text className="base-bold text-dark-100" numberOfLines={1}>{item.name}</Text>
          {customizationsList ? (
            <Text className="text-[10px] text-gray-400 mt-0.5 leading-tight" numberOfLines={1}>
              {customizationsList}
            </Text>
          ) : null}
          <Text className="paragraph-bold text-primary mt-1">
            {formatPrice(singleItemTotal, countryCode)}
          </Text>

          <View className="flex flex-row items-center gap-x-4 mt-2">
            <TouchableOpacity
              onPress={() => decreaseQty(item.id, item.customizations!)}
              className="cart-item__actions"
            >
              <Image
                source={images.minus}
                className="size-1/2"
                resizeMode="contain"
                tintColor={"#FF9C01"}
              />
            </TouchableOpacity>

            <Text className="base-bold text-dark-100">{item.quantity}</Text>

            <TouchableOpacity
              onPress={() => increaseQty(item.id, item.customizations!)}
              className="cart-item__actions"
            >
              <Image
                source={images.plus}
                className="size-1/2"
                resizeMode="contain"
                tintColor={"#FF9C01"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => removeItem(item.id, item.customizations!)}
        className="p-1 mb-1 flex-center"
      >
        <Image source={images.trash} className="size-5" resizeMode="contain" />
      </TouchableOpacity>
    </View>
  );
};

export default CartItem;
