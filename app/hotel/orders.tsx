import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { APPWRITE_DATABASE_ID } from "../lib/services/auth_services/appwrite";

export default function HotelOrdersScreen() {
  const { user, appwrite } = useContext(AppwriteContext);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [managerMenuNames, setManagerMenuNames] = useState<Set<string>>(new Set());

  const fetchManagerMenu = async () => {
    try {
      const menuData = await appwrite.getMenu({});
      if (menuData) {
        const managerName = user?.name || "Domino's";
        const isDomino = managerName.toLowerCase().includes("domino");
        const filteredMenu = menuData.filter((item: any) => {
          if (isDomino) {
            return item.userId === user?.$id || item.name.toLowerCase().includes("domino");
          } else {
            return item.userId === user?.$id || (!item.userId && !item.name.toLowerCase().includes("domino"));
          }
        });
        const names = new Set(filteredMenu.map((item: any) => item.name.toLowerCase().trim()));
        setManagerMenuNames(names);
      }
    } catch (err) {
      console.log("Failed to fetch manager menu for order filtering:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      const allOrders = await appwrite.getOrders();
      if (allOrders) {
        // Sort: newest first
        allOrders.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setOrders(allOrders);
      }
    } catch (err) {
      console.log("Failed to fetch hotel orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerMenu();
    fetchOrders();
    // Poll orders every 3 seconds for live dashboard updates
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredOrders = orders.filter((order) => {
    if (!order.items || !Array.isArray(order.items)) return false;
    
    const managerName = user?.name || "Domino's";
    const isDomino = managerName.toLowerCase().includes("domino");
    
    return order.items.some((food: any) => {
      const foodName = food.name?.toLowerCase().trim() || "";
      if (managerMenuNames.has(foodName)) return true;
      
      if (isDomino) {
        return foodName.includes("domino");
      } else {
        return !foodName.includes("domino");
      }
    });
  });

  const updateOrderStatus = async (orderId: string, nextStatus: "preparing" | "ready") => {
    setUpdatingId(orderId);
    try {
      await appwrite.database.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "orders",
        rowId: orderId,
        data: {
          status: nextStatus,
        },
      });
      Alert.alert(
        "Status Updated",
        `Order is now marked as "${nextStatus === "preparing" ? "Preparing" : "Ready for Pickup"}".`
      );
      await fetchOrders();
    } catch (err) {
      console.error("Failed to update status in DB:", err);
      Alert.alert("Error", "Could not update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pending":
        return { bg: "bg-red-50", text: "text-red-600", label: "New Order" };
      case "preparing":
        return { bg: "bg-orange-50", text: "text-orange-600", label: "Preparing" };
      case "ready":
        return { bg: "bg-amber-50", text: "text-amber-600", label: "Ready for Pickup" };
      case "picked_up":
        return { bg: "bg-blue-50", text: "text-blue-600", label: "Out with Rider" };
      case "delivered":
        return { bg: "bg-emerald-50", text: "text-emerald-600", label: "Delivered" };
      default:
        return { bg: "bg-gray-50", text: "text-gray-600", label: "Unknown" };
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-5 bg-gray-50">
        <View>
          <Text className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Quicksand-Bold" }}>
            Incoming Orders
          </Text>
          <Text className="text-xs text-gray-400 mt-1" style={{ fontFamily: "Quicksand-Medium" }}>
            Manage your kitchen cooking queue in real-time
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center bg-transparent">
          <ActivityIndicator size="large" color="#f97316" />
          <Text className="text-xs text-gray-400 mt-3" style={{ fontFamily: "Quicksand-Medium" }}>
            Loading kitchen queue...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 140 }}
          renderItem={({ item }) => {
            const statusConfig = getStatusStyle(item.status);

            // Safe date parser to prevent Hermes crash on RangeError/Invalid Date
            const formatTime = (ts: any) => {
              if (!ts) return "Just now";
              const d = new Date(ts);
              return isNaN(d.getTime()) 
                ? "Just now" 
                : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            };

            return (
              <TouchableOpacity
                onPress={() => {
                  setSelectedOrder(item);
                  setShowDetailsModal(true);
                }}
                activeOpacity={0.8}
                className="bg-white rounded-3xl p-5 mb-4 shadow-md shadow-black/5 gap-3"
              >
                {/* ID and Status Banner */}
                <View className="flex-row justify-between items-center pb-2">
                  <View>
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                      ID: #{String(item.$id || "").slice(-6).toUpperCase()}
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
                      {formatTime(item.timestamp)} • {item.paymentMethod === "cod" ? "COD" : "Card"}
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${statusConfig.bg}`}>
                    <Text className={`text-[9px] font-bold uppercase tracking-wider ${statusConfig.text}`} style={{ fontFamily: "Quicksand-Bold" }}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Main Content (Deliver To) */}
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 mr-2">
                    <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                      Deliver To
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 mt-0.5" style={{ fontFamily: "Quicksand-Bold" }} numberOfLines={1}>
                      {item.userName || "Customer"}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                      Total Amount
                    </Text>
                    <Text className="text-base font-bold text-gray-900 mt-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                      ${(item.total || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Brief Items Summary */}
                <View className="bg-gray-50/50 rounded-2xl p-3 flex-row justify-between items-center">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs font-bold text-gray-700" style={{ fontFamily: "Quicksand-Bold" }} numberOfLines={1}>
                      {item.items?.map((food: any) => `${food.quantity}x ${food.name}`).join(", ")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center py-24 px-6 bg-white rounded-3xl mx-2 shadow-md shadow-black/5 mt-4">
              <View className="w-20 h-20 bg-orange-50 rounded-full items-center justify-center mb-5 shadow-sm shadow-orange-500/10">
                <Ionicons name="receipt-outline" size={38} color="#f97316" />
              </View>
              <Text className="text-lg font-bold text-gray-800 text-center" style={{ fontFamily: "Quicksand-Bold" }}>
                No Active Kitchen Orders
              </Text>
              <Text className="text-xs text-gray-400 mt-2 text-center max-w-[260px] leading-5" style={{ fontFamily: "Quicksand-Medium" }}>
                You have no active orders in your queue. When customers place orders, they will appear here instantly!
              </Text>
            </View>
          )}
        />
      )}

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
              const statusConfig = getStatusStyle(selectedOrder.status);
              const isProcessing = updatingId === selectedOrder.$id;
              
              const formatTime = (ts: any) => {
                if (!ts) return "Just now";
                const d = new Date(ts);
                return isNaN(d.getTime()) 
                  ? "Just now" 
                  : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              };

              return (
                <>
                  <View className="flex-row justify-between items-start mb-1">
                    <View className="flex-1 mr-2">
                      <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                        Order Details
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
                    <View className={`px-3 py-1 rounded-full ${statusConfig.bg}`}>
                      <Text className={`text-[9px] font-bold uppercase tracking-wider ${statusConfig.text}`} style={{ fontFamily: "Quicksand-Bold" }}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  <View className="h-[1px] bg-gray-100 my-4" />

                  <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
                    <View className="gap-5">
                      {/* Customer Details */}
                      <View className="gap-1">
                        <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                          Deliver To
                        </Text>
                        <Text className="text-sm font-bold text-gray-800 animate-fade-in" style={{ fontFamily: "Quicksand-Bold" }}>
                          {selectedOrder.userName || "Customer"}
                        </Text>
                        <Text className="text-xs text-gray-500 leading-normal" style={{ fontFamily: "Quicksand-Medium" }}>
                          {selectedOrder.address}
                        </Text>
                      </View>

                      {/* Designated Pickup Store */}
                      {(selectedOrder.pickupBranchName || selectedOrder.items?.[0]?.pickupBranchName) && (
                        <View className="gap-1 bg-gray-50/40 p-4 rounded-2xl border border-gray-100/50">
                          <Text className="text-[10px] text-orange-500 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                            Designated Pickup Outlet
                          </Text>
                          <Text className="text-xs font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                            {selectedOrder.pickupBranchName || selectedOrder.items?.[0]?.pickupBranchName}
                          </Text>
                          <Text className="text-[11px] text-gray-500 leading-normal mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
                            {selectedOrder.pickupBranchAddress || selectedOrder.items?.[0]?.pickupBranchAddress}
                          </Text>
                        </View>
                      )}

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
                                ${(food.price * food.quantity).toFixed(2)}
                              </Text>
                            </View>
                            {/* Nested customizations list */}
                            {food.customizations && food.customizations.length > 0 && (
                              <View className="pl-4 flex-row flex-wrap gap-1.5 mt-1">
                                {food.customizations.map((cus: any, idx: number) => (
                                  <View key={idx} className="bg-white border border-gray-100 px-2 py-0.5 rounded-lg">
                                    <Text className="text-[9px] text-gray-500 font-medium" style={{ fontFamily: "Quicksand-Medium" }}>
                                      + {cus.name} {cus.price > 0 ? `(+$${cus.price.toFixed(2)})` : ""}
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
                            Payment Confirmation
                          </Text>
                          <Text
                            className={`text-xs font-bold ${selectedOrder.paymentMethod === "cod" ? "text-amber-600" : "text-emerald-600"}`}
                            style={{ fontFamily: "Quicksand-Bold" }}
                          >
                            {selectedOrder.paymentMethod === "cod" ? "COD - Pay on Delivery" : "Paid Securely via Stripe"}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                            Total Price
                          </Text>
                          <Text className="text-lg font-bold text-gray-900" style={{ fontFamily: "Quicksand-Bold" }}>
                            ${(selectedOrder.total || 0).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Kitchen Status Controls */}
                  {selectedOrder.status === "pending" && (
                    <TouchableOpacity
                      onPress={async () => {
                        await updateOrderStatus(selectedOrder.$id, "preparing");
                        setShowDetailsModal(false);
                        setSelectedOrder(null);
                      }}
                      className="bg-orange-500 h-12 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm shadow-orange-500/10"
                      activeOpacity={0.8}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="flame" size={16} color="#fff" />
                          <Text className="text-white text-xs font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                            Accept & Start Cooking
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {selectedOrder.status === "preparing" && (
                    <TouchableOpacity
                      onPress={async () => {
                        await updateOrderStatus(selectedOrder.$id, "ready");
                        setShowDetailsModal(false);
                        setSelectedOrder(null);
                      }}
                      className="bg-amber-500 h-12 rounded-2xl items-center justify-center flex-row gap-2 shadow-sm shadow-amber-500/10"
                      activeOpacity={0.8}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={16} color="#fff" />
                          <Text className="text-white text-xs font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                            Mark Ready for Pickup
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {selectedOrder.status === "ready" && (
                    <View className="bg-amber-50/50 rounded-2xl p-4 flex-row items-center justify-center gap-2">
                      <Ionicons name="time" size={16} color="#d97706" className="animate-pulse" />
                      <Text className="text-amber-700 text-xs font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                        Waiting for Rider Assignment...
                      </Text>
                    </View>
                  )}

                  {selectedOrder.status === "picked_up" && (
                    <View className="bg-blue-50/50 rounded-2xl p-4 flex-row items-center justify-center gap-2">
                      <Ionicons name="bicycle" size={16} color="#2563eb" />
                      <Text className="text-blue-700 text-xs font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                        Out for Delivery with {selectedOrder.deliveryBoyName || "Rider"}
                      </Text>
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
