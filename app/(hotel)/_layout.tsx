import { Redirect, Tabs, useRouter } from "expo-router";
import React, { useContext, useEffect } from "react";
import Loading from "@/components/Loading";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Image } from "react-native";
import cn from "clsx";
import { images } from "@/constants";
import { useDispatch } from "react-redux";
import { setLocation } from "../../store/slices/locationSlice";
import * as Location from "expo-location";

const TabBarIcon = ({
  focused,
  iconName,
  icon,
  title,
}: {
  focused: boolean;
  iconName?: any;
  icon?: any;
  title: string;
}) => {
  return (
    <View className="tab-icon">
      {icon ? (
        <Image
          source={icon}
          className="size-6"
          tintColor={focused ? "#FE8C00" : "#5D5F6D"}
          resizeMode="contain"
        />
      ) : (
        <Ionicons
          name={iconName}
          size={24}
          color={focused ? "#FE8C00" : "#5D5F6D"}
        />
      )}
      <Text
        className={cn(
          "text-sm font-bold",
          focused ? "text-primary" : "text-gray-200"
        )}
        style={{ fontFamily: "Quicksand-Bold" }}
      >
        {title}
      </Text>
    </View>
  );
};

export default function HotelLayout() {
  const { isLoggedIn, user, isLoading } = useContext(AppwriteContext);
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    if (user && (user.latitude || user.longitude)) {
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
          console.warn("Failed to reverse geocode manager location on mount", e);
        }

        dispatch(
          setLocation({
            latitude: savedLat,
            longitude: savedLng,
            address: user.address || "",
            flatHouseNo: null,
            countryCode,
          })
        );
      })();
    }
  }, [user, dispatch]);

  if (isLoading) return <Loading />;
  if (!isLoggedIn) return <Redirect href={"/(auth)/sign_in" as any} />;
  if (!user) return <Loading />;
  if (user?.role !== "manager" && user?.role !== "hotel") return <Redirect href={"/(tabs)" as any} />;

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
        name="_menuState"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "My Menu",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              title="My Menu"
              focused={focused}
              iconName={focused ? "restaurant" : "restaurant-outline"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              title="Orders"
              focused={focused}
              iconName={focused ? "receipt" : "receipt-outline"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add Food",
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              title="Add Food"
              focused={focused}
              iconName={focused ? "add-circle" : "add-circle-outline"}
            />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            router.push({ pathname: "/(hotel)/add" as any, params: { editId: "" } });
          },
        })}
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


