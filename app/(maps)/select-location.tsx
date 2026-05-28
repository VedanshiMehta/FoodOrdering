import React, { useRef, useContext, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
} from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useLocationSetup } from "../../hooks/useLocationSetup";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";

const { height } = Dimensions.get("window");

export default function SelectLocationScreen() {
  const mapRef = useRef<MapView>(null);
  const {
    currentRegion,
    address,
    setAddress,
    flatHouseNo,
    setFlatHouseNo,
    loading,
    searchQuery,
    setSearchQuery,
    addressSuggestions,
    suggestionsLoading,
    searching,
    currentLocationLoading,
    onRegionChangeComplete,
    searchAddress,
    selectAddressSuggestion,
    clearSearch,
    locateCurrentPosition,
    zoomIn,
    zoomOut,
    confirmLocation,
  } = useLocationSetup();
  const router = useRouter();

  const { user, setUser, appwrite } = useContext(AppwriteContext);

  // States for Address type label and Mobile number
  const [addressLabel, setAddressLabel] = useState<"Home" | "Work" | "Other">(
    (user?.addressLabel as "Home" | "Work" | "Other") || "Home"
  );
  const [mobileNumber, setMobileNumber] = useState(user?.phoneNumber || "");

  const handleConfirm = async () => {
    confirmLocation();

    // Store in Appwrite database user table if user is logged in
    if (user) {
      const fullAddr = (flatHouseNo ? flatHouseNo.trim() + ", " : "") + (address || "");
      try {
        await appwrite.updateUserProfile({
          userId: user.$id,
          phoneNumber: mobileNumber.trim(),
          address: fullAddr,
          addressLabel: addressLabel,
          latitude: currentRegion.latitude,
          longitude: currentRegion.longitude,
        });

        // Update local React Context user state so Profile UI refreshes dynamically!
        setUser({
          ...user,
          phoneNumber: mobileNumber.trim(),
          address: fullAddr,
          addressLabel: addressLabel,
          latitude: currentRegion.latitude,
          longitude: currentRegion.longitude,
        });
      } catch (err) {
        console.error("Failed to save location details to Appwrite:", err);
      }
    }

    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loaderText}>Finding your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar with Back Button and Search Bar */}
      <SafeAreaView style={styles.topBarWrapper} edges={["top"]}>
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#9ca3af"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search address, area or city..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => searchAddress(searchQuery, mapRef)}
              returnKeyType="search"
              autoCorrect={false}
              contextMenuHidden={true}
            />
            {searching ? (
              <ActivityIndicator
                size="small"
                color="#f97316"
                style={styles.searchLoader}
              />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={clearSearch}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {(suggestionsLoading || addressSuggestions.length > 0) && (
          <View style={styles.suggestionsContainer}>
            {suggestionsLoading ? (
              <View style={styles.suggestionRow}>
                <ActivityIndicator size="small" color="#f97316" />
                <Text style={styles.suggestionSecondary}>Searching...</Text>
              </View>
            ) : (
              addressSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.placeId ?? item.description}
                  style={styles.suggestionRow}
                  activeOpacity={0.75}
                  onPress={() => selectAddressSuggestion(item, mapRef)}
                >
                  <Ionicons name="location-outline" size={18} color="#f97316" />
                  <View style={styles.suggestionTextBlock}>
                    <Text style={styles.suggestionPrimary} numberOfLines={1}>
                      {item.primaryText}
                    </Text>
                    <Text style={styles.suggestionSecondary} numberOfLines={2}>
                      {item.secondaryText}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </SafeAreaView>

      {/* Map — must use style prop with explicit dimensions, NOT className */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={currentRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation={true}
        showsMyLocationButton={false}
      />

      <TouchableOpacity
        style={styles.currentLocationButton}
        onPress={() => locateCurrentPosition(mapRef)}
        activeOpacity={0.85}
        disabled={currentLocationLoading}
      >
        {currentLocationLoading ? (
          <ActivityIndicator size="small" color="#1f2937" />
        ) : (
          <Ionicons name="locate" size={23} color="#1f2937" />
        )}
      </TouchableOpacity>

      {/* Zoom Controls */}
      <View style={styles.zoomControlsContainer}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => zoomIn(mapRef)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => zoomOut(mapRef)}
          activeOpacity={0.8}
        >
          <Ionicons name="remove" size={24} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      {/* Fixed Center Pin */}
      <View style={styles.pinContainer} pointerEvents="none">
        <Ionicons name="location-sharp" size={44} color="#f97316" />
        <View style={styles.pinShadow} />
      </View>

      {/* Bottom Info Card */}
      <View style={styles.card}>
        <View style={styles.dragHandle} />

        <Text style={styles.cardTitle}>Selected Location</Text>

        <View style={styles.addressRow}>
          <Ionicons
            name="location-outline"
            size={18}
            color="#f97316"
            style={{ marginTop: 2 }}
          />
          <TextInput
            style={styles.addressInput}
            value={address || ""}
            onChangeText={setAddress}
            multiline={true}
            numberOfLines={2}
            placeholder="Move the map or type address here..."
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.detailInputWrapper}>
          <Ionicons name="home-outline" size={18} color="#f97316" />
          <TextInput
            style={styles.detailInput}
            placeholder="Flat / House no. / Floor"
            placeholderTextColor="#9ca3af"
            value={flatHouseNo}
            onChangeText={setFlatHouseNo}
            returnKeyType="next"
          />
        </View>

        {/* Mobile Number Input */}
        <View style={styles.detailInputWrapper}>
          <Ionicons name="call-outline" size={18} color="#f97316" />
          <TextInput
            style={styles.detailInput}
            placeholder="Mobile number"
            placeholderTextColor="#9ca3af"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            returnKeyType="done"
          />
        </View>

        {/* Address Category Chip UI */}
        <Text style={styles.sectionLabel}>Save Address As</Text>
        <View style={styles.chipsRow}>
          <TouchableOpacity
            style={[styles.chip, addressLabel === "Home" && styles.activeChip]}
            onPress={() => setAddressLabel("Home")}
            activeOpacity={0.8}
          >
            <Ionicons
              name={addressLabel === "Home" ? "home" : "home-outline"}
              size={16}
              color={addressLabel === "Home" ? "#fff" : "#f97316"}
            />
            <Text style={[styles.chipText, addressLabel === "Home" && styles.activeChipText]}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, addressLabel === "Work" && styles.activeChip]}
            onPress={() => setAddressLabel("Work")}
            activeOpacity={0.8}
          >
            <Ionicons
              name={addressLabel === "Work" ? "briefcase" : "briefcase-outline"}
              size={16}
              color={addressLabel === "Work" ? "#fff" : "#f97316"}
            />
            <Text style={[styles.chipText, addressLabel === "Work" && styles.activeChipText]}>Work</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, addressLabel === "Other" && styles.activeChip]}
            onPress={() => setAddressLabel("Other")}
            activeOpacity={0.8}
          >
            <Ionicons
              name={addressLabel === "Other" ? "location" : "location-outline"}
              size={16}
              color={addressLabel === "Other" ? "#fff" : "#f97316"}
            />
            <Text style={[styles.chipText, addressLabel === "Other" && styles.activeChipText]}>Other</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={styles.confirmButtonText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loaderText: {
    marginTop: 12,
    fontSize: 15,
    color: "#9ca3af",
    fontFamily: "Quicksand-Medium",
  },
  // ⚠️ Critical: MapView must have an explicit width + height — flex-1 via className does NOT work
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
    paddingTop: 8,
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
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
    top: 96,
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
    top: "38%",
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
    paddingBottom: 36,
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
    marginBottom: 14,
    minHeight: 44,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Quicksand-Regular",
    color: "#6b7280",
    lineHeight: 22,
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
    marginBottom: 20,
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
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Quicksand-Bold",
    color: "#6b7280",
    marginBottom: 8,
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeChip: {
    backgroundColor: "#f97316",
    borderColor: "#f97316",
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Quicksand-Bold",
    color: "#4b5563",
  },
  activeChipText: {
    color: "#fff",
  },
});
