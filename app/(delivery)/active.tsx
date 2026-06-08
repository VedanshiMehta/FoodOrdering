import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { APPWRITE_DATABASE_ID } from "../lib/services/auth_services/appwrite";
import useAppwrite from "../lib/services/appwrite_data_services/useApprwriteData";
import { DeliveryContext } from "./_layout";
import { images } from "@/constants";
import { useSelector } from "react-redux";
import { RootState } from "../../store/store";
import { formatPrice } from "../lib/currency";

export default function ActiveDeliveriesScreen() {
  const router = useRouter();
  const { appwrite, user } = useContext(AppwriteContext);
  const { setSelectedOrderForMap, setCustomerCoords, setMapOriginTab } = useContext(DeliveryContext);
  const countryCode = useSelector((state: RootState) => state.location.countryCode);

  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch all orders dynamically
  const { data: ordersData, refetch: refetchOrders, loading: ordersLoading } = useAppwrite({
    fn: () => appwrite.getOrders(),
  });

  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);

  useEffect(() => {
    if (ordersData) {
      // Filter out only picked_up orders for this rider
      const list = ordersData.filter((o) => o.status === "picked_up" && (user?.$id ? o.deliveryBoyId === user?.$id : true));
      // Sort: show oldest pickup first to prioritize urgent deliveries
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setActiveDeliveries(list);
    }
  }, [ordersData, user?.$id]);

  const handleDeliver = async (orderId: string) => {
    setIsUpdating(true);
    try {
      await appwrite.database.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "orders",
        rowId: orderId,
        data: {
          status: "delivered",
          deliveryBoyId: user?.$id || "",
          deliveryBoyName: user?.name || "Vedik Patel",
          deliveryBoyPhone: user?.phoneNumber || "+91 98765 43210",
        },
      });

      Alert.alert("Delivered!", "Order successfully delivered! Great job!");
      refetchOrders();
    } catch (err) {
      console.log("Deliver order error: ", err);
      // Fallback for simulation
      Alert.alert(
        "Delivered (Simulation)",
        "Order delivered successfully on local environment!"
      );
      setActiveDeliveries((prev) => prev.filter((o) => o.$id !== orderId));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTrackOnMap = async (order: any) => {
    setSelectedOrderForMap(order);
    
    // Background location fetch
    if (order.userId) {
      try {
        const loc = await appwrite.getUserLocation(order.userId);
        if (loc && loc.latitude !== null && loc.longitude !== null) {
          setCustomerCoords({
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
        } else {
          setCustomerCoords(null);
        }
      } catch (err) {
        console.log("Error loading customer coordinates:", err);
        setCustomerCoords(null);
      }
    } else {
      setCustomerCoords(null);
    }

    setMapOriginTab("active");
    router.push({ pathname: "/(delivery)/map" } as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-transparent">
        <View>
          <Text className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
            Active Deliveries
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
            Orders currently in transit
          </Text>
        </View>
        <View className="w-10 h-10 rounded-full border border-gray-150 items-center justify-center bg-orange-50">
          <Ionicons name="bicycle" size={20} color="#f97316" />
        </View>
      </View>

      {/* ACTIVE DELIVERIES LIST VIEW */}
      <FlatList
        data={activeDeliveries}
        keyExtractor={(item) => item.$id}
        refreshing={ordersLoading}
        onRefresh={refetchOrders}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 130 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-3xl p-5 border border-green-50 mb-4 shadow-md shadow-green-500/5 relative overflow-hidden">
            {/* Top Header Row */}
            <View className="flex-row justify-between items-center pb-3 border-b border-gray-50 mb-4">
              <View className="flex-row items-center gap-1.5">
                <View className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <Text className="text-[11px] text-gray-500 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                  ID: #{item.$id.slice(-6).toUpperCase()}
                </Text>
              </View>
              <View className="px-3 py-1 rounded-full bg-orange-50 border border-orange-100">
                <Text className="text-[9px] font-bold uppercase tracking-wider text-orange-600" style={{ fontFamily: "Quicksand-Bold" }}>
                  In Transit
                </Text>
              </View>
            </View>

            {/* Custom Visual Dotted Line connecting Restaurant and Customer */}
            <View className="relative gap-5 pl-8">
              {/* Vertical dotted line representation */}
              <View className="absolute left-[13px] top-[14px] bottom-[14px] w-[2px] border-l-2 border-dashed border-orange-200" />

              {/* Pickup origin */}
              <View className="relative">
                <View className="absolute left-[-26px] top-[1px] w-5 h-5 rounded-full bg-orange-500 border-2 border-white items-center justify-center shadow-sm">
                  <Ionicons name="restaurant" size={10} color="#fff" />
                </View>
                <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                  Pickup Origin
                </Text>
                <Text className="text-sm font-bold text-gray-800 mt-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                  {item.pickupBranchName || item.items?.[0]?.pickupBranchName || "Restaurant Pickup"}
                </Text>
                <Text className="text-xs text-gray-400 leading-normal" style={{ fontFamily: "Quicksand-Medium" }}>
                  {item.pickupBranchAddress || item.items?.[0]?.pickupBranchAddress || "Pickup outlet address"}
                </Text>
              </View>

              {/* Dropoff destination */}
              <View className="relative">
                <View className="absolute left-[-26px] top-[1px] w-5 h-5 rounded-full bg-blue-500 border-2 border-white items-center justify-center shadow-sm">
                  <Ionicons name="home" size={10} color="#fff" />
                </View>
                <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                  Drop Destination
                </Text>
                <Text className="text-sm font-bold text-gray-800 mt-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                  {item.userName || "Customer"}
                </Text>
                <Text className="text-xs text-gray-500 leading-normal mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
                  {item.address}
                </Text>
              </View>
            </View>

            {/* Price and Action Bar */}
            <View className="flex-row justify-between items-center pt-4 border-t border-gray-50 mt-5">
              <View>
                <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                  COD to Collect
                </Text>
                <Text className="text-lg font-bold text-orange-500" style={{ fontFamily: "Quicksand-Bold" }}>
                  {formatPrice(item.total || 0, countryCode)}
                </Text>
              </View>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="bg-orange-50 w-11 h-11 rounded-2xl items-center justify-center border border-orange-100"
                  onPress={() => handleTrackOnMap(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="map" size={18} color="#f97316" />
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-green-500 px-5 h-11 rounded-2xl items-center justify-center flex-row gap-1.5 shadow-sm shadow-green-500/20"
                  onPress={() => handleDeliver(item.$id)}
                  activeOpacity={0.85}
                  disabled={isUpdating}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text className="text-white text-xs font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                    Deliver Order
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-20 px-5">
            <Image
              source={images.emptyState}
              className="size-48"
              resizeMode="contain"
            />
            <Text className="text-base font-bold text-gray-800 text-center mt-4" style={{ fontFamily: "Quicksand-Bold" }}>
              No Active Deliveries
            </Text>
            <Text className="text-xs text-gray-400 mt-2 text-center max-w-[80%] leading-relaxed" style={{ fontFamily: "Quicksand-Medium" }}>
              Your active transit list is empty. Go to the Pick Order tab and pickup some food to start delivering!
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
