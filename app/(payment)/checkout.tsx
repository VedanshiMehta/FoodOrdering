import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import {
  paymentSuccess,
  processPayment,
  resetPayment,
  updateCurrentOrderDbId,
} from "../../store/slices/orderSlice";
import { RootState } from "../../store/store";
import AppwriteService from "../lib/services/auth_services/appwrite";
import { formatPrice, getConvertedAmount, getCurrencyCode } from "../lib/currency";

type PaymentMethodType = "card" | "wallet" | "cod";

const appwrite = new AppwriteService();

export default function CheckoutScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Redux state
  const { currentOrder, paymentStatus } = useSelector(
    (state: RootState) => state.order,
  );
  const countryCode = useSelector((state: RootState) => state.location.countryCode);

  // Local payment method selection
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("card");

  // Handles actual Stripe transaction via Payment Sheet
  const handlePayment = async () => {
    if (paymentMethod === "card" || paymentMethod === "wallet") {
      dispatch(processPayment());

      try {
        // 1. Fetch Payment Intent from Stripe API dynamically
        const response = await fetch(
          "https://api.stripe.com/v1/payment_intents",
          {
            method: "POST",
            headers: {
              Authorization:
                "Bearer sk_test_51TbvAwBKPaQBNlXoqbLGGftRmuZbnIQM4SFMCaapzoAulEk0dqcLVyK1cM9hGVYeOzA82UPgEtOJcemOJog1VILz00PXKGjITL",
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `amount=${Math.round(getConvertedAmount(orderTotal, countryCode) * 100)}&currency=${getCurrencyCode(countryCode)}`,
          },
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.error?.message || "Failed to create payment transaction.",
          );
        }

        const clientSecret = data.client_secret;

        // 2. Initialize Payment Sheet
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: "Food Delivery Inc.",
          defaultBillingDetails: {
            name: "Premium Customer",
          },
          googlePay: {
            merchantCountryCode: "US",
            testEnv: true,
          },
        });

        if (initError) {
          Alert.alert("Stripe Initialization Error", initError.message);
          dispatch(resetPayment());
          return;
        }

        // 3. Present the native Stripe Payment Sheet!
        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          Alert.alert("Payment Cancelled", presentError.message);
          dispatch(resetPayment());
        } else {
          // Card payment succeeded! Create order in database immediately
          if (currentOrder) {
            try {
              const doc = await appwrite.createOrder(currentOrder);
              if (doc) {
                dispatch(updateCurrentOrderDbId(doc.$id));
              }
            } catch (e) {
              console.log("Error creating order on payment success:", e);
            }
          }
          dispatch(paymentSuccess());
        }
      } catch (err: any) {
        Alert.alert(
          "Secure Transaction Failed",
          err.message || "An unexpected error occurred.",
        );
        dispatch(resetPayment());
      }
    } else {
      // Cash on Delivery
      dispatch(processPayment());
      setTimeout(async () => {
        if (currentOrder) {
          try {
            const doc = await appwrite.createOrder(currentOrder);
            if (doc) {
              dispatch(updateCurrentOrderDbId(doc.$id));
            }
          } catch (e) {
            console.log("Error creating COD order:", e);
          }
        }
        dispatch(paymentSuccess());
      }, 2000);
    }
  };

  // Alert animation states
  const scaleValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (paymentStatus === "success") {
      setShowAlert(true);
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

      // Auto navigate to tracking screen after 2.2 seconds
      const timer = setTimeout(() => {
        router.replace("/(payment)/tracking" as any);
      }, 2200);

      return () => clearTimeout(timer);
    } else {
      setShowAlert(false);
      scaleValue.setValue(0);
      fadeValue.setValue(0);
    }
  }, [paymentStatus, scaleValue, fadeValue, router]);

  useEffect(() => {
    // Make sure states are reset when screen is unmounted
    return () => {
      dispatch(resetPayment());
    };
  }, [dispatch]);

  // Calculate order details safely
  const orderTotal = currentOrder?.total ?? 0;
  const orderAddress = currentOrder?.address ?? "Selected Delivery Location";

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <TouchableOpacity
            className="w-[42px] h-[42px] rounded-full border border-gray-100 bg-white items-center justify-center"
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text
            className="text-xl font-bold text-gray-800"
            style={{ fontFamily: "Quicksand-Bold" }}
          >
            Secure Checkout
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
        >
          {/* Order Summary & Address Header */}
          <View className="bg-orange-50 rounded-2xl p-4 mt-5 mb-6 flex-row items-center justify-between border border-orange-100">
            <View className="flex-1 mr-3">
              <Text
                className="text-orange-500 text-xs font-bold uppercase tracking-wider mb-1"
                style={{ fontFamily: "Quicksand-Bold" }}
              >
                Delivery Address
              </Text>
              <Text
                className="text-gray-800 text-sm font-semibold"
                numberOfLines={2}
                style={{ fontFamily: "Quicksand-Medium" }}
              >
                {orderAddress}
              </Text>
            </View>
            <Ionicons name="location" size={24} color="#f97316" />
          </View>

          {/* Payment Method Selector Tabs */}
          <Text
            className="text-base font-bold text-gray-800 mb-3"
            style={{ fontFamily: "Quicksand-Bold" }}
          >
            Select Payment Method
          </Text>
          <View className="flex-row bg-gray-100 p-1.5 rounded-2xl mb-6">
            <TouchableOpacity
              className={
                paymentMethod === "card"
                  ? "flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1.5 bg-white"
                  : "flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1.5"
              }
              style={paymentMethod === "card" ? styles.shadowSm : undefined}
              onPress={() => setPaymentMethod("card")}
            >
              <Ionicons
                name="card"
                size={18}
                color={paymentMethod === "card" ? "#f97316" : "#6b7280"}
              />
              <Text
                className={
                  paymentMethod === "card"
                    ? "text-xs font-bold text-gray-800"
                    : "text-xs font-bold text-gray-500"
                }
                style={{ fontFamily: "Quicksand-Bold" }}
              >
                Card (Stripe)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={
                paymentMethod === "wallet"
                  ? "flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1.5 bg-white"
                  : "flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1.5"
              }
              style={paymentMethod === "wallet" ? styles.shadowSm : undefined}
              onPress={() => setPaymentMethod("wallet")}
            >
              <Ionicons
                name="logo-google"
                size={18}
                color={paymentMethod === "wallet" ? "#f97316" : "#6b7280"}
              />
              <Text
                className={
                  paymentMethod === "wallet"
                    ? "text-xs font-bold text-gray-800"
                    : "text-xs font-bold text-gray-500"
                }
                style={{ fontFamily: "Quicksand-Bold" }}
              >
                Apple/G-Pay
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={
                paymentMethod === "cod"
                  ? "flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1.5 bg-white"
                  : "flex-1 py-3 rounded-xl flex-row items-center justify-center gap-1.5"
              }
              style={paymentMethod === "cod" ? styles.shadowSm : undefined}
              onPress={() => setPaymentMethod("cod")}
            >
              <Ionicons
                name="cash"
                size={18}
                color={paymentMethod === "cod" ? "#f97316" : "#6b7280"}
              />
              <Text
                className={
                  paymentMethod === "cod"
                    ? "text-xs font-bold text-gray-800"
                    : "text-xs font-bold text-gray-500"
                }
                style={{ fontFamily: "Quicksand-Bold" }}
              >
                COD
              </Text>
            </TouchableOpacity>
          </View>

          {/* DYNAMIC RENDER: PAYMENT CONTENT */}
          {paymentMethod === "card" && (
            <View className="mb-6">
              {/* Premium Virtual Credit Card */}
              <View
                className="w-full aspect-[1.6/1] bg-neutral-900 rounded-3xl p-6 relative overflow-hidden mb-6"
                style={styles.shadowXl}
              >
                {/* Visual Accent Gradients */}
                <View
                  className="absolute top-[-30px] right-[-30px] w-48 h-48 bg-orange-600 rounded-full blur-2xl"
                  style={styles.opacity35}
                />
                <View
                  className="absolute bottom-[-30px] left-[-30px] w-48 h-48 bg-stone-700 rounded-full blur-2xl"
                  style={styles.opacity35}
                />

                {/* Card Header */}
                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name="shield-checkmark"
                      size={24}
                      color="#f97316"
                    />
                    <Text
                      className="text-white text-xs font-bold uppercase tracking-wider"
                      style={{ fontFamily: "Quicksand-Bold" }}
                    >
                      Stripe Platinum
                    </Text>
                  </View>
                  <Ionicons name="card-outline" size={32} color="#fff" />
                </View>

                {/* Card Chip Symbol */}
                <View
                  className="w-10 h-7 rounded-md mb-6 relative overflow-hidden border border-amber-300"
                  style={styles.bgAmber400_80}
                >
                  <View
                    className="absolute left-1.5 top-0 bottom-0 w-0.5"
                    style={styles.bgAmber600_30}
                  />
                  <View
                    className="absolute left-3.5 top-0 bottom-0 w-0.5"
                    style={styles.bgAmber600_30}
                  />
                  <View
                    className="absolute left-5.5 top-0 bottom-0 w-0.5"
                    style={styles.bgAmber600_30}
                  />
                  <View
                    className="absolute top-1.5 left-0 right-0 h-0.5"
                    style={styles.bgAmber600_30}
                  />
                  <View
                    className="absolute top-3.5 left-0 right-0 h-0.5"
                    style={styles.bgAmber600_30}
                  />
                  <View
                    className="absolute top-5.5 left-0 right-0 h-0.5"
                    style={styles.bgAmber600_30}
                  />
                </View>

                {/* Card Number */}
                <Text
                  className="text-white text-xl font-semibold tracking-widest mb-6"
                  style={{ fontFamily: "Quicksand-SemiBold", letterSpacing: 4 }}
                >
                  {"•••• •••• •••• 4242"}
                </Text>

                {/* Card Footer Details */}
                <View className="flex-row justify-between items-end mt-auto">
                  <View className="flex-1 mr-4">
                    <Text
                      className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider mb-1"
                      style={{ fontFamily: "Quicksand-Bold" }}
                    >
                      Cardholder
                    </Text>
                    <Text
                      className="text-white text-sm font-bold uppercase"
                      numberOfLines={1}
                      style={{ fontFamily: "Quicksand-Bold" }}
                    >
                      {"STRIPE TEST CUSTOMER"}
                    </Text>
                  </View>

                  <View className="flex-row gap-4">
                    <View className="items-end">
                      <Text
                        className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider mb-1"
                        style={{ fontFamily: "Quicksand-Bold" }}
                      >
                        Expires
                      </Text>
                      <Text
                        className="text-white text-sm font-bold"
                        style={{ fontFamily: "Quicksand-Bold" }}
                      >
                        {"12/30"}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider mb-1"
                        style={{ fontFamily: "Quicksand-Bold" }}
                      >
                        CVV
                      </Text>
                      <Text
                        className="text-white text-sm font-bold"
                        style={{ fontFamily: "Quicksand-Bold" }}
                      >
                        {"•••"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Secure Checkout Info Alert */}
              <View className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center mt-0.5">
                    <Ionicons name="lock-closed" size={20} color="#f97316" />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-bold text-gray-800 mb-1"
                      style={{ fontFamily: "Quicksand-Bold" }}
                    >
                      Secure Checkout via Stripe
                    </Text>
                    <Text
                      className="text-xs text-gray-500 leading-relaxed"
                      style={{ fontFamily: "Quicksand-Medium" }}
                    >
                      {
                        "We do not store your credit card details. By clicking the payment button below, a secure native Stripe checkout window will be presented for you to enter card details and complete payment safely."
                      }
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {paymentMethod === "wallet" && (
            <View className="mb-6 bg-gray-50 border border-gray-100 rounded-2xl p-6 items-center justify-center py-10">
              <View
                className="w-16 h-16 bg-white border border-gray-100 rounded-full items-center justify-center mb-4"
                style={styles.shadowSm}
              >
                <Ionicons name="logo-google" size={32} color="#4285F4" />
              </View>
              <Text
                className="text-base font-bold text-gray-800 text-center mb-1"
                style={{ fontFamily: "Quicksand-Bold" }}
              >
                Google Pay / Apple Pay Express
              </Text>
              <Text
                className="text-xs text-gray-500 text-center px-6 mb-6"
                style={{ fontFamily: "Quicksand-Medium" }}
              >
                {
                  "Instantly authorize and pay via your device's pre-configured primary wallets."
                }
              </Text>
              <TouchableOpacity
                className="w-full bg-neutral-900 rounded-2xl py-4 items-center justify-center flex-row gap-2"
                style={styles.shadowMd}
              >
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text
                  className="text-white text-base font-bold"
                  style={{ fontFamily: "Quicksand-Bold" }}
                >
                  Pay with Express Wallet
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {paymentMethod === "cod" && (
            <View className="mb-6 bg-gray-50 border border-gray-100 rounded-2xl p-6">
              <View className="flex-row items-center gap-3 mb-4">
                <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center">
                  <Ionicons name="cash" size={24} color="#f97316" />
                </View>
                <View>
                  <Text
                    className="text-base font-bold text-gray-800"
                    style={{ fontFamily: "Quicksand-Bold" }}
                  >
                    Cash on Delivery
                  </Text>
                  <Text
                    className="text-xs text-gray-400"
                    style={{ fontFamily: "Quicksand-Medium" }}
                  >
                    Pay with cash at your doorstep
                  </Text>
                </View>
              </View>
              <Text
                className="text-xs text-gray-500 leading-relaxed bg-white border border-gray-100 p-4 rounded-xl"
                style={{ fontFamily: "Quicksand-Medium" }}
              >
                🔔 Please ensure you have the exact amount of cash ready for the
                delivery rider when your order arrives. A delivery
                representative will contact you upon arrival at your address.
              </Text>
            </View>
          )}

          {/* Pricing Details */}
          <View className="border-t border-gray-100 pt-5 mb-8">
            <Text
              className="text-base font-bold text-gray-800 mb-3"
              style={{ fontFamily: "Quicksand-Bold" }}
            >
              Pricing Details
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4 border border-gray-100 gap-3">
              <View className="flex-row justify-between">
                <Text
                  className="text-gray-500 text-sm font-semibold"
                  style={{ fontFamily: "Quicksand-Medium" }}
                >
                  Subtotal
                </Text>
                <Text
                  className="text-gray-800 text-sm font-bold"
                  style={{ fontFamily: "Quicksand-Bold" }}
                >
                  {formatPrice(orderTotal - 5 + 0.5, countryCode)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text
                  className="text-gray-500 text-sm font-semibold"
                  style={{ fontFamily: "Quicksand-Medium" }}
                >
                  Delivery Fee
                </Text>
                <Text
                  className="text-gray-800 text-sm font-bold"
                  style={{ fontFamily: "Quicksand-Bold" }}
                >
                  {formatPrice(5, countryCode)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text
                  className="text-gray-500 text-sm font-semibold"
                  style={{ fontFamily: "Quicksand-Medium" }}
                >
                  Discounts
                </Text>
                <Text
                  className="text-success text-sm font-bold"
                  style={{ fontFamily: "Quicksand-Bold" }}
                >
                  -{formatPrice(0.5, countryCode)}
                </Text>
              </View>
              <View className="border-b border-gray-150 my-1" />
              <View className="flex-row justify-between items-center">
                <Text
                  className="text-gray-800 text-base font-bold"
                  style={{ fontFamily: "Quicksand-Bold" }}
                >
                  Total Amount
                </Text>
                <Text
                  className="text-orange-500 text-lg font-bold"
                  style={{ fontFamily: "Quicksand-Bold" }}
                >
                  {formatPrice(orderTotal, countryCode)}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* BOTTOM ACTION BAR */}
        <View className="px-5 py-4 border-t border-gray-100 bg-white">
          <TouchableOpacity
            className="w-full bg-orange-500 rounded-2xl py-4 items-center justify-center flex-row gap-2"
            style={styles.shadowLg}
            onPress={handlePayment}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-closed" size={18} color="#fff" />
            <Text
              className="text-white text-lg font-bold"
              style={{ fontFamily: "Quicksand-Bold" }}
            >
              Pay {formatPrice(orderTotal, countryCode)}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* RENDER: SECURE PAYMENT PROCESSING MODAL OVERLAY */}
      {paymentStatus === "processing" && (
        <View
          className="absolute inset-0 items-center justify-center z-50 px-8"
          style={styles.bgOverlay}
        >
          <View
            className="bg-white rounded-3xl p-8 items-center justify-center max-w-[280px]"
            style={styles.shadow2xl}
          >
            <ActivityIndicator size="large" color="#f97316" className="mb-4" />
            <Text
              className="text-lg font-bold text-gray-800 text-center mb-2"
              style={{ fontFamily: "Quicksand-Bold" }}
            >
              Secure Payment
            </Text>
            <Text
              className="text-xs text-gray-500 text-center leading-relaxed"
              style={{ fontFamily: "Quicksand-Medium" }}
            >
              Processing transaction via Stripe secure gateway. Please do not
              close the app...
            </Text>
          </View>
        </View>
      )}

      {/* RENDER: SUCCESS ANIMATED ALERT OVERLAY */}
      {showAlert && (
        <Animated.View
          style={[{ opacity: fadeValue }, styles.bgOverlay]}
          className="absolute inset-0 items-center justify-center z-50 px-6"
        >
          <Animated.View
            style={[{ transform: [{ scale: scaleValue }] }, styles.shadow2xl]}
            className="bg-white rounded-3xl p-8 items-center justify-center max-w-[280px] w-full"
          >
            {/* Animated Checkmark Visual */}
            <View className="w-20 h-20 bg-orange-100 rounded-full items-center justify-center mb-5 relative">
              <View
                className="w-14 h-14 bg-orange-500 rounded-full items-center justify-center"
                style={styles.shadowMd}
              >
                <Ionicons name="checkmark" size={32} color="#fff" />
              </View>
              <View className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-orange-300" />
              <View className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-orange-400" />
            </View>

            <Text
              className="text-xl font-bold text-gray-800 text-center mb-1"
              style={{ fontFamily: "Quicksand-Bold" }}
            >
              Order Confirmed!
            </Text>
            <Text
              className="text-xs text-gray-500 text-center leading-relaxed"
              style={{ fontFamily: "Quicksand-Medium" }}
            >
              Your payment was processed successfully. Redirecting you to track
              your delivery...
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shadowSm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
    elevation: 2,
  },
  shadowMd: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  shadowLg: {
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  shadowXl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8.3,
    elevation: 10,
  },
  shadow2xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16.0,
    elevation: 24,
  },
  bgOverlay: {
    backgroundColor: "rgba(10, 10, 10, 0.7)",
  },
  bgAmber400_80: {
    backgroundColor: "rgba(251, 191, 36, 0.8)",
  },
  bgAmber600_30: {
    backgroundColor: "rgba(217, 119, 6, 0.3)",
  },
  opacity35: {
    opacity: 0.35,
  },
});
