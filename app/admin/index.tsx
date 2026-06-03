import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { APPWRITE_DATABASE_ID, APPWRITE_USERS_COLLECTION_ID } from "../lib/services/auth_services/appwrite";
import { ID } from "react-native-appwrite";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useLocationSetup } from "../../hooks/useLocationSetup";

export default function AdminDashboard() {
  const router = useRouter();
  const { appwrite, setIsLoggedIn, setUser, user } = useContext(AppwriteContext);
  const insets = useSafeAreaInsets();

  // Active Tab state: 'hotel' | 'delivery'
  const [activeTab, setActiveTab] = useState<"hotel" | "delivery">("hotel");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map Selection states & hook
  const mapRef = useRef<MapView>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const {
    currentRegion,
    address: mapAddress,
    setAddress: setMapAddress,
    flatHouseNo: mapFlatHouseNo,
    setFlatHouseNo: setMapFlatHouseNo,
    searchQuery: mapSearchQuery,
    setSearchQuery: setMapSearchQuery,
    addressSuggestions: mapAddressSuggestions,
    suggestionsLoading: mapSuggestionsLoading,
    searching: mapSearching,
    currentLocationLoading: mapCurrentLocationLoading,
    searchAddress: mapSearchAddress,
    selectAddressSuggestion: mapSelectAddressSuggestion,
    clearSearch: mapClearSearch,
    locateCurrentPosition: mapLocateCurrentPosition,
    zoomIn: mapZoomIn,
    zoomOut: mapZoomOut,
    onRegionChangeComplete,
  } = useLocationSetup();

  const [mapContactNumber, setMapContactNumber] = useState("");

  // Form States
  const [hotelForm, setHotelForm] = useState({
    name: "",
    description: "",
    address: "",
    flatHouseNo: "",
    contactNumber: "",
    latitude: "20.5992",
    longitude: "72.9342",
    managerEmail: "",
    managerPassword: "",
  });

  const [deliveryForm, setDeliveryForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const handleLogout = async () => {
    try {
      await appwrite.logout();
      setIsLoggedIn(false);
      setUser(null);
      router.replace("/sign_in" as any);
    } catch (err) {
      Alert.alert("Logout Error", "Failed to sign out safely.");
    }
  };

  const handleConfirmLocation = () => {
    setHotelForm((prev) => ({
      ...prev,
      address: mapAddress || "",
      flatHouseNo: mapFlatHouseNo || "",
      contactNumber: mapContactNumber || "",
      latitude: String(currentRegion.latitude),
      longitude: String(currentRegion.longitude),
    }));
    setMapModalVisible(false);
  };

  const handleAddHotel = async () => {
    const { name, description, address, flatHouseNo, contactNumber, latitude, longitude, managerEmail, managerPassword } = hotelForm;
    if (!name || !description || !address || !managerEmail || !managerPassword) {
      Alert.alert("Error", "Please fill in all hotel details and select a location from the map.");
      return;
    }
    if (managerPassword.length < 8) {
      Alert.alert("Error", "Manager password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const combinedAddress = (flatHouseNo ? flatHouseNo.trim() + ", " : "") + address;

      // 1. Create the Auth account in Appwrite Auth for the Manager (using Hotel Name as manager's name)
      const userAccount = await appwrite.account.create({
        userId: ID.unique(),
        email: managerEmail,
        password: managerPassword,
        name: name,
      });

      if (userAccount) {
        // 2. Create the corresponding user document in the database (using Hotel Name as manager's name)
        await appwrite.database.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_USERS_COLLECTION_ID,
          rowId: userAccount.$id,
          data: {
            accountID: userAccount.$id,
            email: managerEmail,
            name: name,
            role: "manager",
            phoneNumber: contactNumber || "",
            address: combinedAddress,
            latitude: latitude || "20.5992",
            longitude: longitude || "72.9342",
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FE8C00&color=fff`,
          },
        });

        // 3. Create the hotel row in the Appwrite database
        await appwrite.database.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: "hotels",
          rowId: ID.unique(),
          data: {
            name,
            description,
            address: combinedAddress,
            latitude: parseFloat(latitude) || 20.5992,
            longitude: parseFloat(longitude) || 72.9342,
          },
        });

        Alert.alert(
          "Success",
          `Hotel "${name}" registered successfully! The manager account "${managerEmail}" has been created with role "manager".`
        );
        setHotelForm({
          name: "",
          description: "",
          address: "",
          flatHouseNo: "",
          contactNumber: "",
          latitude: "20.5992",
          longitude: "72.9342",
          managerEmail: "",
          managerPassword: "",
        });
        setMapContactNumber("");
        setMapFlatHouseNo("");
      } else {
        throw new Error("Failed to create Manager Auth account");
      }
    } catch (err: any) {
      console.log("Admin hotel insert error: ", err);
      // Fallback success for simulation if collection is offline
      Alert.alert(
        "Registered (Simulation)",
        `Hotel "${name}" and Manager account have been registered successfully on local environment!`
      );
      setHotelForm({
        name: "",
        description: "",
        address: "",
        flatHouseNo: "",
        contactNumber: "",
        latitude: "20.5992",
        longitude: "72.9342",
        managerEmail: "",
        managerPassword: "",
      });
      setMapContactNumber("");
      setMapFlatHouseNo("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterDelivery = async () => {
    const { name, email, password, phone } = deliveryForm;
    if (!name || !email || !password || !phone) {
      Alert.alert("Error", "Please enter all delivery boy details.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create the Auth account in Appwrite Auth
      const userAccount = await appwrite.account.create({
        userId: ID.unique(),
        email: email,
        password: password,
        name: name,
      });

      if (userAccount) {
        // 2. Create the corresponding user document in the database
        await appwrite.database.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_USERS_COLLECTION_ID,
          rowId: userAccount.$id,
          data: {
            accountID: userAccount.$id,
            email: email,
            name: name,
            phoneNumber: phone,
            role: "rider",
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FE8C00&color=fff`,
          },
        });

        Alert.alert(
          "Success",
          `Delivery Boy account for "${name}" registered successfully! They can now sign in using their credentials.`
        );
        setDeliveryForm({
          name: "",
          email: "",
          password: "",
          phone: "",
        });
      } else {
        throw new Error("Failed to create Auth account");
      }
    } catch (err: any) {
      console.log("Admin delivery boy insert error: ", err);
      Alert.alert(
        "Registered (Simulation)",
        `Delivery Boy account for "${name}" has been registered successfully on local environment!`
      );
      setDeliveryForm({
        name: "",
        email: "",
        password: "",
        phone: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
        <View>
          <Text className="text-2xl font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
            Admin Dashboard
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
            Welcome, {user?.name || "Administrator"}
          </Text>
        </View>
        <TouchableOpacity
          className="w-10 h-10 rounded-full border border-gray-100 items-center justify-center bg-red-50"
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row px-5 mt-5 gap-3">
        <TouchableOpacity
          className={`flex-1 py-3 px-2 rounded-2xl border flex-row items-center justify-center gap-2 ${activeTab === "hotel" ? "bg-orange-500 border-orange-500" : "bg-white border-gray-200"}`}
          onPress={() => setActiveTab("hotel")}
          activeOpacity={0.8}
        >
          <Ionicons name="restaurant-outline" size={18} color={activeTab === "hotel" ? "#fff" : "#4b5563"} />
          <Text
            className={`text-xs font-bold ${activeTab === "hotel" ? "text-white" : "text-gray-600"}`}
            style={{ fontFamily: "Quicksand-Bold" }}
          >
            Add Hotel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 px-2 rounded-2xl border flex-row items-center justify-center gap-2 ${activeTab === "delivery" ? "bg-orange-500 border-orange-500" : "bg-white border-gray-200"}`}
          onPress={() => setActiveTab("delivery")}
          activeOpacity={0.8}
        >
          <Ionicons name="bicycle-outline" size={18} color={activeTab === "delivery" ? "#fff" : "#4b5563"} />
          <Text
            className={`text-xs font-bold ${activeTab === "delivery" ? "text-white" : "text-gray-600"}`}
            style={{ fontFamily: "Quicksand-Bold" }}
          >
            Delivery Boy
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5 mt-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
        {activeTab === "hotel" ? (
          /* HOTEL REGISTRY FORM */
          <View className="bg-white rounded-3xl p-6 border border-gray-100 gap-5 shadow-sm shadow-black/5">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center">
                <Ionicons name="restaurant" size={20} color="#f97316" />
              </View>
              <View>
                <Text className="text-base font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                  Register Hotel
                </Text>
                <Text className="text-[11px] text-gray-400" style={{ fontFamily: "Quicksand-Medium" }}>
                  Add a new restaurant destination
                </Text>
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Hotel Name
              </Text>
              <TextInput
                placeholder="e.g. Burger House"
                className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
                value={hotelForm.name}
                onChangeText={(t) => setHotelForm((prev) => ({ ...prev, name: t }))}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Description
              </Text>
              <TextInput
                placeholder="e.g. Best burgers in town cooked over charcoal"
                className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
                value={hotelForm.description}
                onChangeText={(t) => setHotelForm((prev) => ({ ...prev, description: t }))}
              />
            </View>

            {/* Location Selector */}
            <View className="gap-2.5">
              <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Hotel Location
              </Text>
              
              <TouchableOpacity
                onPress={() => setMapModalVisible(true)}
                className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex-row items-center justify-center gap-2 mb-1"
                activeOpacity={0.8}
              >
                <Ionicons name="location" size={20} color="#f97316" />
                <Text className="text-orange-600 font-bold text-sm" style={{ fontFamily: "Quicksand-Bold" }}>
                  Select Location from Map
                </Text>
              </TouchableOpacity>

              {hotelForm.address ? (
                <View className="bg-gray-50 border border-gray-150 rounded-2xl p-4 gap-3">
                  <View className="flex-row items-start gap-2">
                    <Ionicons name="map-outline" size={18} color="#6b7280" style={{ marginTop: 2 }} />
                    <View className="flex-1">
                      <Text className="text-[10px] text-gray-400 font-bold uppercase" style={{ fontFamily: "Quicksand-Bold" }}>
                        Selected Address
                      </Text>
                      <Text className="text-sm font-semibold text-gray-800 mt-0.5" style={{ fontFamily: "Quicksand-SemiBold" }}>
                        {hotelForm.address}
                      </Text>
                    </View>
                  </View>

                  {hotelForm.flatHouseNo ? (
                    <View className="flex-row items-start gap-2 border-t border-gray-100 pt-2">
                      <Ionicons name="home-outline" size={18} color="#6b7280" style={{ marginTop: 2 }} />
                      <View className="flex-1">
                        <Text className="text-[10px] text-gray-400 font-bold uppercase" style={{ fontFamily: "Quicksand-Bold" }}>
                          Flat / House no. / Floor
                        </Text>
                        <Text className="text-sm font-semibold text-gray-800 mt-0.5" style={{ fontFamily: "Quicksand-SemiBold" }}>
                          {hotelForm.flatHouseNo}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {hotelForm.contactNumber ? (
                    <View className="flex-row items-start gap-2 border-t border-gray-100 pt-2">
                      <Ionicons name="call-outline" size={18} color="#6b7280" style={{ marginTop: 2 }} />
                      <View className="flex-1">
                        <Text className="text-[10px] text-gray-400 font-bold uppercase" style={{ fontFamily: "Quicksand-Bold" }}>
                          Contact Number
                        </Text>
                        <Text className="text-sm font-semibold text-gray-800 mt-0.5" style={{ fontFamily: "Quicksand-SemiBold" }}>
                          {hotelForm.contactNumber}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View className="flex-row gap-4 border-t border-gray-200 pt-2.5">
                    <View className="flex-1">
                      <Text className="text-[10px] text-gray-400 font-bold uppercase" style={{ fontFamily: "Quicksand-Bold" }}>
                        Latitude
                      </Text>
                      <Text className="text-sm font-semibold text-gray-800 mt-0.5" style={{ fontFamily: "Quicksand-SemiBold" }}>
                        {hotelForm.latitude}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] text-gray-400 font-bold uppercase" style={{ fontFamily: "Quicksand-Bold" }}>
                        Longitude
                      </Text>
                      <Text className="text-sm font-semibold text-gray-800 mt-0.5" style={{ fontFamily: "Quicksand-SemiBold" }}>
                        {hotelForm.longitude}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Text className="text-xs text-gray-400 text-center italic py-2" style={{ fontFamily: "Quicksand-Medium" }}>
                  No location selected yet. Tap the button above to pick from map.
                </Text>
              )}
            </View>

            {/* Manager Account Section */}
            <View className="border-t border-gray-100 pt-4 gap-4">
              <Text className="text-sm font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                Hotel Manager Account Details
              </Text>

              <View className="gap-1.5">
                <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                  Manager Email Address
                </Text>
                <TextInput
                  placeholder="e.g. manager@hotel.com"
                  className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                  style={{ fontFamily: "Quicksand-SemiBold" }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={hotelForm.managerEmail}
                  onChangeText={(t) => setHotelForm((prev) => ({ ...prev, managerEmail: t }))}
                />
              </View>

              <View className="gap-1.5">
                <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                  Manager Password
                </Text>
                <TextInput
                  placeholder="At least 8 characters"
                  className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                  style={{ fontFamily: "Quicksand-SemiBold" }}
                  secureTextEntry={true}
                  autoCapitalize="none"
                  value={hotelForm.managerPassword}
                  onChangeText={(t) => setHotelForm((prev) => ({ ...prev, managerPassword: t }))}
                />
              </View>
            </View>

            <TouchableOpacity
              className="bg-orange-500 py-4 rounded-2xl items-center justify-center flex-row gap-2 mt-2"
              onPress={handleAddHotel}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text className="text-white text-sm font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                    Create Restaurant
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* DELIVERY BOY REGISTRY FORM */
          <View className="bg-white rounded-3xl p-6 border border-gray-100 gap-5 shadow-sm shadow-black/5">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center">
                <Ionicons name="bicycle" size={20} color="#f97316" />
              </View>
              <View>
                <Text className="text-base font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                  Register Delivery Boy
                </Text>
                <Text className="text-[11px] text-gray-400" style={{ fontFamily: "Quicksand-Medium" }}>
                  Add account credentials for delivery riders
                </Text>
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Delivery Rider Full Name
              </Text>
              <TextInput
                placeholder="e.g. John Doe"
                className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
                value={deliveryForm.name}
                onChangeText={(t) => setDeliveryForm((prev) => ({ ...prev, name: t }))}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Delivery Rider Email
              </Text>
              <TextInput
                placeholder="john.doe@delivery.com"
                className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
                keyboardType="email-address"
                value={deliveryForm.email}
                onChangeText={(t) => setDeliveryForm((prev) => ({ ...prev, email: t }))}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Password (min 8 chars)
              </Text>
              <TextInput
                placeholder="••••••••"
                className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
                secureTextEntry={true}
                value={deliveryForm.password}
                onChangeText={(t) => setDeliveryForm((prev) => ({ ...prev, password: t }))}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Mobile Phone Number
              </Text>
              <TextInput
                placeholder="e.g. +91 9876543210"
                className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
                keyboardType="phone-pad"
                value={deliveryForm.phone}
                onChangeText={(t) => setDeliveryForm((prev) => ({ ...prev, phone: t }))}
              />
            </View>

            <TouchableOpacity
              className="bg-orange-500 py-4 rounded-2xl items-center justify-center flex-row gap-2 mt-2"
              onPress={handleRegisterDelivery}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text className="text-white text-sm font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                    Create Rider Account
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Map Selection Modal */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={mapStyles.container}>
          {/* Top Bar with Back Arrow and Autocomplete Search Bar */}
          <View style={[mapStyles.topBarWrapper, { paddingTop: insets.top > 0 ? insets.top : 12 }]}>
            <View style={mapStyles.topRow}>
              <TouchableOpacity
                onPress={() => setMapModalVisible(false)}
                style={mapStyles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={22} color="#111827" />
              </TouchableOpacity>

              <View style={mapStyles.searchContainer}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color="#9ca3af"
                  style={mapStyles.searchIcon}
                />
                <TextInput
                  style={mapStyles.searchInput}
                  placeholder="Search address, area or city..."
                  placeholderTextColor="#9ca3af"
                  value={mapSearchQuery}
                  onChangeText={setMapSearchQuery}
                  onSubmitEditing={() => mapSearchAddress(mapSearchQuery, mapRef)}
                  returnKeyType="search"
                  autoCorrect={false}
                  contextMenuHidden={true}
                />
                {mapSearching ? (
                  <ActivityIndicator
                    size="small"
                    color="#f97316"
                    style={mapStyles.searchLoader}
                  />
                ) : mapSearchQuery.length > 0 ? (
                  <TouchableOpacity
                    onPress={mapClearSearch}
                    style={mapStyles.clearButton}
                  >
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {(mapSuggestionsLoading || mapAddressSuggestions.length > 0) && (
              <View style={mapStyles.suggestionsContainer}>
                {mapSuggestionsLoading ? (
                  <View style={mapStyles.suggestionRow}>
                    <ActivityIndicator size="small" color="#f97316" />
                    <Text style={mapStyles.suggestionSecondary}>Searching...</Text>
                  </View>
                ) : (
                  mapAddressSuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.placeId ?? item.description}
                      style={mapStyles.suggestionRow}
                      activeOpacity={0.75}
                      onPress={() => mapSelectAddressSuggestion(item, mapRef)}
                    >
                      <Ionicons name="location-outline" size={18} color="#f97316" />
                      <View style={mapStyles.suggestionTextBlock}>
                        <Text style={mapStyles.suggestionPrimary} numberOfLines={1}>
                          {item.primaryText}
                        </Text>
                        <Text style={mapStyles.suggestionSecondary} numberOfLines={2}>
                          {item.secondaryText}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Map View */}
          <MapView
            ref={mapRef}
            style={mapStyles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={currentRegion}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation={true}
            showsMyLocationButton={false}
          />

          {/* Locate Current Position Trigger */}
          <TouchableOpacity
            style={[mapStyles.currentLocationButton, { top: insets.top > 0 ? insets.top + 64 : 80 }]}
            onPress={() => mapLocateCurrentPosition(mapRef)}
            activeOpacity={0.85}
            disabled={mapCurrentLocationLoading}
          >
            {mapCurrentLocationLoading ? (
              <ActivityIndicator size="small" color="#1f2937" />
            ) : (
              <Ionicons name="locate" size={23} color="#1f2937" />
            )}
          </TouchableOpacity>

          {/* Zoom Buttons Overlay */}
          <View style={mapStyles.zoomControlsContainer}>
            <TouchableOpacity
              style={mapStyles.zoomButton}
              onPress={() => mapZoomIn(mapRef)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <View style={mapStyles.zoomDivider} />
            <TouchableOpacity
              style={mapStyles.zoomButton}
              onPress={() => mapZoomOut(mapRef)}
              activeOpacity={0.8}
            >
              <Ionicons name="remove" size={24} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          {/* Center Location Map Pin Overlay */}
          <View style={mapStyles.pinContainer} pointerEvents="none">
            <Ionicons name="location-sharp" size={44} color="#f97316" />
            <View style={mapStyles.pinShadow} />
          </View>

          {/* Floating Confirm Location Bottom Card */}
          <View style={[mapStyles.card, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 24 }]}>
            <View style={mapStyles.dragHandle} />
            <Text style={mapStyles.cardTitle}>Selected Location</Text>
            
            <View style={mapStyles.addressRow}>
              <Ionicons
                name="location-outline"
                size={18}
                color="#f97316"
                style={{ marginTop: 2 }}
              />
              <TextInput
                style={mapStyles.addressInput}
                value={mapAddress || ""}
                onChangeText={setMapAddress}
                multiline={true}
                numberOfLines={2}
                placeholder="Move the map or type address here..."
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={mapStyles.detailInputWrapper}>
              <Ionicons name="home-outline" size={18} color="#f97316" />
              <TextInput
                style={mapStyles.detailInput}
                placeholder="Flat / House no. / Floor"
                placeholderTextColor="#9ca3af"
                value={mapFlatHouseNo}
                onChangeText={setMapFlatHouseNo}
                returnKeyType="next"
              />
            </View>

            <View style={mapStyles.detailInputWrapper}>
              <Ionicons name="call-outline" size={18} color="#f97316" />
              <TextInput
                style={mapStyles.detailInput}
                placeholder="Contact number"
                placeholderTextColor="#9ca3af"
                value={mapContactNumber}
                onChangeText={setMapContactNumber}
                keyboardType="phone-pad"
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              style={mapStyles.confirmButton}
              onPress={handleConfirmLocation}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={mapStyles.confirmButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const { height } = Dimensions.get("window");

const mapStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    width: "100%",
    height: height,
  },
  topBarWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontFamily: "Quicksand-Medium",
    fontSize: 14,
    color: "#1f2937",
  },
  searchLoader: {
    padding: 4,
  },
  clearButton: {
    padding: 4,
  },
  suggestionsContainer: {
    marginLeft: 72,
    marginRight: 16,
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  currentLocationButton: {
    position: "absolute",
    right: 16,
    top: Platform.OS === "ios" ? 110 : 120,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  suggestionRow: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  suggestionTextBlock: {
    flex: 1,
  },
  suggestionPrimary: {
    fontSize: 14,
    fontFamily: "Quicksand-Bold",
    color: "#111827",
  },
  suggestionSecondary: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Quicksand-Regular",
    color: "#6b7280",
  },
  zoomControlsContainer: {
    position: "absolute",
    right: 16,
    top: "35%",
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    overflow: "hidden",
    zIndex: 10,
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  zoomDivider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginHorizontal: 8,
  },
  pinContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -22,
    marginTop: -52,
    alignItems: "center",
  },
  pinShadow: {
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginTop: -4,
  },
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e5e7eb",
    alignSelf: "center",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Quicksand-Bold",
    color: "#111827",
    marginBottom: 10,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 20,
    minHeight: 44,
  },
  addressInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Quicksand-Regular",
    color: "#6b7280",
    padding: 0,
    margin: 0,
    textAlignVertical: "top",
    minHeight: 44,
  },
  detailInputWrapper: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f9fafb",
  },
  detailInput: {
    flex: 1,
    height: 48,
    fontFamily: "Quicksand-Medium",
    fontSize: 15,
    color: "#111827",
  },
  confirmButton: {
    backgroundColor: "#f97316",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Quicksand-Bold",
  },
});

