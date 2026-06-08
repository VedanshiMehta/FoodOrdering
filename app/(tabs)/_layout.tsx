import Loading from "@/components/Loading";
import { images } from "@/constants";
import { TabBarIconProps, User } from "@/type";
import cn from "clsx";
import { Redirect, Tabs } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { useDispatch } from "react-redux";
import { setLocation } from "../../store/slices/locationSlice";
import * as Location from "expo-location";

const TabBarIcon = ({ focused, icon, title }: TabBarIconProps) => {
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
          "text-sm font-bold",
          focused ? "text-primary" : "text-gray-200",
        )}
      >
        {title}
      </Text>
    </View>
  );
};

export default function TabsLayout() {
  const { isLoggedIn, user, isLoading } = useContext(AppwriteContext);
  const dispatch = useDispatch();

  useEffect(() => {
    if (user?.address) {
      const parts = user.address.split(", ");
      let flatNo = null;
      let mainAddress = user.address;

      // If the first part is short and doesn't contain Street/St, it's the flat number!
      if (
        parts.length > 1 &&
        !parts[0].includes("Street") &&
        !parts[0].includes("St") &&
        parts[0].length < 20
      ) {
        flatNo = parts[0];
        mainAddress = parts.slice(1).join(", ");
      }

      const parsedLat = Number(user.latitude);
      const parsedLng = Number(user.longitude);
      const savedLat = !isNaN(parsedLat) && user.latitude ? parsedLat : 20.5992;
      const savedLng = !isNaN(parsedLng) && user.longitude ? parsedLng : 72.9342;

      (async () => {
        let countryCode = null;
        const addrLower = (user.address || "").toLowerCase();
        if (addrLower.includes("india") || addrLower.includes("gujarat") || addrLower.includes("in")) {
          countryCode = "IN";
        } else if (addrLower.includes("usa") || addrLower.includes("united states") || addrLower.includes("us")) {
          countryCode = "US";
        }
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const geocode = await Location.reverseGeocodeAsync({
              latitude: savedLat,
              longitude: savedLng,
            });
            if (geocode.length > 0) {
              countryCode = geocode[0].isoCountryCode || null;
            }
          }
        } catch (e) {
          console.warn("Failed to reverse geocode user location on mount", e);
        }

        dispatch(
          setLocation({
            latitude: savedLat,
            longitude: savedLng,
            address: mainAddress,
            flatHouseNo: flatNo,
            countryCode,
          })
        );
      })();
    }
  }, [user, dispatch]);

  if (isLoading) return <Loading />;
  if (!isLoggedIn) return <Redirect href={"/(auth)/sign_in" as any} />;

  // Role-Based Router Redirection
  if (user?.role === "admin") return <Redirect href={"/(admin)" as any} />;
  if (user?.role === "manager" || user?.role === "hotel") return <Redirect href={"/(hotel)" as any} />;
  if (user?.role === "rider" || user?.role === "delivery") return <Redirect href={"/(delivery)" as any} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          borderTopLeftRadius: 50,
          borderTopRightRadius: 50,
          borderBottomLeftRadius: 50,
          borderBottomRightRadius: 50,
          marginHorizontal: 20,
          height: 80,
          position: "absolute",
          bottom: 40,
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
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon title="Home" focused={focused} icon={images.home} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon title="Search" focused={focused} icon={images.search} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon title="Cart" focused={focused} icon={images.bag} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              title="Profile"
              focused={focused}
              icon={images.person}
            />
          ),
        }}
      />
    </Tabs>
  );
}
