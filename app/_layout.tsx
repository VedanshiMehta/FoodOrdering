import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { useEffect } from "react";
import "react-native-url-polyfill/auto";
import "./globals.css";
import { AppwriteProvider } from "./lib/services/auth_services/AppwirteContext";
import { CartProvider } from "./lib/services/cart_services/CartContext";
import { Provider } from "react-redux";
import { store } from "../store/store";

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
      <AppwriteProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </CartProvider>
      </AppwriteProvider>
    </Provider>
  );
}
