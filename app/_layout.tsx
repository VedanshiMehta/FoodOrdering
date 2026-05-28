import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import "react-native-url-polyfill/auto";
import "./globals.css";
import { AppwriteProvider } from "./lib/services/auth_services/AppwirteContext";
import { CartProvider } from "./lib/services/cart_services/CartContext";
import { Provider } from "react-redux";
import { store } from "../store/store";
import { StripeProvider } from "@stripe/stripe-react-native";

const STRIPE_PUBLISHABLE_KEY = "pk_test_51TbvAwBKPaQBNlXoDVFJX49IMGeuduFHr1gAyAS10y4h3Knx90XJfbrgg5j4LvGqDEzlkBoly1EECyab6J24u5qB00snfGzqDM";

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    "Quicksand-Bold": require("../assets/fonts/Quicksand-Bold.ttf"),
    "Quicksand-Medium": require("../assets/fonts/Quicksand-Medium.ttf"),
    "Quicksand-Regular": require("../assets/fonts/Quicksand-Regular.ttf"),
    "Quicksand-SemiBold": require("../assets/fonts/Quicksand-SemiBold.ttf"),
    "Quicksand-Light": require("../assets/fonts/Quicksand-Light.ttf"),
  });
  useEffect(() => {
    if (error) throw error;
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded, error]);

  return (
    <Provider store={store}>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <AppwriteProvider>
          <CartProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </CartProvider>
        </AppwriteProvider>
      </StripeProvider>
    </Provider>
  );
}
