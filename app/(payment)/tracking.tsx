import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState, useContext } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useDispatch, useSelector } from "react-redux";
import {
  addOrderToHistory,
  setTrackingStatus,
} from "../../store/slices/orderSlice";
import { RootState } from "../../store/store";
import AppwriteService from "../lib/services/auth_services/appwrite";
import CartContext from "../lib/services/cart_services/CartContext";

const { height } = Dimensions.get("window");
const appwrite = new AppwriteService();

export default function TrackingScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const mapRef = useRef<MapView>(null);
  const { clearCart } = useContext(CartContext);

  // Clear cart items on mount to avoid unmounting race conditions in checkout
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  // Redux state
  const { currentOrder, trackingStatus } = useSelector(
    (state: RootState) => state.order,
  );
  const locationState = useSelector((state: RootState) => state.location);

  // Fallback coordinates if missing
  const destLat = locationState.latitude || 37.78825;
  const destLng = locationState.longitude || -122.4324;
  const addressText = currentOrder?.address || "Selected Delivery Location";

  // Simulated courier coordinate state
  const [courierCoords, setCourierCoords] = useState({
    latitude: destLat + 0.003,
    longitude: destLng + 0.003,
  });

  // Track progress timing
  const [seconds, setSeconds] = useState(0);

  // Auto-simulate order lifecycle step-by-step
  useEffect(() => {
    let interval: any;
    interval = setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        if (next === 4) {
          dispatch(setTrackingStatus("delivering"));
        } else if (next === 9) {
          dispatch(setTrackingStatus("delivered"));
          if (interval) clearInterval(interval);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [dispatch]);

  // Animate courier bike marker towards destination during delivery
  useEffect(() => {
    if (trackingStatus === "delivering") {
      const steps = 5; // moves over 5 seconds
      const startLat = destLat + 0.003;
      const startLng = destLng + 0.003;
      let currentStep = seconds - 4;

      if (currentStep <= steps) {
        const ratio = currentStep / steps;
        const newLat = startLat + (destLat - startLat) * ratio;
        const newLng = startLng + (destLng - startLng) * ratio;

        const newCoords = { latitude: newLat, longitude: newLng };
        setCourierCoords(newCoords);

        // Center map to keep both pins visible
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(
            [{ latitude: destLat, longitude: destLng }, newCoords],
            {
              edgePadding: { top: 120, right: 80, bottom: 250, left: 80 },
              animated: true,
            },
          );
        }
      }
    } else if (trackingStatus === "delivered") {
      // Ensure Courier sits exactly on the destination pin
      setCourierCoords({ latitude: destLat, longitude: destLng });

      // Save order to Appwrite and Redux completed list
      if (currentOrder) {
        (async () => {
          // Post order to Appwrite
          const appwriteDoc = await appwrite.createOrder(currentOrder);

          // Fall back or add directly to local state
          dispatch(
            addOrderToHistory({
              ...currentOrder,
              timestamp: new Date().toISOString(),
            }),
          );
        })();
      }
    }
  }, [seconds, trackingStatus]);

  const handleFinish = () => {
    router.replace("/profile" as any); // Navigate to Profile history tab
  };

  // Step Status Header Text
  const getStatusText = () => {
    switch (trackingStatus) {
      case "preparing":
        return "Chef is cooking your delicious meal... 🍳";
      case "delivering":
        return "Rider is speeding to your doorstep! 🛵";
      case "delivered":
        return "Order Delivered! Enjoy your food! 🎉";
      default:
        return "Locating restaurant and courier...";
    }
  };

  return (
    <View style={styles.container}>
      {/* Back to Home Button overlay */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace("/" as any)}
      >
        <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
      </TouchableOpacity>

      {/* Google/Apple Maps display */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: (destLat + courierCoords.latitude) / 2,
          longitude: (destLng + courierCoords.longitude) / 2,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
      >
        {/* Destination Home Marker */}
        <Marker
          coordinate={{ latitude: destLat, longitude: destLng }}
          title="Deliver To"
        >
          <View style={styles.homeMarkerContainer}>
            <View style={styles.homeMarker}>
              <Ionicons name="home" size={16} color="#fff" />
            </View>
            <View style={styles.homeShadow} />
          </View>
        </Marker>

        {/* Courier Bike Marker */}
        {trackingStatus !== "delivered" && (
          <Marker coordinate={courierCoords} title="Courier Rider">
            <View style={styles.bikeMarkerContainer}>
              <View style={styles.bikeMarker}>
                <Ionicons name="bicycle" size={18} color="#fff" />
              </View>
              <View style={styles.bikeShadow} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Floating Header Banner */}
      <View style={styles.statusBarBanner}>
        <Text style={styles.statusBannerText} numberOfLines={1}>
          {getStatusText()}
        </Text>
      </View>

      {/* Bottom Tracking Status Sheet */}
      <View style={styles.card}>
        <View style={styles.dragHandle} />

        {/* Progress Tracker Steps */}
        <View style={styles.stepsRow}>
          <View style={styles.stepItem}>
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                seconds >= 0 ? "bg-orange-500" : "bg-gray-200"
              }`}
            >
              <Ionicons name="restaurant" size={14} color="#fff" />
            </View>
            <Text style={styles.stepText} className="text-gray-800">
              Preparing
            </Text>
          </View>

          <View
            style={[styles.stepLine, seconds >= 4 ? styles.stepLineActive : {}]}
          />

          <View style={styles.stepItem}>
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                seconds >= 4 ? "bg-orange-500" : "bg-gray-200"
              }`}
            >
              <Ionicons name="bicycle" size={14} color="#fff" />
            </View>
            <Text
              style={styles.stepText}
              className={seconds >= 4 ? "text-gray-800" : "text-gray-400"}
            >
              On the Way
            </Text>
          </View>

          <View
            style={[styles.stepLine, seconds >= 9 ? styles.stepLineActive : {}]}
          />

          <View style={styles.stepItem}>
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                seconds >= 9 ? "bg-orange-500" : "bg-gray-200"
              }`}
            >
              <Ionicons name="checkmark-done" size={14} color="#fff" />
            </View>
            <Text
              style={styles.stepText}
              className={seconds >= 9 ? "text-gray-800" : "text-gray-400"}
            >
              Delivered
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Courier Details */}
        <View style={styles.riderRow}>
          <View style={styles.riderAvatar}>
            <Ionicons name="person" size={24} color="#f97316" />
          </View>
          <View style={styles.riderDetails}>
            <Text style={styles.riderName}>Ramesh Kumar</Text>
            <Text style={styles.riderSubtitle}>Stripe delivery partner</Text>
          </View>
          <View style={styles.riderActionRow}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="call" size={18} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.addressRow}>
          <Ionicons
            name="pin"
            size={18}
            color="#f97316"
            style={{ marginTop: 2 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressTitle}>Delivery Address</Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {addressText}
            </Text>
          </View>
        </View>

        {/* Finish / View History button */}
        {trackingStatus === "delivered" && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleFinish}
            activeOpacity={0.85}
          >
            <Ionicons name="journal-outline" size={20} color="#fff" />
            <Text style={styles.confirmButtonText}>View Order History</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    width: "100%",
    height: height,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 16,
    zIndex: 20,
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
  statusBarBanner: {
    position: "absolute",
    top: 50,
    left: 76,
    right: 16,
    zIndex: 10,
    backgroundColor: "#111827",
    borderRadius: 22,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  statusBannerText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Quicksand-Bold",
  },
  homeMarkerContainer: {
    alignItems: "center",
  },
  homeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#10b981", // green for home
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  homeShadow: {
    width: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginTop: 2,
  },
  bikeMarkerContainer: {
    alignItems: "center",
  },
  bikeMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f97316", // orange for rider
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  bikeShadow: {
    width: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginTop: 2,
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
    zIndex: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e5e7eb",
    alignSelf: "center",
    marginBottom: 20,
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  stepItem: {
    alignItems: "center",
    gap: 6,
  },
  stepText: {
    fontSize: 11,
    fontFamily: "Quicksand-Bold",
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 8,
    marginTop: -16,
  },
  stepLineActive: {
    backgroundColor: "#f97316",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginBottom: 16,
  },
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffedd5",
    alignItems: "center",
    justifyContent: "center",
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontFamily: "Quicksand-Bold",
    color: "#111827",
  },
  riderSubtitle: {
    fontSize: 12,
    fontFamily: "Quicksand-Medium",
    color: "#9ca3af",
  },
  riderActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 16,
    marginBottom: 20,
  },
  addressTitle: {
    fontSize: 12,
    fontFamily: "Quicksand-Bold",
    color: "#9ca3af",
    marginBottom: 2,
  },
  addressText: {
    fontSize: 13,
    fontFamily: "Quicksand-Medium",
    color: "#374151",
    lineHeight: 18,
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
