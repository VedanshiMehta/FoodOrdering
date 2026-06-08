import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import useAppwrite from "../lib/services/appwrite_data_services/useApprwriteData";
import { DeliveryContext } from "./_layout";
import { useSelector } from "react-redux";
import { RootState } from "../../store/store";
import { formatPrice } from "../lib/currency";

// Reusable custom profile detail row styled with Tailwind CSS
interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
  onPress?: () => void;
  showChevron?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({
  icon,
  label,
  value,
  isLast = false,
  onPress,
  showChevron = false,
}) => {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      className="flex-row items-center py-4"
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View className="w-10 h-10 rounded-2xl bg-orange-50 items-center justify-center mr-4">
        <Ionicons name={icon} size={18} color="#f97316" />
      </View>
      <View className="flex-1">
        <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
          {label}
        </Text>
        <Text className="text-sm font-bold text-gray-800 mt-0.5" style={{ fontFamily: "Quicksand-Bold" }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      )}
    </Container>
  );
};

export default function RiderProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { appwrite, setIsLoggedIn, setUser, user } = useContext(AppwriteContext);
  const { setSelectedOrderForMap, setCustomerCoords, setMapOriginTab } = useContext(DeliveryContext);
  const countryCode = useSelector((state: RootState) => state.location.countryCode);

  // Fetch all orders dynamically to compute statistics and history
  const { data: ordersData, refetch: refetchOrders, loading: ordersLoading } = useAppwrite({
    fn: () => appwrite.getOrders(),
  });

  // Automatically refresh stats when the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      refetchOrders();
    }, [])
  );

  const [deliveredHistory, setDeliveredHistory] = useState<any[]>([]);
  const [pickupHistory, setPickupHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({
    completedCount: 0,
    activeCount: 0,
    earnings: 0,
  });

  // Modal display states
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [pickupModalVisible, setPickupModalVisible] = useState(false);

  useEffect(() => {
    if (ordersData) {
      // Filter completed/delivered orders for this rider
      const deliveredList = ordersData.filter((o) => o.status === "delivered" && (user?.$id ? o.deliveryBoyId === user?.$id : true));
      deliveredList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setDeliveredHistory(deliveredList);

      // Filter active picked up orders for this rider
      const activeList = ordersData.filter((o) => o.status === "picked_up" && (user?.$id ? o.deliveryBoyId === user?.$id : true));
      activeList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const combinedPickups = [...activeList, ...deliveredList];
      combinedPickups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPickupHistory(combinedPickups);

      // Compute simple stats: total pickups = active + completed
      setStats({
        completedCount: deliveredList.length,
        activeCount: activeList.length + deliveredList.length,
        earnings: deliveredList.length * 5.0,
      });
    }
  }, [ordersData, user?.$id]);

  const handleLogout = async () => {
    try {
      await appwrite.logout();
      setIsLoggedIn(false);
      setUser(null);
    } catch (err) {
      Alert.alert("Logout Error", "Failed to sign out safely.");
    }
  };

  const handleTrackOrderFromModal = async (order: any) => {
    setActiveModalVisible(false);
    setSelectedOrderForMap(order);
    
    try {
      const loc = await appwrite.getUserLocation(order.userId);
      if (loc && loc.latitude && loc.longitude) {
        setCustomerCoords({
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      } else {
        setCustomerCoords(null);
      }
    } catch (err) {
      console.log("Error fetching customer location coordinates:", err);
      setCustomerCoords(null);
    }

    setMapOriginTab("active");
    router.push({ pathname: "/(delivery)/map" } as any);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
        " at " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={ordersLoading}
            onRefresh={refetchOrders}
            colors={["#f97316"]}
            tintColor="#f97316"
          />
        }
      >
        <View className="px-5 pt-4 gap-6">
          {/* Page Header (Clean verified badge aligned on the right, refresh button added) */}
          <View className="flex-row justify-between items-center mt-1">
            <Text className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
              Profile
            </Text>
            <View className="flex-row items-center gap-3">

              <View className="px-3.5 py-1.5 bg-orange-50 rounded-2xl flex-row items-center gap-1 shadow-sm shadow-orange-500/5">
                <Ionicons name="shield-checkmark" size={13} color="#f97316" />
                <Text className="text-[10px] font-bold text-orange-600 uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                  Verified Rider
                </Text>
              </View>
            </View>
          </View>

          {/* Profile Info Details Header Card */}
          <View className="bg-white rounded-[24px] p-5 shadow-sm shadow-black/5 flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-orange-100 items-center justify-center border-2 border-orange-200 relative">
              <Text className="text-xl font-bold text-orange-600" style={{ fontFamily: "Quicksand-Bold" }}>
                {user?.name ? user.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) : "R"}
              </Text>
              <View className="absolute bottom-0 right-0 bg-orange-500 w-5 h-5 rounded-full border border-white items-center justify-center">
                <Ionicons name="checkmark-sharp" size={10} color="#fff" />
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                {user?.name || "Delivery Rider"}
              </Text>
              <Text className="text-xs text-gray-400 font-semibold" style={{ fontFamily: "Quicksand-Medium" }}>
                {user?.email || "rider@fooddelivery.com"}
              </Text>
              <View className="flex-row items-center mt-1.5 gap-1">
                <View className="w-2 h-2 rounded-full bg-green-500" />
                <Text className="text-[10px] font-bold text-green-600 uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                  Active Duty
                </Text>
              </View>
            </View>
          </View>

          {/* Information Rows List Container Card */}
          <View className="bg-white rounded-[24px] px-5 py-2 shadow-sm shadow-black/5">
            <InfoRow
              icon="person-outline"
              label="Full Name"
              value={user?.name || "Rider Partner"}
            />
            <InfoRow
              icon="mail-outline"
              label="Registered Email"
              value={user?.email || "rider@delivery.com"}
            />
            <InfoRow
              icon="shield-outline"
              label="Portal Role Status"
              value="Verified Delivery Courier"
            />
            <InfoRow
              icon="navigate-outline"
              label="Assigned Region"
              value="Valsad, Gujarat"
              isLast={true}
            />
          </View>

          {/* Rider Statistics Horizontal Grid */}
          <View className="flex-row gap-3">
            {/* Pickup History Stat Card (Clickable to open pickup history page) */}
            <TouchableOpacity
              className="flex-1 bg-white rounded-[20px] p-5 shadow-sm shadow-black/5 items-center justify-center gap-1.5"
              onPress={() => setPickupModalVisible(true)}
              activeOpacity={0.7}
            >
              <View className="w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center mb-1 shadow-sm shadow-blue-500/5">
                <Ionicons name="bicycle" size={20} color="#3b82f6" />
              </View>
              <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-wider text-center" style={{ fontFamily: "Quicksand-Bold" }}>
                Pickups
              </Text>
              <Text className="text-xl font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                {stats.activeCount}
              </Text>
            </TouchableOpacity>

            {/* Delivered Stat Card (Clickable to open delivery history page) */}
            <TouchableOpacity
              className="flex-1 bg-white rounded-[20px] p-5 shadow-sm shadow-black/5 items-center justify-center gap-1.5"
              onPress={() => setHistoryModalVisible(true)}
              activeOpacity={0.7}
            >
              <View className="w-10 h-10 rounded-2xl bg-green-50 items-center justify-center mb-1 shadow-sm shadow-green-500/5">
                <Ionicons name="checkmark-done-circle-outline" size={22} color="#22c55e" />
              </View>
              <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-wider text-center" style={{ fontFamily: "Quicksand-Bold" }}>
                Delivered
              </Text>
              <Text className="text-xl font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                {stats.completedCount}
              </Text>
            </TouchableOpacity>

            {/* Earnings Stat Card */}
            <View className="flex-1 bg-white rounded-[20px] p-5 shadow-sm shadow-black/5 items-center justify-center gap-1.5">
              <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center mb-1 shadow-sm shadow-emerald-500/5">
                <Ionicons name="cash-outline" size={20} color="#059669" />
              </View>
              <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-wider text-center" style={{ fontFamily: "Quicksand-Bold" }}>
                Earnings
              </Text>
              <Text className="text-xl font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                {formatPrice(stats.earnings, countryCode)}
              </Text>
            </View>
          </View>

          {/* Logout Action Button (Aligned to match customer details, properly spaced) */}
          <TouchableOpacity
            className="bg-red-50 border border-red-200 py-4 rounded-[16px] flex-row items-center justify-center gap-2 mt-6 shadow-sm shadow-red-500/5"
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text className="text-red-500 font-bold text-[16px]" style={{ fontFamily: "Quicksand-Bold" }}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 1. Completed Deliveries Full Screen Page Screen */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
          {/* Custom Navigation Header */}
          <View style={{ paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) }} className="flex-row items-center justify-between px-5 pb-4 bg-transparent">
            <TouchableOpacity
              onPress={() => setHistoryModalVisible(false)}
              activeOpacity={0.7}
              className="w-[42px] h-[42px] rounded-full border border-gray-100 bg-white items-center justify-center"
            >
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
              Delivery History ({deliveredHistory.length})
            </Text>
            <View className="w-6" />
          </View>

          {/* List Content */}
          {deliveredHistory.length === 0 ? (
            <View className="flex-1 items-center justify-center p-5 gap-2 bg-gray-50">
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text className="text-sm font-bold text-gray-500 mt-2" style={{ fontFamily: "Quicksand-Bold" }}>
                No completed deliveries.
              </Text>
              <Text className="text-xs text-gray-400 text-center" style={{ fontFamily: "Quicksand-Medium" }}>
                Orders you deliver successfully will be listed here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={deliveredHistory}
              keyExtractor={(item) => item.$id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({ item }) => (
                <View className="bg-white rounded-[24px] p-5 shadow-sm shadow-gray-200/40 mb-4 border border-gray-100/50">
                  {/* Header row */}
                  <View className="flex-row justify-between items-center mb-3">
                    <View>
                      <Text className="text-xs font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                        ID: #{item.$id.slice(-6).toUpperCase()}
                      </Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
                        {formatDate(item.timestamp)}
                      </Text>
                    </View>
                    <View className="px-2.5 py-1 bg-green-50 rounded-full flex-row items-center gap-1">
                      <Ionicons name="checkmark-circle" size={10} color="#22c55e" />
                      <Text className="text-[9px] font-bold text-green-600 uppercase" style={{ fontFamily: "Quicksand-Bold" }}>
                        Delivered
                      </Text>
                    </View>
                  </View>

                  {/* Breakdown of items */}
                  <View className="border-t border-b border-gray-50 py-3 my-2 gap-2">
                    {item.items && Array.isArray(item.items) && item.items.map((cartItem: any, idx: number) => (
                      <View key={idx} className="flex-row justify-between items-center">
                        <Text className="text-xs text-gray-550 font-bold" style={{ fontFamily: "Quicksand-Medium" }}>
                          {cartItem.quantity}x <Text className="text-gray-700">{cartItem.name}</Text>
                        </Text>
                        <Text className="text-xs text-gray-700 font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                          {formatPrice(cartItem.price * cartItem.quantity, countryCode)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Footer Address & Price */}
                  <View className="flex-row justify-between items-center mt-1">
                    <View className="flex-row items-center gap-1.5 flex-1 mr-4">
                      <Ionicons name="location-outline" size={14} color="#f97316" />
                      <Text className="text-[10px] text-gray-500 flex-1" numberOfLines={1} style={{ fontFamily: "Quicksand-Medium" }}>
                        {item.address}
                      </Text>
                    </View>
                    <Text className="text-xs font-bold text-orange-500" style={{ fontFamily: "Quicksand-Bold" }}>
                      Total: {formatPrice(item.total, countryCode)}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* 2. Pickup History Full Screen Page Screen */}
      <Modal
        visible={pickupModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPickupModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
          {/* Custom Navigation Header */}
          <View style={{ paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) }} className="flex-row items-center justify-between px-5 pb-4 bg-transparent">
            <TouchableOpacity
              onPress={() => setPickupModalVisible(false)}
              activeOpacity={0.7}
              className="w-[42px] h-[42px] rounded-full border border-gray-100 bg-white items-center justify-center"
            >
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text className="text-base font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
              Pickup History ({pickupHistory.length})
            </Text>
            <View className="w-6" />
          </View>

          {/* List Content */}
          {pickupHistory.length === 0 ? (
            <View className="flex-1 items-center justify-center p-5 gap-2 bg-gray-50">
              <Ionicons name="bicycle" size={48} color="#d1d5db" />
              <Text className="text-sm font-bold text-gray-500 mt-2" style={{ fontFamily: "Quicksand-Bold" }}>
                No pickups found.
              </Text>
              <Text className="text-xs text-gray-400 text-center" style={{ fontFamily: "Quicksand-Medium" }}>
                Orders you have picked up will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={pickupHistory}
              keyExtractor={(item) => item.$id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({ item }) => (
                <View className="bg-white rounded-[24px] p-5 shadow-sm shadow-gray-200/40 mb-4 border border-gray-100/50">
                  {/* Header row */}
                  <View className="flex-row justify-between items-center mb-3">
                    <View>
                      <Text className="text-xs font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                        ID: #{item.$id.slice(-6).toUpperCase()}
                      </Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
                        {formatDate(item.timestamp)}
                      </Text>
                    </View>
                    <View className={`px-2.5 py-1 rounded-full flex-row items-center gap-1 ${item.status === 'delivered' ? 'bg-green-50' : 'bg-orange-50'}`}>
                      <Ionicons name={item.status === 'delivered' ? 'checkmark-circle' : 'bicycle'} size={10} color={item.status === 'delivered' ? '#10b981' : '#f97316'} />
                      <Text className={`text-[9px] font-bold uppercase ${item.status === 'delivered' ? 'text-green-600' : 'text-orange-600'}`} style={{ fontFamily: "Quicksand-Bold" }}>
                        {item.status === 'delivered' ? 'Delivered' : 'In Transit'}
                      </Text>
                    </View>
                  </View>

                  {/* Breakdown of items */}
                  <View className="border-t border-b border-gray-50 py-3 my-2 gap-2">
                    {item.items && Array.isArray(item.items) && item.items.map((cartItem: any, idx: number) => (
                      <View key={idx} className="flex-row justify-between items-center">
                        <Text className="text-xs text-gray-550 font-bold" style={{ fontFamily: "Quicksand-Medium" }}>
                          {cartItem.quantity}x <Text className="text-gray-700">{cartItem.name}</Text>
                        </Text>
                        <Text className="text-xs text-gray-700 font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                          {formatPrice(cartItem.price * cartItem.quantity, countryCode)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Footer Address & Price */}
                  <View className="flex-row justify-between items-start mt-1 mb-4 gap-2">
                    <View className="flex-col gap-1.5 flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons name="restaurant" size={12} color="#4b5563" />
                        <Text className="text-[11px] text-gray-700 font-bold" numberOfLines={1} style={{ fontFamily: "Quicksand-Bold" }}>
                          {item.pickupBranchName || "Hotel Location"}
                        </Text>
                      </View>
                      <View className="flex-row items-start gap-1.5">
                        <Ionicons name="location-outline" size={14} color="#f97316" />
                        <Text className="text-[10px] text-gray-500 flex-1" numberOfLines={2} style={{ fontFamily: "Quicksand-Medium" }}>
                          {item.pickupBranchAddress || "No address provided"}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs font-bold text-orange-500 mt-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                      Total: {formatPrice(item.total, countryCode)}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
