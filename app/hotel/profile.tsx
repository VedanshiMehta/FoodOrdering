import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  StyleSheet,
  Dimensions,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { APPWRITE_DATABASE_ID, APPWRITE_USERS_COLLECTION_ID } from "../lib/services/auth_services/appwrite";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useLocationSetup } from "../../hooks/useLocationSetup";
import { useRouter } from "expo-router";

// Reusable custom profile detail row matching the customer profile layout
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
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.rowIconContainer}>
        <Ionicons name={icon} size={20} color="#f97316" />
      </View>
      <View style={styles.rowDetails}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color="#9ca3af"
          style={styles.chevron}
        />
      )}
    </Container>
  );
};

const extractFlatNo = (fullAddress: string) => {
  if (!fullAddress) return "";
  const parts = fullAddress.split(", ");
  if (parts.length > 1) {
    const firstPart = parts[0];
    const hasDigits = /\d/.test(firstPart);
    const hasFlatKeywords = /(flat|shop|house|floor|room|cabin|g-|f-|a-|b-|block|building|sector|plot|suite|apt|unit|no)/i.test(firstPart);
    if (hasDigits || hasFlatKeywords) {
      return firstPart;
    }
  }
  return "";
};

const extractAddressOnly = (fullAddress: string) => {
  if (!fullAddress) return "";
  const parts = fullAddress.split(", ");
  if (parts.length > 1) {
    const flat = extractFlatNo(fullAddress);
    if (flat) {
      return parts.slice(1).join(", ");
    }
  }
  return fullAddress;
};

export default function ProfileScreen() {
  const { appwrite, setIsLoggedIn, setUser, user } = useContext(AppwriteContext);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Map Selection states & hook
  const mapRef = useRef<MapView>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [mainBranchRowId, setMainBranchRowId] = useState<string | null>(null);

  // Multiple branches state
  const [branches, setBranches] = useState<any[]>([]);
  const [formBranches, setFormBranches] = useState<any[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>("primary");
  
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

  // Local contact number input in profile map modal
  const [mapContactNumber, setMapContactNumber] = useState("");

  // Profile Form state prefilled from logged-in manager session
  const [profileForm, setProfileForm] = useState({
    address: user?.address || "",
    flatHouseNo: "",
    contactNumber: user?.phoneNumber || "",
    latitude: user?.latitude || "20.5992",
    longitude: user?.longitude || "72.9342",
  });

  const fetchBranches = async () => {
    if (!user?.$id) return;
    setLoadingBranches(true);
    try {
      const fetchedBranches = await appwrite.getUserAddresses(user.$id);
      const mainBranch = fetchedBranches.find((b: any) => b.branchName === "Main Branch");
      
      let flat = "";
      let addr = user?.address || "";
      if (mainBranch) {
        flat = mainBranch.flatHouseNo || "";
        addr = mainBranch.address || "";
        setMainBranchRowId(mainBranch.$id);
      } else if (user?.address) {
        flat = extractFlatNo(user.address);
        addr = extractAddressOnly(user.address);
        setMainBranchRowId(null);
      }

      setProfileForm((prev) => ({
        ...prev,
        flatHouseNo: flat,
        address: addr,
      }));

      setBranches(fetchedBranches.filter((b: any) => b.branchName !== "Main Branch"));
    } catch (err) {
      console.error("Error loading branches:", err);
    } finally {
      setLoadingBranches(false);
    }
  };

  // Keep profile form state updated if user context refreshes
  useEffect(() => {
    if (user) {
      setProfileForm({
        address: user.address || "",
        flatHouseNo: "",
        contactNumber: user.phoneNumber || "",
        latitude: user.latitude || "20.5992",
        longitude: user.longitude || "72.9342",
      });
      setMapContactNumber(user.phoneNumber || "");
      fetchBranches();
    }
  }, [user]);

  // Sync profile form and branches to local in-memory form list when Edit Profile modal opens
  useEffect(() => {
    if (editModalVisible && user) {
      const flat = extractFlatNo(user.address || "");
      const addr = extractAddressOnly(user.address || "");
      setProfileForm({
        address: addr,
        flatHouseNo: flat,
        contactNumber: user.phoneNumber || "",
        latitude: user.latitude || "20.5992",
        longitude: user.longitude || "72.9342",
      });
      setFormBranches([...branches]);
    }
  }, [editModalVisible, user, branches]);

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

  const handleEditBranch = (branch: any) => {
    setEditingBranchId(branch.$id);
    const flat = branch.flatHouseNo || extractFlatNo(branch.address || "");
    const addr = branch.flatHouseNo ? branch.address : extractAddressOnly(branch.address || "");
    setMapAddress(addr || "");
    setMapFlatHouseNo(flat || "");
    setMapContactNumber(branch.phoneNumber || user?.phoneNumber || "");
    setMapModalVisible(true);

    setTimeout(() => {
      if (branch.latitude && branch.longitude && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: parseFloat(branch.latitude),
          longitude: parseFloat(branch.longitude),
          latitudeDelta: 0.00922,
          longitudeDelta: 0.00421,
        }, 400);
      }
    }, 500);
  };

  const handleAddNewBranch = () => {
    setEditingBranchId(null);
    setMapAddress("");
    setMapFlatHouseNo("");
    setMapContactNumber(user?.phoneNumber || "");
    setMapModalVisible(true);
  };

  const handleConfirmLocation = () => {
    if (editingBranchId === "primary") {
      setProfileForm((prev) => ({
        ...prev,
        address: mapAddress || "",
        flatHouseNo: mapFlatHouseNo || "",
        contactNumber: mapContactNumber || "",
        latitude: String(currentRegion.latitude),
        longitude: String(currentRegion.longitude),
      }));
      setMapModalVisible(false);
    } else {
      // It is a branch address being added or updated!
      const newBranchObj = {
        $id: editingBranchId || `temp-${Date.now()}`,
        userId: user?.$id || "",
        branchName: editingBranchId ? "Branch Address" : `Branch ${formBranches.length + 1}`,
        address: mapAddress || "",
        flatHouseNo: mapFlatHouseNo || "",
        phoneNumber: mapContactNumber,
        latitude: String(currentRegion.latitude),
        longitude: String(currentRegion.longitude),
      };

      // Update local state ONLY (no database write!)
      if (editingBranchId) {
        setFormBranches((prev) => prev.map((b) => (b.$id === editingBranchId ? newBranchObj : b)));
      } else {
        setFormBranches((prev) => [...prev, newBranchObj]);
      }
      setMapModalVisible(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to update your profile.");
      return;
    }

    const { address, flatHouseNo, contactNumber, latitude, longitude } = profileForm;
    if (!address) {
      Alert.alert("Error", "Please select a location from the map first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const combinedAddress = (flatHouseNo ? flatHouseNo.trim() + ", " : "") + address;

      // 1. Update user document in the Appwrite database
      await appwrite.database.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_USERS_COLLECTION_ID,
        rowId: user.$id,
        data: {
          address: combinedAddress,
          phoneNumber: contactNumber,
          latitude: String(latitude),
          longitude: String(longitude),
        },
      });

      // 2. Mirror primary address as "Main Branch" in addresses collection
      // 2. Mirror primary address as "Main Branch" in addresses collection
      const mainBranchRes = await appwrite.saveAddress({
        rowId: mainBranchRowId || undefined,
        userId: user.$id,
        branchName: "Main Branch",
        address: address || "",
        flatHouseNo: flatHouseNo || "",
        phoneNumber: contactNumber,
        latitude: String(latitude),
        longitude: String(longitude),
        addressLabel: "Home",
      });
      if (mainBranchRes && mainBranchRes.$id) {
        setMainBranchRowId(mainBranchRes.$id);
      }

      // 3. Process formBranches: save new ones and update existing ones in Appwrite
      for (const branch of formBranches) {
        const isTemp = branch.$id.startsWith("temp-");
        await appwrite.saveAddress({
          rowId: isTemp ? undefined : branch.$id,
          userId: user.$id,
          branchName: branch.branchName || "Branch Address",
          address: branch.address || "",
          flatHouseNo: branch.flatHouseNo || "",
          phoneNumber: branch.phoneNumber || contactNumber,
          latitude: String(branch.latitude),
          longitude: String(branch.longitude),
          addressLabel: "Work",
        });
      }

      // 4. Delete removed branches from Appwrite database
      const deletedBranches = branches.filter((b) => !formBranches.some((fb) => fb.$id === b.$id));
      for (const db of deletedBranches) {
        await appwrite.deleteAddress(db.$id);
      }

      // 5. Update local React Context so header and Profile screens refresh dynamically
      const updatedUser = {
        ...user,
        address: combinedAddress,
        phoneNumber: contactNumber,
        latitude: String(latitude),
        longitude: String(longitude),
      };
      setUser(updatedUser as any);

      // 6. Reload database state
      await fetchBranches();

      Alert.alert("Success", "Profile and branch details saved successfully!");
      setEditModalVisible(false);
    } catch (err: any) {
      console.log("Hotel manager profile update error: ", err);
      Alert.alert("Error", "Could not save details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header matching original background and centering */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Centered Avatar with NO Edit Pencil Overlay */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.substring(0, 2).toUpperCase() : "DO"}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile Information List Container Card */}
        <View style={styles.card}>
          <InfoRow
            icon="person-outline"
            label="Full Name"
            value={user?.name || "Dominos"}
          />
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={user?.email || "dominos@yopmail.com"}
          />
          <InfoRow
            icon="call-outline"
            label="Phone number"
            value={user?.phoneNumber || "+918668947895"}
          />
          <InfoRow
            icon="location-outline"
            label="Address"
            value={user?.address || "No location stored."}
            isLast={branches.length === 0}
          />
          {branches.map((branch, index) => (
            <InfoRow
              key={branch.$id}
              icon="business-outline"
              label={`Branch ${index + 1}`}
              value={(branch.flatHouseNo ? branch.flatHouseNo + ", " : "") + branch.address}
              isLast={index === branches.length - 1}
            />
          ))}
        </View>

        {/* Action Buttons (TALL, thick, matching customer layout perfectly!) */}
        <TouchableOpacity 
          style={styles.editButton} 
          activeOpacity={0.8}
          onPress={() => setEditModalVisible(true)}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile BottomSheet Modal (Identical to Customer edit bottomsheet!) */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheetContainer}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />

            {/* Modal Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit Profile</Text>
              <TouchableOpacity
                style={styles.sheetCloseButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#4b5563" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              contentContainerStyle={styles.editFormContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Hotel Name Field */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={[styles.inputWrapper, styles.disabledInputWrapper]}>
                  <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, styles.disabledTextInput]}
                    value={user?.name || ""}
                    editable={false}
                  />
                  <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={styles.lockIcon} />
                </View>
              </View>

              {/* Email Field (READ-ONLY) */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address (Read-only)</Text>
                <View style={[styles.inputWrapper, styles.disabledInputWrapper]}>
                  <Ionicons name="mail-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, styles.disabledTextInput]}
                    value={user?.email || ""}
                    editable={false}
                  />
                  <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={styles.lockIcon} />
                </View>
              </View>

              {/* Phone Field */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={18} color="#f97316" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={profileForm.contactNumber}
                    onChangeText={(t) => setProfileForm((prev) => ({ ...prev, contactNumber: t }))}
                    keyboardType="phone-pad"
                    placeholder="Enter phone number"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Address Field with multiple branch listing */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Address</Text>
                
                {/* Primary Address Input Box */}
                <TouchableOpacity
                  style={[styles.inputWrapper, { marginBottom: 12 }]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setEditingBranchId("primary");
                    const flat = profileForm.flatHouseNo || extractFlatNo(profileForm.address);
                    const addr = profileForm.flatHouseNo ? profileForm.address : extractAddressOnly(profileForm.address);
                    setMapAddress(addr);
                    setMapFlatHouseNo(flat);
                    setMapContactNumber(profileForm.contactNumber);
                    setMapModalVisible(true);

                    setTimeout(() => {
                      if (profileForm.latitude && profileForm.longitude && mapRef.current) {
                        mapRef.current.animateToRegion({
                          latitude: parseFloat(String(profileForm.latitude)),
                          longitude: parseFloat(String(profileForm.longitude)),
                          latitudeDelta: 0.00922,
                          longitudeDelta: 0.00421,
                        }, 400);
                      }
                    }, 500);
                  }}
                >
                  <Ionicons name="location-outline" size={18} color="#f97316" style={styles.inputIcon} />
                  <Text style={styles.addressButtonText} numberOfLines={1}>
                    {profileForm.address ? (profileForm.flatHouseNo ? profileForm.flatHouseNo + ", " : "") + profileForm.address : "Tap to select location on map..."}
                  </Text>
                  <Ionicons name="map-outline" size={18} color="#f97316" style={styles.lockIcon} />
                </TouchableOpacity>

                {/* Secondary Branches listing */}
                {loadingBranches ? (
                  <ActivityIndicator size="small" color="#f97316" style={{ marginVertical: 10 }} />
                ) : (
                  formBranches.map((branch) => (
                    <View key={branch.$id} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
                      <TouchableOpacity
                        style={[styles.inputWrapper, { flex: 1, marginBottom: 0 }]}
                        activeOpacity={0.8}
                        onPress={() => handleEditBranch(branch)}
                      >
                        <Ionicons name="location-outline" size={18} color="#f97316" style={styles.inputIcon} />
                        <Text style={styles.addressButtonText} numberOfLines={1}>
                          {(branch.flatHouseNo ? branch.flatHouseNo + ", " : "") + branch.address}
                        </Text>
                        <Ionicons name="map-outline" size={18} color="#f97316" style={styles.lockIcon} />
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert("Delete Branch", "Are you sure you want to remove this branch address?", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => {
                                setFormBranches((prev) => prev.filter((b) => b.$id !== branch.$id));
                              }
                            }
                          ]);
                        }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: "#fee2e2",
                          backgroundColor: "#fef2f2",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {/* + Add Branch Location link */}
                <TouchableOpacity
                  onPress={handleAddNewBranch}
                  activeOpacity={0.7}
                  style={{ flexDirection: "row", alignItems: "center", marginTop: 4, paddingLeft: 4, gap: 4 }}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#f97316" />
                  <Text style={{ fontSize: 13, fontFamily: "Quicksand-Bold", color: "#f97316" }}>
                    Add Branch Location / Address
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleUpdateProfile}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>

            {/* Map Selection Modal - NESTED inside Edit Profile Modal to support dual overlays on iOS! */}
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
                    <View><Text style={mapStyles.confirmButtonText}>Confirm Location</Text></View>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const { height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb", // Match customer screen background
  },
  scrollContent: {
    paddingBottom: 150,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#f9fafb",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Quicksand-Bold",
    color: "#111827",
    textAlign: "center",
  },
  avatarContainer: {
    alignItems: "center",
    marginVertical: 28,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#fff7ed",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    fontSize: 32,
    fontFamily: "Quicksand-Bold",
    color: "#f97316",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#f97316",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    marginHorizontal: 20,
    marginBottom: 28,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff7ed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowDetails: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 12,
    fontFamily: "Quicksand-Medium",
    color: "#9ca3af",
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Quicksand-Bold",
    color: "#374151",
  },
  chevron: {
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 16,
    height: 52,
    marginHorizontal: 20,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
    color: "#f97316",
  },
  logoutButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 16,
    height: 52,
    marginHorizontal: 20,
    marginBottom: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
    color: "#ef4444",
  },

  // Modal BottomSheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: "85%",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e5e7eb",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Quicksand-Bold",
    color: "#111827",
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  editFormContent: {
    paddingBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: "Quicksand-Bold",
    color: "#4b5563",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  disabledInputWrapper: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Quicksand-SemiBold",
    color: "#1f2937",
    height: "100%",
  },
  addressButtonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Quicksand-SemiBold",
    color: "#1f2937",
  },
  disabledTextInput: {
    color: "#6b7280",
  },
  lockIcon: {
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: "#f97316",
    borderRadius: 18,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
    color: "#fff",
  },
});

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
