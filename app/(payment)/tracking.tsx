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
  Image,
  Linking,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Query } from "react-native-appwrite";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import {
  addOrderToHistory,
  setTrackingStatus,
} from "../../store/slices/orderSlice";
import { RootState } from "../../store/store";
import AppwriteService, {
  APPWRITE_DATABASE_ID,
  APPWRITE_USERS_COLLECTION_ID,
} from "../lib/services/auth_services/appwrite";
import { CartContext } from "../lib/services/cart_services/CartContext";
import { images } from "@/constants";

const { height } = Dimensions.get("window");
const appwrite = new AppwriteService();

type PickupBranchSnapshot = {
  pickupBranchId?: string | null;
  pickupBranchName?: string | null;
  pickupBranchAddress?: string | null;
  pickupBranchLat?: string | number | null;
  pickupBranchLng?: string | number | null;
  pickupBranchLong?: string | number | null;
};

const DEFAULT_PICKUP_BRANCH = {
  latitude: 20.6125,
  longitude: 72.9152,
  name: "Burger & Pizza Bistro",
};

const toValidCoordinate = (value?: string | number | null) => {
  const coordinate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(coordinate) && coordinate !== 0 ? coordinate : null;
};

const formatBranchAddress = (branch: any) =>
  [branch?.flatHouseNo, branch?.address].filter(Boolean).join(", ");

const normalizeSearchText = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/['’]s/g, "")
    .trim();

export default function TrackingScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const mapRef = useRef<MapView>(null);
  const { clearCart } = useContext(CartContext);
  const insets = useSafeAreaInsets();

  // Helper: Geodesic distance calculation using Haversine formula
  const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Clear cart items on mount to avoid unmounting race conditions in checkout
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  // Redux state
  const { currentOrder, trackingStatus } = useSelector(
    (state: RootState) => state.order,
  );
  const locationState = useSelector((state: RootState) => state.location);
  const addressText = currentOrder?.address || "Selected Delivery Location";

  // Live order document fetched dynamically from Appwrite
  const [dbOrder, setDbOrder] = useState<any | null>(null);
  const [resolvedPickupBranch, setResolvedPickupBranch] =
    useState<PickupBranchSnapshot | null>(null);

  // Dynamic pickup branch restaurant coordinates resolved from live DB or Redux checkout
  const activeOrder = dbOrder || currentOrder;
  const firstOrderItem = activeOrder?.items?.[0];

  const destLat =
    toValidCoordinate(activeOrder?.userLat) ??
    locationState.latitude ??
    20.5992;
  const destLng =
    toValidCoordinate(activeOrder?.userLong) ??
    toValidCoordinate(activeOrder?.userLng) ??
    locationState.longitude ??
    72.9342;

  const restaurantLat =
    toValidCoordinate(activeOrder?.pickupBranchLat) ??
    toValidCoordinate(resolvedPickupBranch?.pickupBranchLat) ??
    toValidCoordinate(firstOrderItem?.pickupBranchLat) ??
    DEFAULT_PICKUP_BRANCH.latitude;
  const restaurantLng =
    toValidCoordinate(activeOrder?.pickupBranchLong) ??
    toValidCoordinate(activeOrder?.pickupBranchLng) ??
    toValidCoordinate(resolvedPickupBranch?.pickupBranchLng) ??
    toValidCoordinate(firstOrderItem?.pickupBranchLng) ??
    DEFAULT_PICKUP_BRANCH.longitude;
  const restaurantName =
    activeOrder?.pickupBranchName ||
    resolvedPickupBranch?.pickupBranchName ||
    firstOrderItem?.pickupBranchName ||
    DEFAULT_PICKUP_BRANCH.name;

  // Rider coordinate state (starts at restaurant pickup point)
  const [riderCoords, setRiderCoords] = useState({
    latitude: restaurantLat,
    longitude: restaurantLng,
  });

  // Dynamic road route coordinates fetched from OSRM
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);

  // Fetch actual road routing coordinates dynamically from OpenStreetMap's OSRM API
  useEffect(() => {
    let active = true;
    const fetchRoadRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${restaurantLng},${restaurantLat};${destLng},${destLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const json = await res.json();
        if (active && json?.routes && json.routes.length > 0) {
          const coords = json.routes[0].geometry.coordinates.map((pt: any) => ({
            latitude: pt[1],
            longitude: pt[0],
          }));
          setRouteCoordinates(coords);
        } else if (active) {
          // fallback to direct line
          setRouteCoordinates([
            { latitude: restaurantLat, longitude: restaurantLng },
            { latitude: destLat, longitude: destLng },
          ]);
        }
      } catch (err) {
        console.log("Failed to fetch road routing from OSRM: ", err);
        if (active) {
          setRouteCoordinates([
            { latitude: restaurantLat, longitude: restaurantLng },
            { latitude: destLat, longitude: destLng },
          ]);
        }
      }
    };

    fetchRoadRoute();
    return () => {
      active = false;
    };
  }, [restaurantLat, restaurantLng, destLat, destLng]);

  const [animationStep, setAnimationStep] = useState(0);
  const [currentDbStatus, setCurrentDbStatus] = useState<string>("pending");

  useEffect(() => {
    const hasOrderPickup =
      toValidCoordinate(activeOrder?.pickupBranchLat) !== null &&
      toValidCoordinate(activeOrder?.pickupBranchLng) !== null;

    if (hasOrderPickup) {
      setResolvedPickupBranch(null);
      return;
    }

    const resolvePickupBranchFromItem = async () => {
      try {
        const item = firstOrderItem;
        if (!item?.id) return;

        const menuItemDoc = await appwrite.getMenuItem(item.id);
        let ownerId =
          (menuItemDoc as any)?.userId ||
          (menuItemDoc as any)?.managerId ||
          (menuItemDoc as any)?.hotelId ||
          (item as any)?.userId;

        if (!ownerId) {
          const itemText = normalizeSearchText(item.name);
          const brandQuery = itemText.split(" ")[0];
          const managersRes = await appwrite.database.listRows({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: APPWRITE_USERS_COLLECTION_ID,
            queries: [Query.equal("role", "manager")],
          });
          const managers = managersRes?.rows || [];
          const matchedManager = managers.find((manager: any) => {
            const managerName = normalizeSearchText(manager.name);
            return (
              (brandQuery && managerName.includes(brandQuery)) ||
              itemText.includes(managerName)
            );
          });
          ownerId = matchedManager?.$id || managers[0]?.$id;
        }

        if (!ownerId) return;

        const branches = await appwrite.getUserAddresses(ownerId);
        const branchesWithCoords = branches.filter(
          (branch: any) =>
            toValidCoordinate(branch.latitude) !== null &&
            toValidCoordinate(branch.longitude) !== null,
        );

        if (branchesWithCoords.length === 0) return;

        const requestedBranchId =
          activeOrder?.pickupBranchId || firstOrderItem?.pickupBranchId;
        const itemName = normalizeSearchText(item.name);
        const selectedBranch =
          branchesWithCoords.find(
            (branch: any) => branch.$id === requestedBranchId,
          ) ||
          branchesWithCoords.find((branch: any) =>
            normalizeSearchText(branch.branchName).includes("main"),
          ) ||
          branchesWithCoords.find((branch: any) => {
            const branchText = normalizeSearchText(
              `${branch.branchName} ${branch.address}`,
            );
            return itemName && branchText.includes(itemName.split(" ")[0]);
          }) ||
          branchesWithCoords[0];

        setResolvedPickupBranch({
          pickupBranchId: selectedBranch.$id,
          pickupBranchName:
            selectedBranch.branchName ||
            (menuItemDoc as any)?.hotelName ||
            (menuItemDoc as any)?.restaurantName ||
            firstOrderItem?.pickupBranchName ||
            DEFAULT_PICKUP_BRANCH.name,
          pickupBranchAddress: formatBranchAddress(selectedBranch),
          pickupBranchLat: selectedBranch.latitude,
          pickupBranchLng: selectedBranch.longitude,
        });
      } catch (err) {
        console.log("Error resolving pickup branch for tracking:", err);
      }
    };

    resolvePickupBranchFromItem();
  }, [
    activeOrder?.id,
    activeOrder?.$id,
    activeOrder?.pickupBranchId,
    activeOrder?.pickupBranchLat,
    activeOrder?.pickupBranchLng,
    firstOrderItem?.id,
    firstOrderItem,
    firstOrderItem?.name,
    firstOrderItem?.pickupBranchId,
    firstOrderItem?.pickupBranchName,
  ]);

  // 1. Real-time DB polling (every 2 seconds) to get status changes from Appwrite
  useEffect(() => {
    const orderDbId = currentOrder?.$id;
    if (!orderDbId) return;

    // Trigger immediate check on mount
    const checkStatus = async () => {
      try {
        const orderData = await appwrite.getOrder(orderDbId);
        if (orderData) {
          setDbOrder(orderData);
          const dbStatus = orderData.status || "pending";
          setCurrentDbStatus(dbStatus);
          if ((dbStatus === "pending" || dbStatus === "preparing" || dbStatus === "ready") && trackingStatus !== "preparing") {
            dispatch(setTrackingStatus("preparing"));
          } else if (dbStatus === "picked_up" && trackingStatus !== "delivering") {
            dispatch(setTrackingStatus("delivering"));
          } else if (dbStatus === "delivered" && trackingStatus !== "delivered") {
            dispatch(setTrackingStatus("delivered"));
            dispatch(
              addOrderToHistory({
                ...currentOrder,
                status: "delivered",
                timestamp: new Date().toISOString(),
              }),
            );
          }
        }
      } catch (err) {
        console.log("Error polling status on mount: ", err);
      }
    };
    checkStatus();

    const interval = setInterval(async () => {
      try {
        const orderData = await appwrite.getOrder(orderDbId);
        if (orderData) {
          setDbOrder(orderData);
          const dbStatus = orderData.status || "pending";
          setCurrentDbStatus(dbStatus);
          if ((dbStatus === "pending" || dbStatus === "preparing" || dbStatus === "ready") && trackingStatus !== "preparing") {
            dispatch(setTrackingStatus("preparing"));
          } else if (dbStatus === "picked_up" && trackingStatus !== "delivering") {
            dispatch(setTrackingStatus("delivering"));
          } else if (dbStatus === "delivered" && trackingStatus !== "delivered") {
            dispatch(setTrackingStatus("delivered"));
            dispatch(
              addOrderToHistory({
                ...currentOrder,
                status: "delivered",
                timestamp: new Date().toISOString(),
              }),
            );
          }
        }
      } catch (err) {
        console.log("Error polling order status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentOrder, currentOrder?.$id, trackingStatus, dispatch]);

  // 2. Setup rider animation increment interval when picking up
  useEffect(() => {
    if (trackingStatus === "delivering") {
      const steps = 30; // 30 increments
      const intervalTime = 1000; // update position every 1 second
      
      const interval = setInterval(() => {
        setAnimationStep((prev) => {
          const next = prev + 1;
          if (next >= steps) {
            clearInterval(interval);
            return steps;
          }
          return next;
        });
      }, intervalTime);

      return () => clearInterval(interval);
    } else {
      // If preparing, rider sits statically at pickup restaurant. If delivered, sits at customer dropoff.
      setRiderCoords({
        latitude: trackingStatus === "delivered" ? destLat : restaurantLat,
        longitude: trackingStatus === "delivered" ? destLng : restaurantLng,
      });
      setAnimationStep(0);
    }
  }, [trackingStatus, destLat, destLng, restaurantLat, restaurantLng]);

  // 3. Interpolate rider position dynamically via LERP step increments along OSRM road coordinates
  useEffect(() => {
    if (trackingStatus === "delivering") {
      const steps = 30;
      const ratio = animationStep / steps;

      let newCoords = { latitude: destLat, longitude: destLng };
      if (routeCoordinates.length > 1) {
        const index = Math.min(
          Math.floor(ratio * (routeCoordinates.length - 1)),
          routeCoordinates.length - 1
        );
        newCoords = routeCoordinates[index];
      } else {
        const newLat = restaurantLat + (destLat - restaurantLat) * ratio;
        const newLng = restaurantLng + (destLng - restaurantLng) * ratio;
        newCoords = { latitude: newLat, longitude: newLng };
      }
      setRiderCoords(newCoords);
    }
  }, [animationStep, trackingStatus, destLat, destLng, restaurantLat, restaurantLng, routeCoordinates]);

  // 3b. Dynamic camera auto-fit to keep rider and destination in viewport, and zoom in closely on arrival/delivered
  useEffect(() => {
    if (mapRef.current && riderCoords) {
      const dist = getDistanceInKm(
        riderCoords.latitude,
        riderCoords.longitude,
        destLat,
        destLng
      );

      if (dist < 0.05 || trackingStatus === "delivered") {
        // Zoom in closely on the arrived destination
        mapRef.current.animateToRegion(
          {
            latitude: destLat,
            longitude: destLng,
            latitudeDelta: 0.0035,
            longitudeDelta: 0.0035,
          },
          1000
        );
      } else {
        // Keep both the moving rider and the destination inside the frame
        mapRef.current.fitToCoordinates(
          [
            { latitude: riderCoords.latitude, longitude: riderCoords.longitude },
            { latitude: destLat, longitude: destLng },
          ],
          {
            edgePadding: {
              top: Platform.OS === "ios" ? 140 : 160,
              right: 80,
              bottom: Platform.OS === "ios" ? 280 : 300,
              left: Platform.OS === "ios" ? 80 : 140,
            },
            animated: true,
          }
        );
      }
    }
  }, [riderCoords?.latitude, riderCoords?.longitude, destLat, destLng, trackingStatus]);

  // 4. Auto-fit both restaurant and customer dropoff markers on mount to guarantee viewport framing
  useEffect(() => {
    if (mapRef.current) {
      if (trackingStatus === "delivered") {
        return;
      }
      const timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(
            [
              { latitude: restaurantLat, longitude: restaurantLng }, // restaurant pickup
              { latitude: destLat, longitude: destLng }, // customer dropoff
            ],
            {
              edgePadding: {
                top: Platform.OS === "ios" ? 140 : 160,
                right: 80,
                bottom: Platform.OS === "ios" ? 280 : 300,
                left: Platform.OS === "ios" ? 80 : 140,
              },
              animated: true,
            }
          );
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [destLat, destLng, restaurantLat, restaurantLng, trackingStatus]);

  const handleFinish = () => {
    router.replace({ pathname: "/profile", params: { showHistory: "true" } } as any); // Navigate to Profile history tab
  };

  // Step Status Header Text
  const getStatusText = () => {
    switch (currentDbStatus) {
      case "pending":
        return "Waiting for restaurant to accept your order... ⏳";
      case "preparing":
        return "Chef is cooking your delicious meal... 🍳";
      case "ready":
        return "Food is ready! Waiting for rider assignment... 🛵";
      case "picked_up":
        return "Rider is speeding to your doorstep! 🛵";
      case "delivered":
        return "Order Delivered! Enjoy your food! 🎉";
      default:
        return "Locating restaurant and rider...";
    }
  };

  // Slice the OSRM path dynamically based on rider LERP animation progress
  const riderIndex = routeCoordinates.length > 1
    ? Math.min(
        Math.floor((animationStep / 30) * (routeCoordinates.length - 1)),
        routeCoordinates.length - 1
      )
    : 0;

  const traveledPath = routeCoordinates.length > 1
    ? routeCoordinates.slice(0, riderIndex + 1)
    : [{ latitude: restaurantLat, longitude: restaurantLng }, riderCoords];

  const remainingPath = routeCoordinates.length > 1
    ? routeCoordinates.slice(riderIndex)
    : [riderCoords, { latitude: destLat, longitude: destLng }];

  const fallbackPath = routeCoordinates.length > 1
    ? routeCoordinates
    : [{ latitude: restaurantLat, longitude: restaurantLng }, { latitude: destLat, longitude: destLng }];

  return (
    <View style={styles.container}>
      {/* Back to Home Button overlay */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace({ pathname: "/profile", params: { showHistory: "true" } } as any)}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>

      {/* Google/Apple Maps display */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: (restaurantLat + destLat) / 2,
          longitude: (restaurantLng + destLng) / 2,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
      >
        {/* Restaurant Pickup Marker */}
        <Marker
          coordinate={{ latitude: restaurantLat, longitude: restaurantLng }}
          title={restaurantName}
          description="Pickup Restaurant"
        >
          <View style={styles.restaurantMarkerContainer}>
            <View style={styles.restaurantMarker}>
              <Ionicons name="restaurant" size={14} color="#fff" />
            </View>
            <View style={styles.restaurantShadow} />
          </View>
        </Marker>

        {/* Destination Home Marker */}
        <Marker
          coordinate={{ latitude: destLat, longitude: destLng }}
          title="Deliver To"
          description={addressText}
        >
          <View style={styles.homeMarkerContainer}>
            <View style={styles.homeMarker}>
              <Ionicons name="home" size={16} color="#fff" />
            </View>
            <View style={styles.homeShadow} />
          </View>
        </Marker>

        {/* 1. Traveled Path: Dashed Slate-Grey Polyline */}
        {trackingStatus === "delivering" && (
          <Polyline
            coordinates={traveledPath}
            strokeColor="#94a3b8"
            strokeWidth={4}
            lineDashPattern={[6, 6]}
          />
        )}

        {/* 2. Remaining Path: Solid High-Contrast Orange Line */}
        {trackingStatus === "delivering" && (
          <Polyline
            coordinates={remainingPath}
            strokeColor="#f97316"
            strokeWidth={5}
          />
        )}

        {/* 3. Base Fallback Path (if Rider Coords are not animating yet) */}
        {trackingStatus === "preparing" && (
          <Polyline
            coordinates={fallbackPath}
            strokeColor="#f97316"
            strokeWidth={4}
            lineDashPattern={[6, 6]}
          />
        )}

        {/* Transparent 3D Scooter Rider Marker */}
        {riderCoords && Platform.OS === "android" && (
          <Marker
            coordinate={riderCoords}
            anchor={{ x: 0.5, y: 0.82 }}
            image={images.rider3d}
            zIndex={999}
          />
        )}

        {riderCoords && Platform.OS !== "android" && (
          <Marker
            coordinate={riderCoords}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}
            tracksViewChanges={false}
          >
            <View
              collapsable={false}
              renderToHardwareTextureAndroid
              style={styles.riderImageMarker}
            >
              <Image
                source={images.rider3d}
                style={styles.rider3dImage}
                resizeMode="contain"
                fadeDuration={0}
              />
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
      <View
        style={[
          styles.card,
          {
            bottom: Platform.OS === "ios" ? Math.max(insets.bottom + 10, 28) : 18,
            paddingBottom: Platform.OS === "ios" ? 22 : 18,
          },
        ]}
      >
        <View style={styles.dragHandle} />

        {/* Progress Tracker Steps */}
        <View style={styles.stepsRow}>
          <View style={styles.stepItem}>
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                trackingStatus === "preparing" || trackingStatus === "delivering" || trackingStatus === "delivered" ? "bg-orange-500" : "bg-gray-200"
              }`}
            >
              <Ionicons name="restaurant" size={14} color="#fff" />
            </View>
            <Text style={styles.stepText} className="text-gray-800">
              Preparing
            </Text>
          </View>

          <View
            style={[
              styles.stepLine,
              trackingStatus === "delivering" || trackingStatus === "delivered" ? styles.stepLineActive : {},
            ]}
          />

          <View style={styles.stepItem}>
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                trackingStatus === "delivering" || trackingStatus === "delivered" ? "bg-orange-500" : "bg-gray-200"
              }`}
            >
              <Ionicons name="bicycle" size={14} color="#fff" />
            </View>
            <Text
              style={styles.stepText}
              className={trackingStatus === "delivering" || trackingStatus === "delivered" ? "text-gray-800" : "text-gray-400"}
            >
              On the Way
            </Text>
          </View>

          <View
            style={[
              styles.stepLine,
              trackingStatus === "delivered" ? styles.stepLineActive : {},
            ]}
          />

          <View style={styles.stepItem}>
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                trackingStatus === "delivered" ? "bg-orange-500" : "bg-gray-200"
              }`}
            >
              <Ionicons name="checkmark-done" size={14} color="#fff" />
            </View>
            <Text
              style={styles.stepText}
              className={trackingStatus === "delivered" ? "text-gray-800" : "text-gray-400"}
            >
              Delivered
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Rider Details */}
        <View style={styles.riderRow}>
          {trackingStatus === "preparing" ? (
            <>
              <View style={[styles.riderAvatar, { backgroundColor: "#fff7ed" }]}>
                <Ionicons 
                  name={currentDbStatus === "ready" ? "bicycle-outline" : "restaurant-outline"} 
                  size={24} 
                  color="#f97316" 
                />
              </View>
              <View style={styles.riderDetails}>
                <Text style={[styles.riderName, { color: "#f97316", fontFamily: "Quicksand-Bold" }]}>
                  {currentDbStatus === "pending"
                    ? "Waiting for restaurant... ⏳"
                    : currentDbStatus === "preparing"
                    ? "Chef is cooking... 🍳"
                    : "Assigning nearest partner... 🛵"}
                </Text>
                <Text style={styles.riderSubtitle}>
                  {currentDbStatus === "pending"
                    ? "Bistro is verifying your fresh meal order"
                    : currentDbStatus === "preparing"
                    ? "Kitchen is crafting your fresh delicious meal"
                    : "Food is fully ready and cooked for pickup!"}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.riderAvatar}>
                <Ionicons name="person" size={24} color="#f97316" />
              </View>
              <View style={styles.riderDetails}>
                <Text style={styles.riderName}>
                  {currentOrder?.deliveryBoyName || "Vedik Patel"}
                </Text>
                <Text style={styles.riderSubtitle}>
                  {currentOrder?.deliveryBoyPhone ? "Premium delivery partner" : "Stripe delivery partner"}
                </Text>
              </View>
              <View style={styles.riderActionRow}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => Linking.openURL(`tel:${currentOrder?.deliveryBoyPhone || "+919876543210"}`)}
                >
                  <Ionicons name="call" size={18} color="#111827" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => Linking.openURL(`sms:${currentOrder?.deliveryBoyPhone || "+919876543210"}`)}
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color="#111827" />
                </TouchableOpacity>
              </View>
            </>
          )}
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
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
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
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    marginHorizontal: 18,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
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
    marginBottom: 18,
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 6,
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
    marginBottom: 14,
  },
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
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
    marginBottom: 0,
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
  restaurantMarkerContainer: {
    alignItems: "center",
  },
  restaurantMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f97316", // orange for restaurant
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  restaurantShadow: {
    width: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    marginTop: 2,
  },
  riderMarkerOuter: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pulseCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f97316",
    position: "absolute",
  },
  riderAvatarBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 2.5,
    borderColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  riderImageMarker: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    zIndex: 999,
    elevation: 999,
  },
  rider3dImage: {
    width: 76,
    height: 76,
  },
  zomatoPillTag: {
    minWidth: 80,
    backgroundColor: "#ea580c",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fff",
    position: "absolute",
    top: 28,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  zomatoPillText: {
    fontSize: 7,
    color: "#fff",
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
  },
  zomatoPillArrow: {
    position: "absolute",
    top: 40,
    width: 8,
    height: 8,
    backgroundColor: "#ea580c",
    transform: [{ rotate: "45deg" }],
    zIndex: 15,
  },
});
