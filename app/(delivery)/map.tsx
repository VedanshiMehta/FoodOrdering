import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
import {
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  View,
  Image,
  Animated,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { APPWRITE_DATABASE_ID } from "../lib/services/auth_services/appwrite";
import { DeliveryContext } from "./_layout";
import { images } from "@/constants";

const DEFAULT_RIDER_OFFSET = 0.006;

export default function DeliveryMapScreen() {
  const router = useRouter();
  const { appwrite, user } = useContext(AppwriteContext);
  const { selectedOrderForMap, setSelectedOrderForMap, customerCoords, mapOriginTab } = useContext(DeliveryContext);

  const [isUpdating, setIsUpdating] = useState(false);
  const scaleValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const showAnimatedSuccess = () => {
    setShowSuccessModal(true);
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const mapRef = useRef<MapView>(null);

  // Rider coordinates, tracking mode, and animation step for live tracking
  const [riderCoords, setRiderCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [riderStartCoords, setRiderStartCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trackingMode, setTrackingMode] = useState<"simulation" | "gps">("simulation");
  const [animationStep, setAnimationStep] = useState(0);

  const gpsSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Map coordinates configuration
  const getCoordinates = (order: any) => {
    const defaultResLat = 20.6125;
    const defaultResLng = 72.9152;
    const defaultCustLat = 20.5992;
    const defaultCustLng = 72.9342;

    const firstItem = order?.items?.[0];
    const pickupLat = parseFloat(order?.pickupBranchLat || firstItem?.pickupBranchLat) || defaultResLat;
    const pickupLng = parseFloat(order?.pickupBranchLong || order?.pickupBranchLng || firstItem?.pickupBranchLong || firstItem?.pickupBranchLng) || defaultResLng;
    const pickupName = order?.pickupBranchName || firstItem?.pickupBranchName || "Restaurant (Pickup)";
    const pickupAddr = order?.pickupBranchAddress || firstItem?.pickupBranchAddress || "Burger & Pizza Bistro, Main Ave";

    const dropLat = parseFloat(order?.userLat) || customerCoords?.latitude || defaultCustLat;
    const dropLng = parseFloat(order?.userLong || order?.userLng) || customerCoords?.longitude || defaultCustLng;

    return {
      pickup: {
        latitude: pickupLat,
        longitude: pickupLng,
        name: pickupName,
        address: pickupAddr,
      },
      drop: {
        latitude: dropLat,
        longitude: dropLng,
        name: order?.userName || "Customer (Dropoff)",
        address: order?.address || "Delivery Address",
      },
    };
  };

  const mapCoords = useMemo(() => {
    return selectedOrderForMap ? getCoordinates(selectedOrderForMap) : null;
  }, [
    selectedOrderForMap?.$id,
    selectedOrderForMap?.pickupBranchLat,
    selectedOrderForMap?.pickupBranchLong,
    selectedOrderForMap?.pickupBranchLng,
    selectedOrderForMap?.userLat,
    selectedOrderForMap?.userLong,
    selectedOrderForMap?.userLng,
    customerCoords?.latitude,
    customerCoords?.longitude,
  ]);

  const isActiveDelivery =
    selectedOrderForMap?.status === "picked_up" ||
    selectedOrderForMap?.status === "delivered" ||
    mapOriginTab === "active";

  // Resolve start and end coordinates based on current phase (pickup vs active transit)
  const routePoints = useMemo(() => {
    if (!mapCoords) return null;
    if (isActiveDelivery) {
      // Active delivery: from hotel pickup outlet to customer home.
      return {
        start: mapCoords.pickup,
        end: mapCoords.drop,
      };
    } else {
      // Pickup phase: from rider current location to hotel pickup outlet.
      const startLat =
        riderStartCoords?.latitude ??
        mapCoords.pickup.latitude - DEFAULT_RIDER_OFFSET;
      const startLng =
        riderStartCoords?.longitude ??
        mapCoords.pickup.longitude - DEFAULT_RIDER_OFFSET;
      return {
        start: { latitude: startLat, longitude: startLng },
        end: mapCoords.pickup,
      };
    }
  }, [mapCoords, isActiveDelivery, riderStartCoords?.latitude, riderStartCoords?.longitude]);

  // Dynamic road route coordinates fetched from OSRM
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);

  useEffect(() => {
    let active = true;
    const fetchRoadRoute = async () => {
      if (!routePoints) return;
      try {
        const startLat = routePoints.start.latitude;
        const startLng = routePoints.start.longitude;
        const endLat = routePoints.end.latitude;
        const endLng = routePoints.end.longitude;

        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
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
          setRouteCoordinates([routePoints.start, routePoints.end]);
        }
      } catch (err) {
        console.log("Failed to fetch road routing from OSRM: ", err);
        if (active && routePoints) {
          setRouteCoordinates([routePoints.start, routePoints.end]);
        }
      }
    };

    fetchRoadRoute();
    return () => {
      active = false;
    };
  }, [routePoints?.start?.latitude, routePoints?.start?.longitude, routePoints?.end?.latitude, routePoints?.end?.longitude]);

  const handleBack = () => {
    router.replace("/(delivery)" as any);
  };

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

  // Helper: Angle bearing calculation to rotate bike icon along the route
  const getBearing = (
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number }
  ) => {
    const startLat = (start.latitude * Math.PI) / 180;
    const startLng = (start.longitude * Math.PI) / 180;
    const endLat = (end.latitude * Math.PI) / 180;
    const endLng = (end.longitude * Math.PI) / 180;

    const dLng = endLng - startLng;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x =
      Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    let brng = Math.atan2(y, x);
    brng = (brng * 180) / Math.PI;
    return (brng + 360) % 360;
  };

  // 1. Load rider's current GPS for pickup route start.
  useEffect(() => {
    let cancelled = false;

    const loadInitialRiderLocation = async () => {
      if (!mapCoords || isActiveDelivery) return;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        const coords = {
          latitude: initialLoc.coords.latitude,
          longitude: initialLoc.coords.longitude,
        };
        setRiderStartCoords(coords);
        setRiderCoords(coords);
      } catch (err) {
        console.log("Initial rider location fetch failed: ", err);
      }
    };

    loadInitialRiderLocation();

    return () => {
      cancelled = true;
    };
  }, [mapCoords?.pickup.latitude, mapCoords?.pickup.longitude, isActiveDelivery]);

  // 2. GPS Tracking Integration
  useEffect(() => {
    const startGpsTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Location Permission Required",
            "Please grant location permissions in settings to enable real-time GPS delivery tracking."
          );
          setTrackingMode("simulation");
          return;
        }

        // Get initial lock on location
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          latitude: initialLoc.coords.latitude,
          longitude: initialLoc.coords.longitude,
        };
        setRiderStartCoords(coords);
        setRiderCoords(coords);

        // Subscribe to live GPS coordinates watch
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (location) => {
            const newCoords = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            setRiderCoords(newCoords);

            // Keep rider and target within map bounds
            if (mapRef.current && routePoints) {
              mapRef.current.fitToCoordinates(
                [
                  newCoords,
                  { latitude: routePoints.end.latitude, longitude: routePoints.end.longitude },
                ],
                {
                  edgePadding: {
                    top: Platform.OS === "ios" ? 120 : 140,
                    right: 60,
                    bottom: Platform.OS === "ios" ? 220 : 240,
                    left: 60,
                  },
                  animated: true,
                }
              );
            }
          }
        );
        gpsSubscriptionRef.current = sub;
      } catch (err) {
        console.log("GPS Location tracking activation failed: ", err);
        setTrackingMode("simulation");
      }
    };

    if (trackingMode === "gps") {
      startGpsTracking();
    } else {
      if (gpsSubscriptionRef.current) {
        gpsSubscriptionRef.current.remove();
        gpsSubscriptionRef.current = null;
      }
    }

    return () => {
      if (gpsSubscriptionRef.current) {
        gpsSubscriptionRef.current.remove();
        gpsSubscriptionRef.current = null;
      }
    };
  }, [trackingMode, selectedOrderForMap?.status, selectedOrderForMap?.$id, routePoints]);

  // 2. Initialize and simulate rider coordinate progression
  useEffect(() => {
    const shouldSimulate = 
      selectedOrderForMap?.status === "picked_up" || 
      selectedOrderForMap?.status === "ready" ||
      selectedOrderForMap?.status === "pending";

    if (shouldSimulate && trackingMode === "simulation") {
      setAnimationStep(0);
      const steps = 30; // 30 LERP increments
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
      setAnimationStep(0);
    }
  }, [selectedOrderForMap?.status, selectedOrderForMap?.$id, trackingMode]);

  // Interpolate rider coordinates in simulation mode
  useEffect(() => {
    if (routePoints) {
      const shouldSimulate = 
        selectedOrderForMap?.status === "picked_up" || 
        selectedOrderForMap?.status === "ready" ||
        selectedOrderForMap?.status === "pending";

      if (shouldSimulate && trackingMode === "simulation") {
        const steps = 30;
        const ratio = animationStep / steps;
        const start = routePoints.start;
        const end = routePoints.end;

        let newCoords = { latitude: end.latitude, longitude: end.longitude };
        if (routeCoordinates.length > 1) {
          const index = Math.min(
            Math.floor(ratio * (routeCoordinates.length - 1)),
            routeCoordinates.length - 1
          );
          newCoords = routeCoordinates[index];
        } else {
          const newLat = start.latitude + (end.latitude - start.latitude) * ratio;
          const newLng = start.longitude + (end.longitude - start.longitude) * ratio;
          newCoords = { latitude: newLat, longitude: newLng };
        }

        setRiderCoords(newCoords);
      } else if (selectedOrderForMap?.status === "delivered") {
        // If delivered, rider sits statically at dropoff
        setRiderCoords({
          latitude: routePoints.end.latitude,
          longitude: routePoints.end.longitude,
        });
      }
    }
  }, [animationStep, trackingMode, routePoints, routeCoordinates, selectedOrderForMap?.status]);

  // Auto-fit both Markers to fit perfectly on the screen
  useEffect(() => {
    if (mapRef.current && routePoints) {
      const dist = riderCoords ? getDistanceInKm(
        riderCoords.latitude,
        riderCoords.longitude,
        routePoints.end.latitude,
        routePoints.end.longitude
      ) : 999;

      if (selectedOrderForMap?.status === "delivered" || dist < 0.05) {
        return;
      }

      const timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(
            [
              { latitude: routePoints.start.latitude, longitude: routePoints.start.longitude },
              { latitude: routePoints.end.latitude, longitude: routePoints.end.longitude },
            ],
            {
              edgePadding: {
                top: Platform.OS === "ios" ? 120 : 140,
                right: 60,
                bottom: Platform.OS === "ios" ? 220 : 240,
                left: 60,
              },
              animated: true,
            }
          );
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedOrderForMap?.$id, selectedOrderForMap?.status, customerCoords]);

  // Dynamic camera auto-fit to keep rider and destination in viewport, and zoom in closely on arrival
  useEffect(() => {
    if (mapRef.current && riderCoords && routePoints) {
      const dist = getDistanceInKm(
        riderCoords.latitude,
        riderCoords.longitude,
        routePoints.end.latitude,
        routePoints.end.longitude
      );

      if (dist < 0.05) {
        // Zoom in closely on the arrived destination
        mapRef.current.animateToRegion(
          {
            latitude: routePoints.end.latitude,
            longitude: routePoints.end.longitude,
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
            { latitude: routePoints.end.latitude, longitude: routePoints.end.longitude },
          ],
          {
            edgePadding: {
              top: Platform.OS === "ios" ? 140 : 160,
              right: 80,
              bottom: Platform.OS === "ios" ? 280 : 300,
              left: 80,
            },
            animated: true,
          }
        );
      }
    }
  }, [riderCoords?.latitude, riderCoords?.longitude, routePoints?.end?.latitude, routePoints?.end?.longitude]);

  const handleUpdateStatus = async (orderId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "picked_up" ? "delivered" : "picked_up";
    const statusLabel = nextStatus === "picked_up" ? "Picked Up" : "Delivered";

    setIsUpdating(true);
    try {
      // Update order status in the Appwrite database
      await appwrite.database.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "orders",
        rowId: orderId,
        data: {
          status: nextStatus,
          deliveryBoyId: user?.$id || "",
          deliveryBoyName: user?.name || "Vedik Patel",
          deliveryBoyPhone: user?.phoneNumber || "+91 98765 43210",
        },
      });

      if (nextStatus === "delivered") {
        // Update shared state in DeliveryContext so UI reacts instantly
        setSelectedOrderForMap({ ...selectedOrderForMap, status: nextStatus });
        showAnimatedSuccess();
      } else {
        Alert.alert(
          "Success", 
          `Order status updated to "${statusLabel}"!`,
          [
            { 
              text: "Okay", 
              onPress: () => setSelectedOrderForMap({ ...selectedOrderForMap, status: nextStatus }) 
            }
          ]
        );
      }
    } catch (err) {
      console.log("Delivery map status update error: ", err);
      // Fallback success for local simulation
      if (nextStatus === "delivered") {
        setSelectedOrderForMap({ ...selectedOrderForMap, status: nextStatus });
        showAnimatedSuccess();
      } else {
        Alert.alert(
          "Updated (Simulation)",
          `Order status has been updated to "${statusLabel}" successfully on local environment!`,
          [
            { 
              text: "Okay", 
              onPress: () => setSelectedOrderForMap({ ...selectedOrderForMap, status: nextStatus }) 
            }
          ]
        );
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetSimulation = () => {
    const shouldSimulate = 
      selectedOrderForMap?.status === "picked_up" || 
      selectedOrderForMap?.status === "ready" ||
      selectedOrderForMap?.status === "pending";

    if (shouldSimulate) {
      setAnimationStep(0);
      if (routePoints) {
        setRiderCoords({
          latitude: routePoints.start.latitude,
          longitude: routePoints.start.longitude,
        });
      }
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
    : (routePoints && riderCoords ? [routePoints.start, riderCoords] : []);

  const remainingPath = routeCoordinates.length > 1
    ? routeCoordinates.slice(riderIndex)
    : (routePoints && riderCoords ? [riderCoords, routePoints.end] : []);

  const fallbackPath = routeCoordinates.length > 1
    ? routeCoordinates
    : (routePoints ? [routePoints.start, routePoints.end] : []);

  // Compute live ETA and remaining distance metrics dynamically
  let displayDistance = "Calculating...";
  let displayEta = "Calculating...";
  let bearing = 0;

  if (riderCoords && routePoints) {
    const distanceKm = getDistanceInKm(
      riderCoords.latitude,
      riderCoords.longitude,
      routePoints.end.latitude,
      routePoints.end.longitude
    );
    displayDistance = distanceKm < 0.05 ? "Arrived" : `${distanceKm.toFixed(2)} km`;
    
    const averageSpeedKmh = 25;
    const timeHr = distanceKm / averageSpeedKmh;
    const timeMin = Math.max(1, Math.round(timeHr * 60));
    displayEta = distanceKm < 0.05 ? "Now" : `${timeMin} mins`;

    // Compute angle bearing to orient the scooter marker along the current road segment
    const nextIndex = routeCoordinates.length > 1 ? Math.min(riderIndex + 1, routeCoordinates.length - 1) : 0;
    const nextPoint = routeCoordinates.length > 1 ? routeCoordinates[nextIndex] : routePoints.end;
    bearing = getBearing(riderCoords, nextPoint);
  }

  return (
    <View className="flex-1 relative bg-white">
      {selectedOrderForMap && mapCoords ? (
        <>
          {/* Floating Header Back Button overlay */}
          <View 
            className="absolute left-5 right-5 flex-row items-center justify-between z-10"
            style={{ top: Platform.OS === 'ios' ? 60 : 40 }}
          >
             <TouchableOpacity
               className="w-[42px] h-[42px] rounded-full border border-gray-100 bg-white items-center justify-center"
               onPress={handleBack}
               activeOpacity={0.7}
             >
               <Ionicons name="arrow-back" size={22} color="#111827" />
             </TouchableOpacity>
            
             <View className="bg-white/95 px-4 h-11 rounded-2xl border border-orange-50 shadow-lg shadow-black/10 items-center justify-center flex-row gap-1">
               <Ionicons name="navigate-circle" size={16} color="#f97316" />
               <Text className="text-xs font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                 Delivery Tracker
               </Text>
             </View>
            
             <View className="w-11" />
          </View>

          {/* Full Screen Map */}
          <MapView
            ref={mapRef}
            style={{ width: "100%", height: "100%" }}
            initialRegion={routePoints ? {
              latitude: (routePoints.start.latitude + routePoints.end.latitude) / 2,
              longitude: (routePoints.start.longitude + routePoints.end.longitude) / 2,
              latitudeDelta: Math.abs(routePoints.start.latitude - routePoints.end.latitude) * 1.5,
              longitudeDelta: Math.abs(routePoints.start.longitude - routePoints.end.longitude) * 1.5,
            } : undefined}
          >
            {/* Pickup Marker */}
            <Marker
              coordinate={{
                latitude: mapCoords.pickup.latitude,
                longitude: mapCoords.pickup.longitude,
              }}
              title={mapCoords.pickup.name}
              description={mapCoords.pickup.address}
            >
              <View className="bg-orange-500 p-2.5 rounded-full border border-white">
                <Ionicons name="restaurant" size={16} color="#fff" />
              </View>
            </Marker>

            {/* Dropoff Marker */}
            {(selectedOrderForMap?.status === "picked_up" || selectedOrderForMap?.status === "delivered") && (
              <Marker
                coordinate={{
                  latitude: mapCoords.drop.latitude,
                  longitude: mapCoords.drop.longitude,
                }}
                title={mapCoords.drop.name}
                description={mapCoords.drop.address}
              >
                <View className="bg-blue-500 p-2.5 rounded-full border border-white">
                  <Ionicons name="home" size={16} color="#fff" />
                </View>
              </Marker>
            )}

            {/* 1. Traveled Path: Dashed Slate-Grey Polyline */}
            {riderCoords && traveledPath.length > 0 && (
              <Polyline
                coordinates={traveledPath}
                strokeColor="#94a3b8"
                strokeWidth={4}
                lineDashPattern={[6, 6]}
              />
            )}

            {/* 2. Remaining Path: Solid High-Contrast Orange Line */}
            {riderCoords && remainingPath.length > 0 && (
              <Polyline
                coordinates={remainingPath}
                strokeColor="#f97316"
                strokeWidth={5}
              />
            )}

            {/* 3. Base Fallback Path (if Rider Coords are not available yet) */}
            {!riderCoords && fallbackPath.length > 0 && (
              <Polyline
                coordinates={fallbackPath}
                strokeColor="#f97316"
                strokeWidth={4}
                lineDashPattern={[6, 6]}
              />
            )}

            {/* Transparent 3D Scooter Rider Marker */}
            {riderCoords && (Platform.OS === "android" ? (
              <Marker
                coordinate={riderCoords}
                anchor={{ x: 0.5, y: 0.82 }}
                image={images.rider3d}
                zIndex={999}
              />
            ) : (
              <Marker
                coordinate={riderCoords}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={999}
                rotation={bearing}
              >
                <View
                  collapsable={false}
                  renderToHardwareTextureAndroid
                  style={{
                    width: 96,
                    height: 96,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "visible",
                  }}
                >
                  <Image
                    source={images.rider3d}
                    style={{
                      width: 76,
                      height: 76,
                    }}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                </View>
              </Marker>
            ))}
          </MapView>

          {/* Floating Route Detail & Control overlay */}
          <View className="absolute bottom-6 left-5 right-5 bg-white rounded-3xl p-5 border border-gray-100 shadow-xl shadow-black/10">
            {/* Top Stat Headers: ETA & Distance */}
            <View className="flex-row items-center justify-between mb-4 border-b border-gray-50 pb-3">
              <View>
                <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                  Estimated Distance
                </Text>
                <Text className="text-base font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                  {displayDistance}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] text-orange-500 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                  Rider ETA
                </Text>
                <Text className="text-base font-bold text-orange-500" style={{ fontFamily: "Quicksand-Bold" }}>
                  {displayEta}
                </Text>
              </View>
            </View>

            {/* Rider Status Card */}
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center">
                <Ionicons name="bicycle" size={24} color="#f97316" />
              </View>
              <View className="flex-1">
                {selectedOrderForMap.status === "picked_up" ? (
                  <>
                    <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                      From: {mapCoords?.pickup.name || "Hotel"}
                    </Text>
                    <Text className="text-sm font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                      To: {mapCoords?.drop.name || "Customer"}
                    </Text>
                    <Text className="text-[11px] text-gray-500 leading-normal" numberOfLines={1} style={{ fontFamily: "Quicksand-Medium" }}>
                      {mapCoords?.drop.address || "Customer Address"}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-sm font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                      To: {mapCoords?.pickup.name || "Hotel"}
                    </Text>
                    <Text className="text-[11px] text-gray-500 leading-normal" numberOfLines={1} style={{ fontFamily: "Quicksand-Medium" }}>
                      {mapCoords?.pickup.address || "Hotel Address"}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Interactive Control Toggles (GPS vs Simulation) */}
            {selectedOrderForMap.status === "picked_up" && (
              <View className="flex-row gap-2 mt-4 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                <TouchableOpacity
                  className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-1.5 ${
                    trackingMode === "simulation" ? "bg-orange-500 shadow shadow-orange-500/25" : "bg-transparent"
                  }`}
                  onPress={() => setTrackingMode("simulation")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={14}
                    color={trackingMode === "simulation" ? "#fff" : "#9ca3af"}
                  />
                  <Text
                    className={`text-[11px] font-bold ${trackingMode === "simulation" ? "text-white" : "text-gray-400"}`}
                    style={{ fontFamily: "Quicksand-Bold" }}
                  >
                    Simulate
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-1.5 ${
                    trackingMode === "gps" ? "bg-orange-500 shadow shadow-orange-500/25" : "bg-transparent"
                  }`}
                  onPress={() => setTrackingMode("gps")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="navigate-circle-outline"
                    size={14}
                    color={trackingMode === "gps" ? "#fff" : "#9ca3af"}
                  />
                  <Text
                    className={`text-[11px] font-bold ${trackingMode === "gps" ? "text-white" : "text-gray-400"}`}
                    style={{ fontFamily: "Quicksand-Bold" }}
                  >
                    GPS Live
                  </Text>
                </TouchableOpacity>

                {trackingMode === "simulation" && (
                  <TouchableOpacity
                    className="px-3 bg-white rounded-xl items-center justify-center border border-gray-100 shadow-sm"
                    onPress={handleResetSimulation}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={14} color="#f97316" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Core Action Button */}
            {!selectedOrderForMap.status || selectedOrderForMap.status !== "delivered" ? (
              <TouchableOpacity
                className={`w-full py-4 rounded-2xl items-center justify-center mt-4 flex-row gap-2 ${selectedOrderForMap.status === "picked_up" ? "bg-green-500 shadow shadow-green-500/20" : "bg-orange-500 shadow shadow-orange-500/20"}`}
                onPress={() => handleUpdateStatus(selectedOrderForMap.$id, selectedOrderForMap.status)}
                activeOpacity={0.85}
                disabled={isUpdating}
              >
                <Ionicons
                  name={selectedOrderForMap.status === "picked_up" ? "checkmark-circle" : "bicycle"}
                  size={18}
                  color="#fff"
                />
                <Text className="text-white text-sm font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                  {selectedOrderForMap.status === "picked_up" ? "Complete Delivery" : "Pick Up Food"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="w-full bg-green-50 py-3.5 rounded-2xl items-center justify-center mt-4 flex-row gap-2 border border-green-100">
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                <Text className="text-green-600 text-sm font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                  Order Delivered
                </Text>
              </View>
            )}
          </View>
        </>
      ) : (
        <View className="flex-1 items-center justify-center p-5 bg-white">
          <Ionicons name="map-outline" size={48} color="#d1d5db" />
          <Text className="text-sm font-bold text-gray-500 mt-3" style={{ fontFamily: "Quicksand-Bold" }}>No order selected.</Text>
          <Text className="text-xs text-gray-400 mt-1 text-center mb-4" style={{ fontFamily: "Quicksand-Medium" }}>
            Select an order from the active queue tabs to view live tracking.
          </Text>
          <TouchableOpacity
            className="bg-orange-500 px-6 py-3.5 rounded-2xl shadow-md shadow-orange-500/20"
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Text className="text-white font-bold text-xs" style={{ fontFamily: "Quicksand-Bold" }}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* RENDER: SUCCESS ANIMATED ALERT OVERLAY */}
      {showSuccessModal && (
        <Animated.View
          style={[{ opacity: fadeValue }]}
          className="absolute inset-0 items-center justify-center z-50 px-6 bg-black/40"
        >
          <Animated.View
            style={[{ transform: [{ scale: scaleValue }] }]}
            className="bg-white rounded-3xl p-8 items-center justify-center max-w-[280px] w-full shadow-2xl shadow-black/20"
          >
            {/* Animated Checkmark Visual */}
            <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-5 relative">
              <View 
                className="w-14 h-14 bg-green-500 rounded-full items-center justify-center shadow-md shadow-green-500/30"
              >
                <Ionicons name="checkmark" size={32} color="#fff" />
              </View>
              <View className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-green-300" />
              <View className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-green-400" />
            </View>

            <Text className="text-xl font-bold text-gray-800 text-center mb-1" style={{ fontFamily: "Quicksand-Bold" }}>
              Delivery Successful!
            </Text>
            <Text className="text-xs text-gray-500 text-center leading-relaxed mb-6" style={{ fontFamily: "Quicksand-Medium" }}>
              The order has been marked as delivered.
            </Text>
            <TouchableOpacity 
              className="bg-green-500 w-full py-3.5 rounded-2xl items-center justify-center shadow-md shadow-green-500/20"
              onPress={() => {
                setShowSuccessModal(false);
                router.replace("/(delivery)" as any);
              }}
            >
              <Text className="text-white font-bold text-sm" style={{ fontFamily: "Quicksand-Bold" }}>
                Okay
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}
