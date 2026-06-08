import React, { createContext, useContext, useState } from "react";
import { Redirect, Tabs } from "expo-router";
import { Image, Text, View } from "react-native";
import Loading from "@/components/Loading";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { images } from "@/constants";
import cn from "clsx";

// Create a context for the delivery portal to share coordinates and the active order across tabs
export const DeliveryContext = createContext<{
  selectedOrderForMap: any;
  setSelectedOrderForMap: (order: any) => void;
  customerCoords: { latitude: number; longitude: number } | null;
  setCustomerCoords: (coords: { latitude: number; longitude: number } | null) => void;
  mapOriginTab: string | null;
  setMapOriginTab: (tab: string | null) => void;
}>({
  selectedOrderForMap: null,
  setSelectedOrderForMap: () => {},
  customerCoords: null,
  setCustomerCoords: () => {},
  mapOriginTab: null,
  setMapOriginTab: () => {},
});

const TabBarIcon = ({ focused, icon, title }: { focused: boolean; icon: any; title: string }) => {
  return (
    <View className="tab-icon">
      <Image
        source={icon}
        className="size-7"
        resizeMode="contain"
        tintColor={focused ? "#FE8C00" : "#5D5F6D"}
      />
      <Text
        className={cn(
          "text-xs font-bold",
          focused ? "text-primary" : "text-gray-200"
        )}
        style={{ fontFamily: "Quicksand-Bold" }}
      >
        {title}
      </Text>
    </View>
  );
};

export default function DeliveryLayout() {
  const { isLoggedIn, user, isLoading } = useContext(AppwriteContext);
  const [selectedOrderForMap, setSelectedOrderForMap] = useState<any>(null);
  const [customerCoords, setCustomerCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapOriginTab, setMapOriginTab] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (!isLoggedIn) return <Redirect href={"/(auth)/sign_in" as any} />;
  if (!user) return <Loading />;
  if (user?.role !== "rider" && user?.role !== "delivery") return <Redirect href={"/(tabs)" as any} />;

  return (
    <DeliveryContext.Provider value={{ selectedOrderForMap, setSelectedOrderForMap, customerCoords, setCustomerCoords, mapOriginTab, setMapOriginTab }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            borderTopLeftRadius: 40,
            borderTopRightRadius: 40,
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 40,
            marginHorizontal: 15,
            height: 76,
            position: "absolute",
            bottom: 30,
            backgroundColor: "#ffffff",
            shadowColor: "#1a1a1a",
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 5,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Deliveries",
            tabBarIcon: ({ focused }) => (
              <TabBarIcon title="Deliveries" focused={focused} icon={images.bag} />
            ),
          }}
        />
        <Tabs.Screen
          name="active"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused }) => (
              <TabBarIcon title="Profile" focused={focused} icon={images.person} />
            ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            href: null,
            tabBarStyle: { display: "none" },
          }}
        />
      </Tabs>
    </DeliveryContext.Provider>
  );
}
