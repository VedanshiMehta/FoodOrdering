import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import CartContext from "../lib/services/cart_services/CartContext";
import { MenuItem, CartCustomization } from "@/type";

import { images, toppings as CONST_TOPPINGS, sides as CONST_SIDES } from "@/constants";
import { Query } from "react-native-appwrite";
import {
  APPWRITE_DATABASE_ID,
  CUSTOMIZATIONS_COLLECTION_ID,
  MENU_CUSTOMIZATIONS_COLLECTION_ID,
  APPWRITE_USERS_COLLECTION_ID,
} from "../lib/services/auth_services/appwrite";

const { width } = Dimensions.get("window");

const BUN_TYPES = ["Whole Wheat", "Sesame Seed", "Brioche"];

// Helper to resolve dynamic database customizations to local visual assets or placeholders
const mapCustomization = (cus: any) => {
  const name = cus.name || "";
  const normalized = name.toLowerCase().trim();
  const resolvedPrice = (cus.price || 0) > 0 ? cus.price / 10 : 0.0;

  if (cus.type === "topping") {
    // Try to find a match in the predefined static CONST_TOPPINGS constant
    const found = CONST_TOPPINGS.find((t) => {
      const tNorm = t.name.toLowerCase();
      return tNorm.includes(normalized) || normalized.includes(tNorm);
    });

    return {
      id: found ? found.name.toLowerCase().replace(/\s+/g, "-") : normalized.replace(/\s+/g, "-"),
      name: found ? found.name : name,
      image: cus.image_url ? { uri: cus.image_url } : (found ? found.image : images.emptyState),
      price: resolvedPrice || (found ? found.price : 1.5),
    };
  } else {
    // Try to find a match in the predefined static CONST_SIDES constant
    const found = CONST_SIDES.find((s) => {
      const sNorm = s.name.toLowerCase();
      return sNorm.includes(normalized) || normalized.includes(sNorm);
    });

    return {
      id: found ? found.name.toLowerCase().replace(/\s+/g, "-") : normalized.replace(/\s+/g, "-"),
      name: found ? found.name : name,
      image: cus.image_url ? { uri: cus.image_url } : (found ? found.image : images.emptyState),
      price: resolvedPrice || (found ? found.price : 3.0),
    };
  }
};

export default function ItemDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { appwrite } = useContext(AppwriteContext);
  const { addItem } = useContext(CartContext);

  // States
  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [selectedBun, setSelectedBun] = useState(BUN_TYPES[0]);
  const [dynamicToppings, setDynamicToppings] = useState<any[]>([]);
  const [dynamicSides, setDynamicSides] = useState<any[]>([]);

  // Fetch Item & Customizations from Appwrite dynamically
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const menuItemDoc = await appwrite.getMenuItem(id as string);
        if (menuItemDoc) {
          setItem(menuItemDoc as unknown as MenuItem);

          // Perform direct query on menu_customizations database collection linking menu to customizations
          const menuCusLinks = await appwrite.database.listRows({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: MENU_CUSTOMIZATIONS_COLLECTION_ID,
            queries: [Query.equal("menu", id as string)],
          });

          const cusDocs: any[] = [];
          for (const row of menuCusLinks.rows) {
            if (row.customizations) {
              if (typeof row.customizations === "object") {
                cusDocs.push(row.customizations);
              } else if (typeof row.customizations === "string") {
                try {
                  const cusDoc = await appwrite.database.getRow({
                    databaseId: APPWRITE_DATABASE_ID,
                    tableId: CUSTOMIZATIONS_COLLECTION_ID,
                    rowId: row.customizations,
                  });
                  if (cusDoc) {
                    cusDocs.push(cusDoc);
                  }
                } catch (err) {
                  console.log("Error fetching customization details: " + err);
                }
              }
            }
          }

          const toppingsList: any[] = [];
          const sidesList: any[] = [];

          cusDocs.forEach((cus: any) => {
            const mapped = mapCustomization(cus);
            if (cus.type === "topping") {
              if (!toppingsList.some(t => t.id === mapped.id)) {
                toppingsList.push(mapped);
              }
            } else {
              if (!sidesList.some(s => s.id === mapped.id)) {
                sidesList.push(mapped);
              }
            }
          });

          setDynamicToppings(toppingsList);
          setDynamicSides(sidesList);
        }
      } catch (err) {
        console.error("Failed to load menu item details:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, appwrite]);

  // Toggle Topping
  const toggleTopping = (toppingId: string) => {
    setSelectedToppings((prev) =>
      prev.includes(toppingId)
        ? prev.filter((id) => id !== toppingId)
        : [...prev, toppingId]
    );
  };

  // Toggle Side
  const toggleSide = (sideId: string) => {
    setSelectedSides((prev) =>
      prev.includes(sideId) ? prev.filter((id) => id !== sideId) : [...prev, sideId]
    );
  };

  // Calculate pricing details dynamically
  const basePrice = item?.price ?? 0;
  const toppingsPrice = selectedToppings.reduce((total, tId) => {
    const topping = dynamicToppings.find((t) => t.id === tId);
    return total + (topping?.price ?? 0);
  }, 0);
  const sidesPrice = selectedSides.reduce((total, sId) => {
    const side = dynamicSides.find((s) => s.id === sId);
    return total + (side?.price ?? 0);
  }, 0);

  const singleItemTotal = basePrice + toppingsPrice + sidesPrice;
  const overallTotal = singleItemTotal * quantity;

  const isBurger = item && (item.name.toLowerCase().includes("burger") || (item.type && item.type.toLowerCase().includes("burger")));

  // Add customized items to the global cart context
  const handleAddToCart = () => {
    if (!item) return;

    const selectedCustomizations: CartCustomization[] = [];
    selectedToppings.forEach((toppingId) => {
      const topping = dynamicToppings.find((t) => t.id === toppingId);
      if (topping) {
        selectedCustomizations.push({
          id: topping.id,
          name: topping.name,
          price: topping.price,
          type: "Topping",
        });
      }
    });

    selectedSides.forEach((sideId) => {
      const side = dynamicSides.find((s) => s.id === sideId);
      if (side) {
        selectedCustomizations.push({
          id: side.id,
          name: side.name,
          price: side.price,
          type: "Side",
        });
      }
    });

    if (isBurger) {
      selectedCustomizations.push({
        id: `bun-${selectedBun.toLowerCase().replace(" ", "-")}`,
        name: selectedBun,
        price: 0,
        type: "Bun Type",
      });
    }

    // Add each instance sequentially to increase quantity count inside Context
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: item.$id,
        name: item.name,
        price: item.price,
        image_url: item.image_url,
        customizations: selectedCustomizations,
      });
    }

    Alert.alert(
      "Added to Cart",
      `${quantity}x ${item.name} added to your cart successfully!`,
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-3 text-[15px] text-gray-500" style={{ fontFamily: "Quicksand-SemiBold" }}>
          Fetching delicious details...
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text className="mt-3 text-base text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
          Menu item not found.
        </Text>
        <TouchableOpacity className="mt-5 bg-orange-500 px-6 py-3 rounded-2xl" onPress={() => router.back()}>
          <Text className="text-white text-sm" style={{ fontFamily: "Quicksand-Bold" }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header Bar */}
      <View className="flex-row items-center justify-between px-5 py-3 bg-white">
        <TouchableOpacity
          className="w-[42px] h-[42px] rounded-full border border-gray-100 bg-white items-center justify-center"
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity className="w-[42px] h-[42px] rounded-full border border-gray-100 items-center justify-center" activeOpacity={0.7}>
          <Ionicons name="search" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Upper Info Grid & Floating Product Image */}
        <View className="flex-row px-5 mt-2.5 mb-5 relative" style={{ minHeight: width * 0.58 }}>
          <View className="z-10" style={{ width: width * 0.5 }}>
            <Text className="text-[26px] text-gray-900 mb-1 leading-8" style={{ fontFamily: "Quicksand-Bold" }}>
              {item.name}
            </Text>
            <Text className="text-[15px] text-gray-400 mb-2.5" style={{ fontFamily: "Quicksand-Medium" }}>
              {item.type || "Cheeseburger"}
            </Text>

            {/* Stars Row */}
            <View className="flex-row items-center mb-3">
              {[...Array(5)].map((_, i) => (
                <Ionicons
                  key={i}
                  name={i < Math.floor(item.rating || 5) ? "star" : "star-outline"}
                  size={16}
                  color="#fbbf24"
                  style={{ marginRight: 2 }}
                />
              ))}
              <Text className="text-xs text-gray-500 ml-1.5" style={{ fontFamily: "Quicksand-Bold" }}>
                {(item.rating || 4.9).toFixed(1)}/5
              </Text>
            </View>

            {/* Price digits */}
            <View className="flex-row items-start mb-4">
              <Text className="text-base text-orange-500 mt-1 mr-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                $
              </Text>
              <Text className="text-[32px] text-orange-500" style={{ fontFamily: "Quicksand-Bold" }}>
                {item.price.toFixed(2)}
              </Text>
            </View>

            {/* Nutrition Attributes */}
            <View className="flex-row gap-4 mb-4">
              <View className="flex-1">
                <Text className="text-xs text-gray-400 mb-1" style={{ fontFamily: "Quicksand-Medium" }}>
                  Calories
                </Text>
                <Text className="text-sm text-gray-700" style={{ fontFamily: "Quicksand-Bold" }}>
                  {item.calories || 365} Cal
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-400 mb-1" style={{ fontFamily: "Quicksand-Medium" }}>
                  Protein
                </Text>
                <Text className="text-sm text-gray-700" style={{ fontFamily: "Quicksand-Bold" }}>
                  {item.protein || 35}g
                </Text>
              </View>
            </View>

            {/* Bun Selector Trigger */}
            {isBurger && (
              <View className="mt-1">
                <Text className="text-xs text-gray-400 mb-2" style={{ fontFamily: "Quicksand-Medium" }}>
                  Bun Type
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {BUN_TYPES.map((bun) => (
                    <TouchableOpacity
                      key={bun}
                      className={`px-[8px] py-[5px] rounded-lg bg-gray-100 border border-gray-200 ${selectedBun === bun ? "bg-orange-50 border-orange-200" : ""}`}
                      onPress={() => setSelectedBun(bun)}
                      activeOpacity={0.8}
                    >
                      <Text
                        className={`text-[11px] text-gray-500 ${selectedBun === bun ? "text-orange-500" : ""}`}
                        style={{ fontFamily: "Quicksand-Bold" }}
                      >
                        {bun}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Product Large Image */}
          <View className="absolute -right-[30px] -top-[10px] z-[1] items-center justify-center rounded-full overflow-hidden" style={{ width: width * 0.58, height: width * 0.58 }}>
            <Image
              source={{ uri: item.image_url }}
              className="w-full h-full rounded-full overflow-hidden"
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Dynamic Delivery Pill Bar */}
        <View className="flex-row items-center bg-amber-50 border border-amber-100 rounded-[20px] py-3 px-4 mx-5 justify-between mb-5">
          <View className="flex-row items-center">
            <Text className="text-sm mr-1.5">💲</Text>
            <Text className="text-[13px] text-amber-600" style={{ fontFamily: "Quicksand-Bold" }}>Free Delivery</Text>
          </View>
          <View className="w-1 h-1 rounded-full bg-amber-300" />
          <View className="flex-row items-center">
            <Text className="text-sm mr-1.5">🕒</Text>
            <Text className="text-[13px] text-amber-600" style={{ fontFamily: "Quicksand-Bold" }}>20 - 30 mins</Text>
          </View>
          <View className="w-1 h-1 rounded-full bg-amber-300" />
          <View className="flex-row items-center">
            <Text className="text-sm mr-1.5">⭐</Text>
            <Text className="text-[13px] text-amber-600" style={{ fontFamily: "Quicksand-Bold" }}>{(item.rating || 4.5).toFixed(1)}</Text>
          </View>
        </View>

        {/* Product Description */}
        <Text className="text-sm text-gray-600 leading-[22px] mx-5 mb-6" style={{ fontFamily: "Quicksand-Medium" }}>
          {item.description ||
            `The ${item.type || "Cheeseburger"} ${item.name} is a classic fast food burger that packs a punch of flavor in every bite. Made with a juicy beef patty cooked to perfection, it's topped with melted American cheese, crispy lettuce, tomato, & crunchy pickles.`}
        </Text>

        {/* Toppings Horizontal list */}
        {dynamicToppings.length > 0 && (
          <>
            <Text className="text-lg text-gray-900 mx-5 mb-4" style={{ fontFamily: "Quicksand-Bold" }}>Toppings</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 20, paddingRight: 8, paddingBottom: 10 }}
            >
              {dynamicToppings.map((topping) => {
                const isSelected = selectedToppings.includes(topping.id);
                return (
                  <TouchableOpacity
                    key={topping.id}
                    className="mr-3"
                    style={Platform.select({
                      ios: {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.05,
                        shadowRadius: 6,
                      },
                      android: {
                        elevation: 3,
                      },
                    })}
                    onPress={() => toggleTopping(topping.id)}
                    activeOpacity={0.85}
                  >
                    <View className="bg-white rounded-[18px] overflow-hidden w-24 border border-gray-100">
                      <View className="h-20 items-center justify-center bg-white p-2">
                        <Image source={topping.image} className="w-full h-full" resizeMode="contain" />
                      </View>
                      <View className={`flex-row items-center justify-between bg-[#37302f] px-2 py-1.5 min-h-[38px] ${isSelected ? "bg-orange-500" : ""}`}>
                        <Text className="text-[9.5px] text-white flex-1 mr-1 leading-3" style={{ fontFamily: "Quicksand-Bold" }}>{topping.name}</Text>
                        <View className={`w-4 h-4 rounded-full bg-red-500 items-center justify-center shrink-0 ${isSelected ? "bg-green-500" : ""}`}>
                          <Ionicons
                            name={isSelected ? "checkmark" : "add"}
                            size={12}
                            color="#fff"
                          />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Sides Horizontal list */}
        {dynamicSides.length > 0 && (
          <>
            <Text className="text-lg text-gray-900 mx-5 mb-4" style={{ fontFamily: "Quicksand-Bold" }}>Side options</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 20, paddingRight: 8, paddingBottom: 10 }}
            >
              {dynamicSides.map((side) => {
                const isSelected = selectedSides.includes(side.id);
                return (
                  <TouchableOpacity
                    key={side.id}
                    className="mr-3"
                    style={Platform.select({
                      ios: {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.05,
                        shadowRadius: 6,
                      },
                      android: {
                        elevation: 3,
                      },
                    })}
                    onPress={() => toggleSide(side.id)}
                    activeOpacity={0.85}
                  >
                    <View className="bg-white rounded-[18px] overflow-hidden w-24 border border-gray-100">
                      <View className="h-20 items-center justify-center bg-white p-2">
                        <Image source={side.image} className="w-full h-full" resizeMode="contain" />
                      </View>
                      <View className={`flex-row items-center justify-between bg-[#37302f] px-2 py-1.5 min-h-[38px] ${isSelected ? "bg-orange-500" : ""}`}>
                        <Text className="text-[9.5px] text-white flex-1 mr-1 leading-3" style={{ fontFamily: "Quicksand-Bold" }}>{side.name}</Text>
                        <View className={`w-4 h-4 rounded-full bg-red-500 items-center justify-center shrink-0 ${isSelected ? "bg-green-500" : ""}`}>
                          <Ionicons
                            name={isSelected ? "checkmark" : "add"}
                            size={12}
                            color="#fff"
                          />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
      </ScrollView>

      {/* Sticky Bottom Action Checkout Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex-row items-center justify-between px-5 py-4" style={{ paddingBottom: Platform.OS === "ios" ? 32 : 16 }}>
        {/* Quantity selector */}
        <View className="flex-row items-center bg-[#fcf6f5] border border-[#fbebe9] rounded-2xl px-2">
          <TouchableOpacity
            className="w-9 h-9 items-center justify-center"
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={18} color="#4b5563" />
          </TouchableOpacity>
          <Text className="text-base text-gray-800 px-3" style={{ fontFamily: "Quicksand-Bold" }}>{quantity}</Text>
          <TouchableOpacity
            className="w-9 h-9 items-center justify-center"
            onPress={() => setQuantity((q) => q + 1)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color="#4b5563" />
          </TouchableOpacity>
        </View>

        {/* Add to Cart button */}
        <TouchableOpacity
          className="flex-1 ml-4 bg-orange-500 h-[52px] rounded-[18px] flex-row items-center justify-center gap-2"
          onPress={handleAddToCart}
          activeOpacity={0.85}
          style={{
            shadowColor: "#f97316",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          <Ionicons name="bag-handle-outline" size={20} color="#fff" />
          <Text className="text-white text-[15px]" style={{ fontFamily: "Quicksand-Bold" }}>Add to cart (${overallTotal.toFixed(2)})</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
