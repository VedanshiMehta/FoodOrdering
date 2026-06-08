import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import useAppwrite from "../lib/services/appwrite_data_services/useApprwriteData";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store/store";
import { formatPrice } from "../lib/currency";

export default function MyMenuScreen() {
  const { user, appwrite } = useContext(AppwriteContext);
  const router = useRouter();
  const countryCode = useSelector((state: RootState) => state.location.countryCode);
  
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Fetch dynamic categories for horizontal selector
  const { data: categoriesData, refetch: refetchCategories } = useAppwrite({
    fn: () => appwrite.getCategories(),
  });

  // Fetch dynamic menu from database based on selected category filter
  const { data: menuData, refetch: refetchMenu, loading } = useAppwrite({
    fn: appwrite.getMenu,
    params: {
      category: selectedCategory === "all" ? undefined : selectedCategory,
    },
  });

  // Trigger refetch when category selection changes
  useEffect(() => {
    refetchMenu({ category: selectedCategory === "all" ? undefined : selectedCategory });
  }, [selectedCategory]);

  // Auto-refresh when screen comes into focus (e.g. returning from Add Food)
  useFocusEffect(
    useCallback(() => {
      refetchMenu({ category: selectedCategory === "all" ? undefined : selectedCategory });
      refetchCategories({});
    }, [selectedCategory])
  );

  const managerName = user?.name || "Domino's";
  const isDomino = managerName.toLowerCase().includes("domino");

  const [fullMenuData, setFullMenuData] = useState<any[]>([]);

  useEffect(() => {
    if (selectedCategory === "all" && menuData && menuData.length > 0) {
      setFullMenuData(menuData);
    }
  }, [menuData, selectedCategory]);

  const filteredMenuData = menuData?.filter((item: any) => {
    const itemUserId = item.userId ? (typeof item.userId === "object" ? item.userId.$id : item.userId) : null;
    
    if (isDomino) {
      return itemUserId === user?.$id || item.name.toLowerCase().includes("domino");
    } else {
      return itemUserId === user?.$id;
    }
  }) || [];

  const handleDeleteFood = (itemId: string, itemName: string) => {
    Alert.alert(
      "Delete Menu Item",
      `Are you sure you want to delete "${itemName}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const success = await appwrite.deleteMenu(itemId);
            if (success !== false) {
              refetchMenu({ category: selectedCategory === "all" ? undefined : selectedCategory });
              Alert.alert("Deleted", `"${itemName}" has been removed from your menu.`);
            } else {
              Alert.alert("Error", "Failed to delete item.");
            }
          },
        },
      ]
    );
  };

  // Filter categories dynamically based on manager's actual active dishes
  const activeCategoryIds = new Set(
    fullMenuData
      .filter((item: any) => {
        const itemUserId = item.userId ? (typeof item.userId === "object" ? item.userId.$id : item.userId) : null;
        if (isDomino) {
          return itemUserId === user?.$id || item.name.toLowerCase().includes("domino");
        } else {
          return itemUserId === user?.$id;
        }
      })
      .map((item: any) => {
        if (!item.categories) return null;
        return typeof item.categories === "object" ? item.categories.$id : item.categories;
      })
      .filter(Boolean)
  );

  const filteredCategories = categoriesData?.filter((cat: any) => activeCategoryIds.has(cat.$id)) || [];

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-5 bg-gray-50">
        <View>
          <Text className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Quicksand-Bold" }}>
            Hotel Manager
          </Text>
          <Text className="text-xs text-gray-400 mt-1" style={{ fontFamily: "Quicksand-Medium" }}>
            Welcome, {user?.name || "Domino's"}
          </Text>
        </View>
      </View>

      {/* HORIZONTAL CATEGORY FILTERS ROW */}
      <View className="mb-2 px-5">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-x-2 pb-3"
          data={
            filteredCategories.length > 0
              ? [{ $id: "all", name: "All" }, ...filteredCategories]
              : [{ $id: "all", name: "All" }]
          }
          keyExtractor={(item) => item.$id}
          renderItem={({ item: cat }) => {
            const isSelected = selectedCategory === cat.$id;
            return (
              <TouchableOpacity
                key={cat.$id}
                onPress={() => setSelectedCategory(cat.$id)}
                className={`filter ${isSelected ? "bg-amber-500" : "bg-white"}`}
                style={
                  Platform.OS === "android"
                    ? { elevation: 5, shadowColor: "#878787" }
                    : {}
                }
                activeOpacity={0.8}
              >
                <Text
                  className={`body-medium ${isSelected ? "text-white" : "text-grey-200"}`}
                  style={{ fontFamily: isSelected ? "Quicksand-Bold" : "Quicksand-Medium" }}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* DISHES LIST VIEW */}
      {loading && !menuData ? (
        <View className="flex-1 items-center justify-center bg-transparent">
          <ActivityIndicator size="large" color="#f97316" />
          <Text className="text-xs text-gray-400 mt-3" style={{ fontFamily: "Quicksand-Medium" }}>
            Loading delicious menu...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredMenuData}
          keyExtractor={(item) => item.$id}
          numColumns={2}
          columnWrapperClassName="gap-7"
          contentContainerClassName="gap-7 px-5 pt-12 pb-32"
          refreshing={loading}
          onRefresh={() => {
            refetchMenu({ category: selectedCategory === "all" ? undefined : selectedCategory });
            refetchCategories({});
          }}
          renderItem={({ item, index }) => {
            const isLeftCol = index % 2 === 0;
            return (
              <View
                className={`flex-1 max-w-[48%] ${!isLeftCol ? "mt-10" : "mt-0"}`}
              >
                <View
                  className="menu-card w-full relative"
                  style={
                    Platform.OS === "android"
                      ? { elevation: 10, shadowColor: "#878787" }
                      : {}
                  }
                >
                  <View className="size-32 absolute -top-10 self-center rounded-full overflow-hidden">
                    <Image
                      source={{ uri: item.image_url }}
                      className="w-full h-full"
                      resizeMode="contain"
                    />
                  </View>

                  <Text
                    className="text-center base-bold text-dark-100 mb-1.5"
                    numberOfLines={1}
                    style={{ fontFamily: "Quicksand-Bold" }}
                  >
                    {item.name}
                  </Text>
                  
                  <View className="flex-row items-center justify-center mb-1.5">
                    <Ionicons name="star" size={14} color="#f97316" />
                    <Text className="text-xs text-orange-500 ml-1" style={{ fontFamily: "Quicksand-Bold" }}>
                      {(item.rating ?? 4.5).toFixed(1)}
                    </Text>
                  </View>
                  
                  <Text
                    className="body-regular text-gray-200 mb-4 text-center"
                    style={{ fontFamily: "Quicksand-Medium" }}
                  >
                    From {formatPrice(item.price, countryCode)}
                  </Text>

                  <View className="flex-col gap-2.5 mt-auto self-center w-11/12 -mb-1">
                    <TouchableOpacity 
                      onPress={() => router.push(`/(hotel)/add?editId=${item.$id}` as any)}
                      className="flex-row items-center justify-center border border-orange-200 rounded-full py-2 w-full"
                    >
                      <Ionicons name="pencil" size={14} color="#f97316" />
                      <Text
                        className="text-xs text-orange-500 ml-1.5"
                        style={{ fontFamily: "Quicksand-Bold" }}
                      >
                        Edit
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleDeleteFood(item.$id, item.name)}
                      className="flex-row items-center justify-center border border-red-200 rounded-full py-2 w-full"
                    >
                      <Ionicons name="trash" size={14} color="#ef4444" />
                      <Text
                        className="text-xs text-red-500 ml-1.5"
                        style={{ fontFamily: "Quicksand-Bold" }}
                      >
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-20 px-6 bg-white rounded-3xl mx-2 mt-2 shadow-md shadow-black/5 w-full">
              <View className="w-24 h-24 bg-orange-50/60 rounded-full items-center justify-center mb-6 shadow-sm shadow-orange-500/10">
                <Ionicons name="fast-food" size={44} color="#f97316" />
              </View>
              <Text className="text-lg font-bold text-gray-800 text-center" style={{ fontFamily: "Quicksand-Bold" }}>
                No Dishes Found
              </Text>
              <Text className="text-xs text-gray-400 mt-2 text-center max-w-[260px] leading-5" style={{ fontFamily: "Quicksand-Medium" }}>
                {selectedCategory === "all"
                  ? "You haven't listed any delicious meals for your restaurant yet. Tap below to add your first food item!"
                  : "No items listed under this category yet. Tap below to list one now!"}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(hotel)/add" as any)}
                className="bg-orange-500 px-8 py-3.5 rounded-2xl mt-8 flex-row items-center gap-2 shadow-md shadow-orange-500/20"
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text className="text-white text-xs font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                  Add First Dish
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
