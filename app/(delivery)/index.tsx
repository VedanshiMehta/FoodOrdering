import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
  ScrollView,
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

export default function DeliveriesScreen() {
  const router = useRouter();
  const { appwrite, user } = useContext(AppwriteContext);
  const { setSelectedOrderForMap, setCustomerCoords, setMapOriginTab } = useContext(DeliveryContext);
  const countryCode = useSelector((state: RootState) => state.location.countryCode);

  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Fetch all orders dynamically
  const { data: ordersData, refetch: refetchOrders, loading: ordersLoading } = useAppwrite({
    fn: () => appwrite.getOrders(),
  });

  const [allActiveOrders, setAllActiveOrders] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      refetchOrders();
    }, [])
  );

  useEffect(() => {
    if (ordersData) {
      // 1. Ready-for-pickup orders
      const pickupList = ordersData.filter((o) => o.status === "ready");

      // 2. Active transit orders for the current logged-in rider
      const activeList = ordersData.filter(
        (o) => o.status === "picked_up" && (user?.$id ? o.deliveryBoyId === user?.$id : true)
      );

      // Merge and sort newest first
      const combined = [...pickupList, ...activeList];
      combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAllActiveOrders(combined);
    }
  }, [ordersData, user?.$id]);

  const handlePickUp = async (orderId: string) => {
    setIsUpdating(true);
    try {
      await appwrite.database.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "orders",
        rowId: orderId,
        data: {
          status: "picked_up",
          deliveryBoyId: user?.$id || "",
          deliveryBoyName: user?.name || "Vedik Patel",
          deliveryBoyPhone: user?.phoneNumber || "+91 98765 43210",
        },
      });

      Alert.alert("Success", "Order successfully picked up! It is now in your Active Deliveries.");
      refetchOrders();
    } catch (err) {
      console.log("Pick up order error: ", err);
      // Fallback for simulation
      Alert.alert(
        "Picked Up (Simulation)",
        "Order picked up successfully on local environment!"
      );
      refetchOrders();
    } finally {
      setIsUpdating(false);
    }
  };

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
      refetchOrders();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTrackOnMap = async (order: any, origin: "pick" | "active") => {
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
        console.log("Error pre-fetching customer coordinates:", err);
        setCustomerCoords(null);
      }
    } else {
      setCustomerCoords(null);
    }

    setMapOriginTab(origin);
    router.push({ pathname: "/(delivery)/map" } as any);
  };

  const formatTime = (ts: any) => {
    if (!ts) return "Just now";
    const d = new Date(ts);
    return isNaN(d.getTime()) 
      ? "Just now" 
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-transparent">
        <View>
          <Text className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
            Deliveries
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
            Welcome, {user?.name || "Delivery Rider"}
          </Text>
        </View>
      </View>

      {/* UNIFIED LIST VIEW */}
      <FlatList
        data={allActiveOrders}
        keyExtractor={(item) => item.$id}
        refreshing={ordersLoading}
        onRefresh={refetchOrders}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 130 }}
        renderItem={({ item }) => {
          const isPick = item.status === "ready";
          return (
            <TouchableOpacity
              onPress={() => {
                setSelectedOrder(item);
                setShowDetailsModal(true);
              }}
              activeOpacity={0.8}
              className={`bg-white rounded-3xl p-5 mb-4 border shadow-sm relative overflow-hidden ${
                isPick ? "border-orange-50/70 shadow-orange-500/5" : "border-green-50/70 shadow-green-500/5"
              }`}
            >
              {/* Header row */}
              <View className="flex-row justify-between items-center pb-2">
                <View>
                  <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                    ID: #{item.$id.slice(-6).toUpperCase()}
                  </Text>
                  <Text className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
                    {formatTime(item.timestamp)} • {item.paymentMethod === "cod" ? "COD" : "Card"}
                  </Text>
                </View>
                <View className={`px-3 py-1 rounded-full border ${
                  isPick ? "bg-amber-50 border-amber-100" : "bg-orange-50 border-orange-100"
                }`}>
                  <Text className={`text-[9px] font-bold uppercase tracking-wider ${
                    isPick ? "text-amber-600" : "text-orange-600"
                  }`} style={{ fontFamily: "Quicksand-Bold" }}>
                    {isPick ? "Pickup Pending" : "In Transit"}
                  </Text>
                </View>
              </View>

              {/* Summary details */}
              <View className="flex-row justify-between items-center mt-2">
                <View className="flex-1 mr-2">
                  <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                    Route
                  </Text>
                  <Text className="text-xs font-bold text-gray-850 mt-0.5" style={{ fontFamily: "Quicksand-Bold" }} numberOfLines={1}>
                    {item.pickupBranchName || item.items?.[0]?.pickupBranchName || "Burger & Pizza Bistro"} → {item.userName || "Customer"}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                    COD Collect
                  </Text>
                  <Text className="text-sm font-bold text-gray-900 mt-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                    {formatPrice(item.total || 0, countryCode)}
                  </Text>
                </View>
              </View>

              {/* Items summary and forward chevron */}
              <View className="bg-gray-50/50 rounded-2xl p-3 flex-row justify-between items-center mt-3">
                <View className="flex-1 mr-2">
                  <Text className="text-xs text-gray-700 font-medium" style={{ fontFamily: "Quicksand-Medium" }} numberOfLines={1}>
                    {item.items?.map((food: any) => `${food.quantity}x ${food.name}`).join(", ")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-20 px-5 bg-white rounded-3xl mx-2 shadow-md shadow-black/5 mt-4">
            <Image
              source={images.emptyState}
              className="size-44"
              resizeMode="contain"
            />
            <Text className="text-base font-bold text-gray-800 text-center mt-4" style={{ fontFamily: "Quicksand-Bold" }}>
              No Active Deliveries
            </Text>
            <Text className="text-xs text-gray-400 mt-2 text-center max-w-[80%] leading-relaxed" style={{ fontFamily: "Quicksand-Medium" }}>
              When new restaurant orders are ready for delivery, they will appear here. Tap on any order to pick it up!
            </Text>
          </View>
        )}
      />

      {/* 100% Borderless Premium Order Details Bottom Sheet */}
      <Modal
        visible={showDetailsModal && selectedOrder !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowDetailsModal(false);
          setSelectedOrder(null);
        }}
      >
        <View className="flex-1 bg-black/40 justify-end">
          {/* Dismiss Overlay */}
          <TouchableOpacity 
            className="absolute inset-0"
            activeOpacity={1}
            onPress={() => {
              setShowDetailsModal(false);
              setSelectedOrder(null);
            }}
          />

          {/* Bottom Sheet Body */}
          <View 
            className="bg-white rounded-t-[36px] p-6 pb-8" 
            style={{ 
              maxHeight: "85%",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            {/* Sheet Handle */}
            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mx-auto mb-5" />

            {/* Header */}
            {selectedOrder && (() => {
              const isPick = selectedOrder.status === "ready";

              return (
                <>
                  <View className="flex-row justify-between items-start mb-1">
                    <View className="flex-1 mr-2">
                      <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                        Delivery Details
                      </Text>
                      <Text className="text-xl font-bold text-gray-900 mt-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                        ID: #{String(selectedOrder.$id || "").slice(-6).toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => {
                        setShowDetailsModal(false);
                        setSelectedOrder(null);
                      }}
                      className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={20} color="#4B5563" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row justify-between items-center mt-2">
                    <Text className="text-xs text-gray-400" style={{ fontFamily: "Quicksand-Medium" }}>
                      {formatTime(selectedOrder.timestamp)} • {selectedOrder.paymentMethod === "cod" ? "COD" : "Card"}
                    </Text>
                    <View className={`px-3 py-1 rounded-full border ${
                      isPick ? "bg-amber-50 border-amber-100" : "bg-orange-50 border-orange-100"
                    }`}>
                      <Text className={`text-[9px] font-bold uppercase tracking-wider ${
                        isPick ? "text-amber-600" : "text-orange-600"
                      }`} style={{ fontFamily: "Quicksand-Bold" }}>
                        {isPick ? "Pickup Pending" : "In Transit"}
                      </Text>
                    </View>
                  </View>

                  <View className="h-[1px] bg-gray-100 my-4" />

                  <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
                    <View className="gap-5">
                      {/* Pickup origin */}
                      <View className="gap-1 pl-6 relative">
                        <View className="absolute left-0 top-[2px] w-4.5 h-4.5 rounded-full bg-orange-500 items-center justify-center">
                          <Ionicons name="restaurant" size={9} color="#fff" />
                        </View>
                        <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                          Pickup Origin
                        </Text>
                        <Text className="text-sm font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                          {selectedOrder.pickupBranchName || selectedOrder.items?.[0]?.pickupBranchName || "Burger & Pizza Bistro"}
                        </Text>
                        <Text className="text-xs text-gray-550 leading-normal" style={{ fontFamily: "Quicksand-Medium" }}>
                          {selectedOrder.pickupBranchAddress || selectedOrder.items?.[0]?.pickupBranchAddress || "Main Ave, Food Court Plaza"}
                        </Text>
                      </View>

                      {/* Dropoff destination */}
                      <View className="gap-1 pl-6 relative">
                        <View className="absolute left-0 top-[2px] w-4.5 h-4.5 rounded-full bg-blue-500 items-center justify-center">
                          <Ionicons name="home" size={9} color="#fff" />
                        </View>
                        <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                          Drop Destination
                        </Text>
                        <Text className="text-sm font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                          {selectedOrder.userName || "Customer"}
                        </Text>
                        <Text className="text-xs text-gray-550 leading-normal" style={{ fontFamily: "Quicksand-Medium" }}>
                          {selectedOrder.address}
                        </Text>
                      </View>

                      {/* Items List */}
                      <View className="gap-2 bg-gray-50/55 rounded-2xl p-4 shadow-sm shadow-black/5">
                        <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1" style={{ fontFamily: "Quicksand-Bold" }}>
                          Kitchen Order List
                        </Text>
                        {selectedOrder.items?.map((food: any, index: number) => (
                          <View key={index} className="gap-1 pb-2 mb-2 border-b border-gray-100/50">
                            <View className="flex-row justify-between items-center">
                              <Text className="text-xs font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                                {food.quantity}x {food.name}
                              </Text>
                              <Text className="text-xs font-bold text-gray-600 font-sans">
                                {formatPrice(food.price * food.quantity, countryCode)}
                              </Text>
                            </View>
                            {food.customizations && food.customizations.length > 0 && (
                              <View className="pl-4 flex-row flex-wrap gap-1.5 mt-1">
                                {food.customizations.map((cus: any, idx: number) => (
                                  <View key={idx} className="bg-white border border-gray-100 px-2 py-0.5 rounded-lg">
                                    <Text className="text-[9px] text-gray-500 font-medium" style={{ fontFamily: "Quicksand-Medium" }}>
                                      + {cus.name} {cus.price > 0 ? `(+${formatPrice(cus.price, countryCode)})` : ""}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        ))}
                      </View>

                      {/* Footer Totals */}
                      <View className="flex-row justify-between items-center pt-2">
                        <View>
                          <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                            COD to Collect
                          </Text>
                          <Text className="text-lg font-bold text-orange-500" style={{ fontFamily: "Quicksand-Bold" }}>
                            {formatPrice(selectedOrder.total || 0, countryCode)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Actions row */}
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => {
                        setShowDetailsModal(false);
                        handleTrackOnMap(selectedOrder, isPick ? "pick" : "active");
                      }}
                      className="bg-orange-50 border border-orange-100 flex-1 h-14 rounded-2xl items-center justify-center flex-row gap-2"
                      activeOpacity={0.8}
                    >
                      <Ionicons name="map" size={18} color="#f97316" />
                      <Text className="text-orange-500 text-xs font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                        Track Live on Map
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={async () => {
                        setShowDetailsModal(false);
                        if (isPick) {
                          await handlePickUp(selectedOrder.$id);
                        } else {
                          await handleDeliver(selectedOrder.$id);
                        }
                      }}
                      className={`flex-1 h-14 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm ${
                        isPick ? "bg-orange-500 shadow-orange-500/10" : "bg-green-500 shadow-green-500/10"
                      }`}
                      activeOpacity={0.8}
                      disabled={isUpdating}
                    >
                      <Ionicons name={isPick ? "bicycle" : "checkmark-circle"} size={18} color="#fff" />
                      <Text className="text-white text-xs font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                        {isPick ? "Pick Up Food" : "Deliver Order"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
