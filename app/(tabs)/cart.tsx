import CartItem from "@/components/CartItem";
import CustomButton from "@/components/CustomButton";
import { images } from "@/constants";
import { PaymentInfoStripeProps } from "@/type";
import cn from "clsx";
import { useRouter } from "expo-router";
import React, { useContext, useState, useEffect } from "react";
import { FlatList, Text, View, Alert, Image, ScrollView, TouchableOpacity, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../store/store";
import CartContext from "../lib/services/cart_services/CartContext";
import { startCheckout } from "../../store/slices/orderSlice";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { Ionicons } from "@expo/vector-icons";
import { Query } from "react-native-appwrite";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_USERS_COLLECTION_ID,
} from "../lib/services/auth_services/appwrite";
import { formatPrice } from "../lib/currency";

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
  const { user, appwrite } = useContext(AppwriteContext);
  const { address, flatHouseNo, latitude, longitude, countryCode } = useSelector(
    (state: RootState) => state.location,
  );
  const router = useRouter();
  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();
  const deliveryAddress = [flatHouseNo, address].filter(Boolean).join(", ");

  // Branch Selector states for Cart Screen (like Zomato)
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);
  const [tempSelectedBranch, setTempSelectedBranch] = useState<any | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [fetchingBranches, setFetchingBranches] = useState(false);

  // Fetch branches dynamically based on items currently in the cart
  useEffect(() => {
    if (items.length === 0) {
      setBranches([]);
      setSelectedBranch(null);
      return;
    }

    const resolveAndFetchBranches = async () => {
      setFetchingBranches(true);
      try {
        const firstItem = items[0];
        let targetUserId: string | null = null;

        // Fetch menu item doc to get userId if available
        const menuItemDoc = await appwrite.getMenuItem(firstItem.id);
        if (menuItemDoc) {
          targetUserId = (menuItemDoc as any).userId;
        }

        if (!targetUserId) {
          // Seeded items fallback user search: query users collection for managers matching brand keyword
          const brandQuery = (firstItem.name || "").split(" ")[0].replace(/['’]s/g, "").toLowerCase().trim();
          const managersRes = await appwrite.database.listRows({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: APPWRITE_USERS_COLLECTION_ID,
            queries: [Query.equal("role", "manager")],
          });
          if (managersRes && managersRes.rows.length > 0) {
            const matched = managersRes.rows.find((mgr: any) => {
              const mgrName = (mgr.name || "").toLowerCase();
              return mgrName.includes(brandQuery) || brandQuery.includes(mgrName);
            });
            if (matched) {
              targetUserId = matched.$id;
            } else {
              targetUserId = managersRes.rows[0].$id; // Fallback to first manager
            }
          }
        }

        if (targetUserId) {
          const userBranches = await appwrite.getUserAddresses(targetUserId);
          if (userBranches && userBranches.length > 0) {
            setBranches(userBranches);
            // Silently auto-select if exactly 1 branch
            if (userBranches.length === 1) {
              setSelectedBranch(userBranches[0]);
            } else if (userBranches.length > 1) {
              // Reset if no longer matches
              if (!selectedBranch || !userBranches.some(b => b.$id === selectedBranch.$id)) {
                setSelectedBranch(null); // Force selection
              }
            }
          } else {
            setBranches([]);
            setSelectedBranch(null);
          }
        }
      } catch (err) {
        console.log("Error loading branches for cart items:", err);
      } finally {
        setFetchingBranches(false);
      }
    };

    resolveAndFetchBranches();
  }, [items.length]);

  const handleCheckout = () => {
    if (!address) {
      Alert.alert(
        "Location Required",
        "Please select a delivery location before placing your order.",
        [
          { text: "Select Location", onPress: () => router.push("/(maps)/select-location" as any) },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    if (branches.length > 1 && !selectedBranch) {
      Alert.alert(
        "Branch Required",
        "Please select a store pickup branch outlet on this screen before placing your order.",
        [{ text: "OK" }]
      );
      return;
    }

    const firstItem = items[0];
    dispatch(startCheckout({
      items,
      total: totalPrice + 5 - 0.5,
      paymentMethod: "Card",
      address: deliveryAddress,
      userId: user?.$id || "guest",
      userName: user?.name || "Guest User",
      status: "pending",
      pickupBranchId: selectedBranch?.$id || firstItem?.pickupBranchId,
      pickupBranchName: selectedBranch?.branchName || firstItem?.pickupBranchName,
      pickupBranchAddress: selectedBranch 
        ? (selectedBranch.flatHouseNo ? selectedBranch.flatHouseNo + ", " : "") + selectedBranch.address
        : firstItem?.pickupBranchAddress,
      pickupBranchLat: selectedBranch?.latitude || firstItem?.pickupBranchLat,
      pickupBranchLng: selectedBranch?.longitude || firstItem?.pickupBranchLng,
      pickupBranchLong: selectedBranch?.longitude || firstItem?.pickupBranchLng || firstItem?.pickupBranchLong,
      userLat: latitude ? String(latitude) : undefined,
      userLong: longitude ? String(longitude) : undefined,
    }));

    router.push("/(payment)/checkout" as any);
  };

  return (
    <SafeAreaView className="bg-white h-full">
      <FlatList
        data={items}
        renderItem={({ item }) => <CartItem item={item} />}
        keyExtractor={(item) => {
          const customizationsKey = item.customizations
            ?.map((c) => c.id)
            .sort()
            .join("-") || "none";
          return `${item.id}-${customizationsKey}`;
        }}
        contentContainerClassName={cn(
          "pb-28 px-5 pt-5",
          totalItems === 0 && "flex-grow",
        )}
        ListHeaderComponent={() =>
          totalItems > 0 && (
            <View className="gap-5 pt-5 pb-5">
              {/* Delivery Location row */}
              <View className="flex-between flex-row w-full">
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
                  onPress={() => router.push("/(maps)/select-location" as any)}
                />
              </View>

              {/* Store Pickup Branch Card (Zomato-style) */}
              {branches.length > 1 && (
                <View className="bg-white p-4 rounded-3xl shadow-md shadow-black/5 mt-2">
                  <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center">
                      <Text className="text-base mr-2">🏪</Text>
                      <Text className="text-[15px] font-bold text-gray-900" style={{ fontFamily: "Quicksand-Bold" }}>
                        Pick Up Branch Outlet
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => {
                        setTempSelectedBranch(selectedBranch);
                        setShowBranchModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text className="text-sm font-bold text-orange-500" style={{ fontFamily: "Quicksand-Bold" }}>
                        {selectedBranch ? "Change" : "Select"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row items-start gap-3">
                    <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center">
                      <Ionicons name="restaurant" size={20} color="#f97316" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-bold text-gray-900" style={{ fontFamily: "Quicksand-Bold" }}>
                        {selectedBranch ? selectedBranch.branchName : "No pickup branch selected"}
                      </Text>
                      <Text className="text-[13.5px] text-gray-600 mt-1 leading-normal" style={{ fontFamily: "Quicksand-Medium" }}>
                        {selectedBranch 
                          ? (selectedBranch.flatHouseNo ? selectedBranch.flatHouseNo + ", " : "") + selectedBranch.address 
                          : "Please select the outlet for pickup"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
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
                  value={formatPrice(totalPrice, countryCode)}
                />
                <PaymentInfoStripe label={`Delivery Fee`} value={formatPrice(5, countryCode)} />
                <PaymentInfoStripe
                  label={`Discount`}
                  value={`- ${formatPrice(0.5, countryCode)}`}
                  valueStyle="!text-success"
                />
                <View className="border-t border-gray-300 my-2" />
                <PaymentInfoStripe
                  label={`Total`}
                  value={formatPrice(totalPrice + 5 - 0.5, countryCode)}
                  labelStyle="base-bold !text-dark-100"
                  valueStyle="base-bold !text-dark-100 !text-right"
                />
              </View>
              <CustomButton title="Order Now" onPress={handleCheckout} />
            </View>
          )
        }
      />
      {/* 100% Borderless Premium Bottom Sheet Modal (Zomato-style) */}
      <Modal
        visible={showBranchModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBranchModal(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          {/* Dismiss Overlay */}
          <TouchableOpacity 
            className="absolute inset-0"
            activeOpacity={1}
            onPress={() => setShowBranchModal(false)}
          />

          {/* Bottom Sheet Body */}
          <View 
            className="bg-white rounded-t-[36px] p-6 pb-8" 
            style={{ 
              maxHeight: "80%",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 20,
            }}
          >
            {/* Sheet Handle */}
            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mx-auto mb-5" />

            {/* Header with Close Button */}
            <View className="flex-row justify-between items-start mb-1">
              <View className="flex-1 mr-2">
                <Text className="text-[22px] font-bold text-gray-900" style={{ fontFamily: "Quicksand-Bold" }}>
                  Select Pickup Store
                </Text>
                <Text className="text-sm text-gray-500 mt-1" style={{ fontFamily: "Quicksand-Medium" }}>
                  Select which branch you'd like to pick up your order from
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowBranchModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View className="h-[1px] bg-gray-100 my-4" />

            <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
              {branches.map((branch) => {
                const isSelected = tempSelectedBranch?.$id === branch.$id;
                return (
                  <TouchableOpacity
                    key={branch.$id}
                    className={`rounded-2xl p-4 mb-3 flex-row items-center justify-between ${
                      isSelected ? "bg-[#FFF5EC]" : "bg-white"
                    }`}
                    onPress={() => setTempSelectedBranch(branch)}
                    activeOpacity={0.9}
                    style={
                      isSelected 
                        ? undefined // Complete shadow suppression for selected card to prevent dark bleed
                        : {
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.03,
                            shadowRadius: 6,
                            elevation: 1,
                          }
                    }
                  >
                    <View className="flex-row items-center flex-1 mr-3">
                      {/* Badge Icon */}
                      <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                        isSelected ? "bg-orange-500" : "bg-gray-50 border border-gray-100/50"
                      }`}>
                        <Ionicons 
                          name="restaurant" 
                          size={18} 
                          color={isSelected ? "#fff" : "#9CA3AF"} 
                        />
                      </View>
                      
                      {/* Texts */}
                      <View className="flex-1">
                        <Text 
                          className={`text-base font-bold ${isSelected ? "text-orange-950" : "text-gray-900"}`}
                          style={{ fontFamily: "Quicksand-Bold" }}
                        >
                          {branch.branchName}
                        </Text>
                        <Text 
                          className={`text-[13.5px] mt-1 leading-normal ${isSelected ? "text-orange-900/80" : "text-gray-600"}`}
                          style={{ fontFamily: "Quicksand-Medium" }}
                        >
                          {(branch.flatHouseNo ? branch.flatHouseNo + ", " : "") + branch.address}
                        </Text>
                      </View>
                    </View>

                    {/* Premium Radio Selector Indicator */}
                    {isSelected ? (
                      <View className="w-5.5 h-5.5 rounded-full bg-orange-500 items-center justify-center mr-1">
                        <Ionicons name="checkmark" size={13} color="white" />
                      </View>
                    ) : (
                      <View className="w-5.5 h-5.5 rounded-full border-2 border-gray-200 items-center justify-center mr-1" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Premium Dynamic Confirm Action Button */}
            <TouchableOpacity
              className={`py-4 rounded-2xl items-center justify-center ${
                tempSelectedBranch ? "bg-orange-500" : "bg-gray-200"
              }`}
              onPress={() => {
                if (tempSelectedBranch) {
                  setSelectedBranch(tempSelectedBranch);
                  setShowBranchModal(false);
                } else {
                  Alert.alert("Selection Required", "Please choose a pickup branch first.");
                }
              }}
              activeOpacity={tempSelectedBranch ? 0.9 : 1.0}
              disabled={!tempSelectedBranch}
              style={tempSelectedBranch ? {
                shadowColor: "#f97316",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
              } : undefined}
            >
              <Text 
                className={`text-sm font-bold ${tempSelectedBranch ? "text-white" : "text-gray-400"}`} 
                style={{ fontFamily: "Quicksand-Bold" }}
              >
                Confirm Pickup Branch
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Cart;
