import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { setOrderHistory } from "../../store/slices/orderSlice";
import { RootState } from "../../store/store";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";

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

export default function ProfileTab() {
  const dispatch = useDispatch();
  const { user, appwrite, setIsLoggedIn, setUser } =
    useContext(AppwriteContext);

  // Redux states
  const { orderHistory } = useSelector((state: RootState) => state.order);

  // Modal Sheet state
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Edit Profile state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

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
        const updatedDoc = await appwrite.updateUserBasicInfo({
          userId: user.$id,
          name: editName.trim(),
          phoneNumber: editPhoneNumber.trim(),
        });

        if (updatedDoc) {
          setUser({
            ...user,
            name: editName.trim(),
            phoneNumber: editPhoneNumber.trim(),
            avatar: updatedDoc.avatar,
          });
          Alert.alert("Profile Updated", "Your profile details have been saved successfully.");
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
          />
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

      {/* Completed Orders BottomSheet Modal */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheetContainer}>
            {/* Grab Bar */}
            <View style={styles.dragHandle} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                Order History ({orderHistory.length})
              </Text>
              <TouchableOpacity
                style={styles.sheetCloseButton}
                onPress={() => setHistoryModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#4b5563" />
              </TouchableOpacity>
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
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.orderCard}>
                    {/* Header */}
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.orderId}>ID: {item.id}</Text>
                        <Text style={styles.orderDate}>
                          {formatDate(item.timestamp)}
                        </Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color="#10b981"
                        />
                        <Text style={styles.statusText}>Delivered</Text>
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
                      <Text style={styles.totalPrice}>
                        Total: ${item.total.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
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
});
