import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { setOrderHistory, loadOrderForTracking, Order } from "../../store/slices/orderSlice";
import { RootState } from "../../store/store";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { useLocationSetup } from "../../hooks/useLocationSetup";
import { APPWRITE_DATABASE_ID, APPWRITE_USERS_COLLECTION_ID } from "../lib/services/auth_services/appwrite";

const { height } = Dimensions.get("window");

// Reusable custom profile detail row
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

export default function ProfileTab() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { user, appwrite, setIsLoggedIn, setUser } =
    useContext(AppwriteContext);

  // Redux states
  const { orderHistory } = useSelector((state: RootState) => state.order);

  // Modal Sheet state
  const { showHistory } = useLocalSearchParams<{ showHistory?: string }>();
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (showHistory === "true") {
      setHistoryModalVisible(true);
    }
  }, [showHistory]);

  // Edit Profile state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  // Multiple addresses state
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [formAddresses, setFormAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Map Selection states & hook
  const mapRef = useRef<MapView>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressLabel, setAddressLabel] = useState<"Home" | "Work" | "Other">("Home");
  const [mapContactNumber, setMapContactNumber] = useState("");

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

  // Fetch saved addresses from Appwrite on mount or user change
  const fetchSavedAddresses = async () => {
    if (!user?.$id) return;
    setLoadingAddresses(true);
    try {
      const addresses = await appwrite.getUserAddresses(user.$id);
      setSavedAddresses(addresses);
    } catch (err) {
      console.error("Error fetching saved addresses:", err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    fetchSavedAddresses();
  }, [appwrite, user]);

  // Sync addresses to local in-memory form list when Edit Profile modal opens
  useEffect(() => {
    if (editModalVisible) {
      if (savedAddresses.length > 0) {
        setFormAddresses([...savedAddresses]);
      } else if (user?.address) {
        const flat = extractFlatNo(user.address);
        const addr = extractAddressOnly(user.address);
        setFormAddresses([
          {
            $id: "primary",
            userId: user.$id,
            branchName: user.addressLabel || "Home",
            address: addr,
            flatHouseNo: flat,
            phoneNumber: user.phoneNumber || "",
            latitude: String(user.latitude || "20.5992"),
            longitude: String(user.longitude || "72.9342"),
          }
        ]);
      } else {
        setFormAddresses([]);
      }
    }
  }, [editModalVisible, savedAddresses, user]);

  const handleEditAddress = (addr: any) => {
    setEditingAddressId(addr.$id);
    setAddressLabel(addr.branchName as "Home" | "Work" | "Other" || "Home");
    const flat = addr.flatHouseNo || extractFlatNo(addr.address);
    const addressOnly = addr.flatHouseNo ? addr.address : extractAddressOnly(addr.address);
    setMapAddress(addressOnly || "");
    setMapFlatHouseNo(flat || "");
    setMapContactNumber(addr.phoneNumber || user?.phoneNumber || "");
    setMapModalVisible(true);

    setTimeout(() => {
      if (addr.latitude && addr.longitude && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: parseFloat(addr.latitude),
          longitude: parseFloat(addr.longitude),
          latitudeDelta: 0.00922,
          longitudeDelta: 0.00421,
        }, 400);
      }
    }, 500);
  };

  const handleAddNewAddress = () => {
    setEditingAddressId(null);
    setAddressLabel("Home");
    setMapAddress("");
    setMapFlatHouseNo("");
    setMapContactNumber(user?.phoneNumber || "");
    setMapModalVisible(true);
  };

  const handleDeleteAddress = (addrId: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to remove this saved address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setFormAddresses((prev) => prev.filter((addr) => addr.$id !== addrId));
          },
        },
      ]
    );
  };

  const handleConfirmLocation = () => {
    if (!user) return;
    const newAddressObj = {
      $id: editingAddressId || `temp-${Date.now()}`,
      userId: user.$id,
      branchName: addressLabel,
      address: mapAddress || "",
      flatHouseNo: mapFlatHouseNo || "",
      phoneNumber: mapContactNumber,
      latitude: String(currentRegion.latitude),
      longitude: String(currentRegion.longitude),
    };

    // Update local state ONLY (no database write!)
    if (editingAddressId) {
      setFormAddresses((prev) => prev.map((addr) => (addr.$id === editingAddressId ? newAddressObj : addr)));
    } else {
      setFormAddresses((prev) => [...prev, newAddressObj]);
    }
    setMapModalVisible(false);
  };

  const handleLaunchCamera = async () => {
    try {
      let ImagePickerInstance;
      try {
        ImagePickerInstance = require("expo-image-picker");
      } catch (err) {
        Alert.alert(
          "Rebuild Required",
          "This feature requires the expo-image-picker native module. Please run 'npm run ios' or 'npm run android' to rebuild your app."
        );
        return;
      }

      const { status } = await ImagePickerInstance.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to take a profile photo.");
        return;
      }

      const result = await ImagePickerInstance.launchCameraAsync({
        mediaTypes: ImagePickerInstance.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Camera access failed:", error);
      Alert.alert("Camera Error", "Could not access the camera or native module. Please run 'npm run ios' or 'npm run android' to rebuild the app binary.");
    }
  };

  const handleLaunchGallery = async () => {
    try {
      let ImagePickerInstance;
      try {
        ImagePickerInstance = require("expo-image-picker");
      } catch (err) {
        Alert.alert(
          "Rebuild Required",
          "This feature requires the expo-image-picker native module. Please run 'npm run ios' or 'npm run android' to rebuild your app."
        );
        return;
      }

      const { status } = await ImagePickerInstance.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Gallery permission is required to choose a profile photo.");
        return;
      }

      const result = await ImagePickerInstance.launchImageLibraryAsync({
        mediaTypes: ImagePickerInstance.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await handleUploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Gallery access failed:", error);
      Alert.alert("Gallery Error", "Could not access your library or native module. Please run 'npm run ios' or 'npm run android' to rebuild the app binary.");
    }
  };

  const handleUploadAvatar = async (uri: string) => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const updatedDoc = await appwrite.uploadProfileImage({
        userId: user.$id,
        imageUri: uri,
      });

      if (updatedDoc && updatedDoc.avatar) {
        setUser({
          ...user,
          avatar: updatedDoc.avatar,
        });
        Alert.alert("Success", "Profile photo updated successfully!");
      } else {
        throw new Error("Avatar upload returned empty document.");
      }
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      Alert.alert("Upload Failed", "Could not upload profile photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Pre-load current details when edit modal opens
  useEffect(() => {
    if (editModalVisible && user) {
      setEditName(user.name || "");
      setEditPhoneNumber(user.phoneNumber || "");
    }
  }, [editModalVisible, user]);

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Name Required", "Please enter your full name.");
      return;
    }
    setSavingProfile(true);
    try {
      if (user) {
        // 1. Update basic info (name, phone) on Appwrite
        const updatedDoc = await appwrite.updateUserBasicInfo({
          userId: user.$id,
          name: editName.trim(),
          phoneNumber: editPhoneNumber.trim(),
        });

        if (updatedDoc) {
          let primaryAddress = user.address || "";
          let primaryAddressLabel = user.addressLabel || "Home";
          let primaryLat: number | null = user.latitude ? Number(user.latitude) : null;
          let primaryLong: number | null = user.longitude ? Number(user.longitude) : null;

          // 2. Process formAddresses: save new ones and update existing ones in Appwrite
          for (const addr of formAddresses) {
            const isTemp = addr.$id.startsWith("temp-") || addr.$id === "primary";
            const combinedAddr = (addr.flatHouseNo ? addr.flatHouseNo.trim() + ", " : "") + (addr.address || "");
            
            await appwrite.saveAddress({
              rowId: isTemp ? undefined : addr.$id,
              userId: user.$id,
              branchName: addr.branchName || "Home",
              address: addr.address || "",
              flatHouseNo: addr.flatHouseNo || "",
              phoneNumber: addr.phoneNumber || editPhoneNumber.trim(),
              latitude: String(addr.latitude),
              longitude: String(addr.longitude),
              addressLabel: addr.branchName || "Home",
            });

            // Set the first address as the primary user address
            if (addr === formAddresses[0]) {
              primaryAddress = combinedAddr;
              primaryAddressLabel = addr.branchName || "Home";
              primaryLat = parseFloat(addr.latitude);
              primaryLong = parseFloat(addr.longitude);
            }
          }

          // 3. Delete removed addresses from Appwrite
          const deletedAddresses = savedAddresses.filter((s) => !formAddresses.some((f) => f.$id === s.$id));
          for (const da of deletedAddresses) {
            await appwrite.deleteAddress(da.$id);
          }

          // 4. Update the user primary address & phone on Appwrite users table
          await appwrite.updateUserProfile({
            userId: user.$id,
            phoneNumber: editPhoneNumber.trim(),
            address: primaryAddress,
            addressLabel: primaryAddressLabel,
            latitude: primaryLat !== null ? primaryLat : undefined,
            longitude: primaryLong !== null ? primaryLong : undefined,
          });

          // 5. Update local React Context so header and Profile screens refresh dynamically
          setUser({
            ...user,
            name: editName.trim(),
            phoneNumber: editPhoneNumber.trim(),
            avatar: updatedDoc.avatar,
            address: primaryAddress,
            addressLabel: primaryAddressLabel,
            latitude: primaryLat !== null ? primaryLat : undefined,
            longitude: primaryLong !== null ? primaryLong : undefined,
          });

          // 6. Reload database state
          await fetchSavedAddresses();

          Alert.alert("Profile Updated", "Your profile details and addresses have been saved successfully.");
          setEditModalVisible(false);
        } else {
          throw new Error("Update operation failed.");
        }
      }
    } catch (error) {
      console.error("Failed to update profile details:", error);
      Alert.alert("Update Failed", "Could not save profile details. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Fetch completed orders from Appwrite on mount
  useEffect(() => {
    (async () => {
      setLoadingOrders(true);
      try {
        const fetchedOrders = await appwrite.getOrders(user?.$id);
        if (fetchedOrders && fetchedOrders.length > 0) {
          dispatch(setOrderHistory(fetchedOrders));
        }
      } catch (error) {
        console.error("Error loading history from database:", error);
      } finally {
        setLoadingOrders(false);
      }
    })();
  }, [dispatch, appwrite, user]);

  // Format Date and Time
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Completed Order";
    }
  };

  const handleLogout = async () => {
    try {
      await appwrite.logout();
      setIsLoggedIn(false);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleOrderPress = (order: Order) => {
    if (order.status !== "delivered") {
      setHistoryModalVisible(false);
      dispatch(loadOrderForTracking(order));
      router.push("/tracking" as any);
    }
  };

  const sortedOrders = [...orderHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Centered Avatar with Pencil Edit Badge */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarWrapper}>
            {uploadingAvatar ? (
              <View style={[styles.avatarPlaceholder, { backgroundColor: "#f3f4f6" }]}>
                <ActivityIndicator size="small" color="#f97316" />
              </View>
            ) : user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#fff" />
              </View>
            )}
            <TouchableOpacity 
              style={styles.editBadge} 
              activeOpacity={0.8}
              onPress={() => setAvatarModalVisible(true)}
            >
              <Ionicons name="pencil" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Information List Container Card */}
        <View style={styles.card}>
          <InfoRow
            icon="person-outline"
            label="Full Name"
            value={user?.name || "Adrian Hajdin"}
          />
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={user?.email || "adrian@jsmastery.com"}
          />
          <InfoRow
            icon="call-outline"
            label="Phone number"
            value={user?.phoneNumber || "+1 555 123 4567"}
          />
          <InfoRow
            icon="location-outline"
            label={`Address (${user?.addressLabel || "Home"})`}
            value={user?.address || "123 Main Street, Springfield, IL 62704"}
            isLast={savedAddresses.length <= 1}
          />
          {savedAddresses.slice(1).map((addr, index) => (
            <InfoRow
              key={addr.$id}
              icon={addr.branchName === "Home" ? "home-outline" : addr.branchName === "Work" ? "briefcase-outline" : "location-outline"}
              label={`Address (${addr.branchName || "Secondary"})`}
              value={(addr.flatHouseNo ? addr.flatHouseNo + ", " : "") + addr.address}
              isLast={index === savedAddresses.length - 2}
            />
          ))}
          <InfoRow
            icon="receipt-outline"
            label="Order History"
            value={`Tap to view past orders (${orderHistory.length})`}
            showChevron={true}
            onPress={() => setHistoryModalVisible(true)}
            isLast={true}
          />
        </View>

        {/* Action Buttons */}
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

      {/* Completed Orders Opaque Full Screen Modal Screen */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <SafeAreaView style={styles.modalScreenContainer} edges={["top"]}>
          {/* Navigation Header */}
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 24) }]}>
            <TouchableOpacity
              onPress={() => setHistoryModalVisible(false)}
              activeOpacity={0.7}
              style={styles.modalCloseButton}
            >
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { fontFamily: "Quicksand-Bold" }]}>
              Order History ({orderHistory.length})
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* List Content */}
          {loadingOrders ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#f97316" />
              <Text style={styles.loaderText}>
                Syncing orders from Appwrite...
              </Text>
            </View>
          ) : orderHistory.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No past orders found.</Text>
              <Text style={styles.emptySubtext}>
                Your completed orders will be listed here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={sortedOrders}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalListContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isPending = item.status !== "delivered";
                const CardContainer = isPending ? TouchableOpacity : View;
                return (
                  <CardContainer
                    style={styles.orderCard}
                    onPress={isPending ? () => handleOrderPress(item) : undefined}
                    activeOpacity={0.8}
                  >
                    {/* Header */}
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.orderId}>ID: {item.id}</Text>
                        <Text style={styles.orderDate}>
                          {formatDate(item.timestamp)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          item.status === "delivered"
                            ? { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }
                            : item.status === "picked_up"
                            ? { backgroundColor: "#fff7ed", borderColor: "#ffedd5" }
                            : { backgroundColor: "#fffbeb", borderColor: "#fef3c7" },
                          { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }
                        ]}
                      >
                        <Ionicons
                          name={
                            item.status === "delivered"
                              ? "checkmark-circle"
                              : item.status === "picked_up"
                              ? "bicycle"
                              : "time"
                          }
                          size={12}
                          color={
                            item.status === "delivered"
                              ? "#10b981"
                              : item.status === "picked_up"
                              ? "#f97316"
                              : "#d97706"
                          }
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            item.status === "delivered"
                              ? { color: "#10b981" }
                              : item.status === "picked_up"
                              ? { color: "#f97316" }
                              : { color: "#d97706" },
                            { fontFamily: "Quicksand-Bold", fontSize: 10, textTransform: "uppercase" }
                          ]}
                        >
                          {item.status === "picked_up" ? "On the Way" : item.status || "Pending"}
                        </Text>
                      </View>
                    </View>

                    {/* Breakdown */}
                    <View style={styles.itemsSection}>
                      {item.items.map((cartItem, idx) => (
                        <View key={idx} style={styles.itemRow}>
                          <Text style={styles.itemQuantity}>
                            {cartItem.quantity}x
                          </Text>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {cartItem.name}
                          </Text>
                          <Text style={styles.itemPrice}>
                            ${(cartItem.price * cartItem.quantity).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Footer */}
                    <View style={styles.cardFooter}>
                      <View style={styles.addressRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color="#f97316"
                        />
                        <Text style={styles.addressText} numberOfLines={1}>
                          {item.address}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <Text style={styles.totalPrice}>
                          Total: ${item.total.toFixed(2)}
                        </Text>
                        {isPending && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 }}>
                            <Ionicons name="navigate-circle" size={14} color="#f97316" />
                            <Text style={{ fontFamily: "Quicksand-Bold", fontSize: 10, color: "#f97316" }}>
                              Tap to Track Live
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </CardContainer>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Edit Profile Modal */}
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
              {/* Profile Image Trigger */}
              <TouchableOpacity
                style={styles.changePhotoContainer}
                onPress={() => {
                  setEditModalVisible(false);
                  setAvatarModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={20} color="#f97316" />
                <Text style={styles.changePhotoText}>Change Profile Photo</Text>
              </TouchableOpacity>

              {/* Name Field */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={18} color="#f97316" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#9ca3af"
                  />
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
                    placeholder="Email address"
                    placeholderTextColor="#9ca3af"
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
                    value={editPhoneNumber}
                    onChangeText={setEditPhoneNumber}
                    keyboardType="phone-pad"
                    placeholder="Enter your phone number"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Saved Addresses Section inside Profile edit modal */}
              <View style={[styles.inputContainer, { marginTop: 15 }]}>
                <Text style={styles.inputLabel}>Saved Addresses</Text>
                
                {loadingAddresses ? (
                  <ActivityIndicator size="small" color="#f97316" style={{ marginVertical: 10 }} />
                ) : formAddresses.length === 0 ? (
                  <Text style={styles.emptyAddressesText}>No saved addresses found.</Text>
                ) : (
                  formAddresses.map((addr) => (
                    <View key={addr.$id} style={styles.addressListItem}>
                      <View style={styles.addressListLeft}>
                        <Ionicons 
                          name={addr.branchName === "Home" ? "home-outline" : addr.branchName === "Work" ? "briefcase-outline" : "location-outline"} 
                          size={18} 
                          color="#f97316" 
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.addressListBranch}>{addr.branchName || "Address"}</Text>
                          <Text style={styles.addressListVal} numberOfLines={1}>
                            {(addr.flatHouseNo ? addr.flatHouseNo + ", " : "") + addr.address}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.addressListActions}>
                        <TouchableOpacity onPress={() => handleEditAddress(addr)} style={styles.actionIconBtn}>
                          <Ionicons name="pencil-outline" size={16} color="#4b5563" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteAddress(addr.$id)} style={styles.actionIconBtn}>
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}

                <TouchableOpacity
                  onPress={handleAddNewAddress}
                  activeOpacity={0.7}
                  style={styles.addAddressLink}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#f97316" />
                  <Text style={styles.addAddressLinkText}>Add New Address / Branch</Text>
                </TouchableOpacity>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                activeOpacity={0.8}
              >
                {savingProfile ? (
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

                  {/* Save Address As chips */}
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
          </View>
        </View>
      </Modal>

      {/* Update Profile Photo BottomSheet Modal */}
      <Modal
        visible={avatarModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheetContainer}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />

            {/* Modal Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Update Profile Photo</Text>
              <TouchableOpacity
                style={styles.sheetCloseButton}
                onPress={() => setAvatarModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#4b5563" />
              </TouchableOpacity>
            </View>

            <View style={styles.avatarOptionsContent}>
              <Text style={styles.avatarOptionsSubtitle}>
                Select a source to update your profile photo:
              </Text>

              {/* Option: Camera */}
              <TouchableOpacity
                style={styles.avatarOptionRow}
                onPress={() => {
                  setAvatarModalVisible(false);
                  handleLaunchCamera();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.avatarOptionIconWrapper}>
                  <Ionicons name="camera-outline" size={22} color="#f97316" />
                </View>
                <View style={styles.avatarOptionTextWrapper}>
                  <Text style={styles.avatarOptionTitle}>Take Photo</Text>
                  <Text style={styles.avatarOptionDesc}>Use your camera to snap a live profile picture</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              {/* Option: Gallery */}
              <TouchableOpacity
                style={styles.avatarOptionRow}
                onPress={() => {
                  setAvatarModalVisible(false);
                  handleLaunchGallery();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.avatarOptionIconWrapper}>
                  <Ionicons name="image-outline" size={22} color="#f97316" />
                </View>
                <View style={styles.avatarOptionTextWrapper}>
                  <Text style={styles.avatarOptionTitle}>Choose from Library</Text>
                  <Text style={styles.avatarOptionDesc}>Select an existing image from your photo roll</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                style={styles.avatarCancelButton}
                onPress={() => setAvatarModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.avatarCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb", // Very light cool grey matching mockup background
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
    backgroundColor: "#f9fafb", // Same as screen background color
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Quicksand-Bold",
    color: "#111827",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  avatarContainer: {
    alignItems: "center",
    marginVertical: 28,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
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
    maxHeight: "80%",
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
  loaderContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderText: {
    fontSize: 13,
    fontFamily: "Quicksand-Medium",
    color: "#9ca3af",
    marginTop: 10,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
    color: "#6b7280",
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    fontFamily: "Quicksand-Medium",
    color: "#9ca3af",
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 20,
  },

  // Order Card Styles
  orderCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
    paddingBottom: 10,
    marginBottom: 10,
  },
  orderId: {
    fontSize: 14,
    fontFamily: "Quicksand-Bold",
    color: "#111827",
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 11,
    fontFamily: "Quicksand-Medium",
    color: "#9ca3af",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Quicksand-Bold",
    color: "#059669",
  },
  itemsSection: {
    gap: 8,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemQuantity: {
    fontSize: 13,
    fontFamily: "Quicksand-Bold",
    color: "#f97316",
  },
  itemName: {
    fontSize: 13,
    fontFamily: "Quicksand-Medium",
    color: "#374151",
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontFamily: "Quicksand-Bold",
    color: "#4b5563",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f9fafb",
    paddingTop: 10,
    marginTop: 4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    marginRight: 12,
  },
  addressText: {
    fontSize: 12,
    fontFamily: "Quicksand-Medium",
    color: "#9ca3af",
    flex: 1,
  },
  totalPrice: {
    fontSize: 14,
    fontFamily: "Quicksand-Bold",
    color: "#f97316",
  },
  editFormContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
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
    marginTop: 10,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
    color: "#fff",
  },
  changePhotoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#ffedd5",
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  changePhotoText: {
    fontSize: 14,
    fontFamily: "Quicksand-Bold",
    color: "#f97316",
  },
  avatarOptionsContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  avatarOptionsSubtitle: {
    fontSize: 14,
    fontFamily: "Quicksand-Medium",
    color: "#6b7280",
    marginBottom: 24,
    textAlign: "center",
  },
  avatarOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarOptionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff7ed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarOptionTextWrapper: {
    flex: 1,
  },
  avatarOptionTitle: {
    fontSize: 15,
    fontFamily: "Quicksand-Bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  avatarOptionDesc: {
    fontSize: 12,
    fontFamily: "Quicksand-Medium",
    color: "#6b7280",
  },
  avatarCancelButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 18,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  avatarCancelButtonText: {
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
    color: "#4b5563",
  },

  // Opaque Full Screen Modal Styles (matching driver history)
  modalScreenContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#f9fafb",
  },
  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
    color: "#1f2937",
  },
  modalListContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  emptyAddressesText: {
    fontFamily: "Quicksand-Medium",
    fontSize: 13,
    color: "#9ca3af",
    marginVertical: 10,
    fontStyle: "italic",
  },
  addressListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  addressListLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginRight: 10,
  },
  addressListBranch: {
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    color: "#1f2937",
    marginBottom: 2,
  },
  addressListVal: {
    fontFamily: "Quicksand-Medium",
    fontSize: 12,
    color: "#6b7280",
  },
  addressListActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  addAddressLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  addAddressLinkText: {
    fontFamily: "Quicksand-Bold",
    fontSize: 14,
    color: "#f97316",
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Quicksand-Bold",
    color: "#6b7280",
    marginBottom: 8,
    marginTop: 10,
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
    marginTop: 10,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Quicksand-Bold",
  },
});
