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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { appwrite, isLoggedIn, setIsLoggedIn, setUser } =
    useContext(AppwriteContext);
  const dispatch = useDispatch();

  useEffect(() => {
    appwrite
      .getCurrentUser()
      .then((response) => {
        setIsLoading(false);
        if (response) {
          setIsLoggedIn(true);
          setUser(response as User);

            // Restore last saved location to Redux so it persists on reload!
            if (response.address) {
              const parts = response.address.split(", ");
              let flatNo = null;
              let mainAddress = response.address;

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

              const savedLat = response.latitude ? Number(response.latitude) : 20.5992;
              const savedLng = response.longitude ? Number(response.longitude) : 72.9342;

              dispatch(
                setLocation({
                  latitude: savedLat,
                  longitude: savedLng,
                  address: mainAddress,
                  flatHouseNo: flatNo,
                })
              );
            }
        } else {
          setIsLoggedIn(false);
          setUser(null);
        }
      })
      .catch((error) => {
        setIsLoggedIn(false);
        setUser(null);
        setIsLoading(false);
      });
  }, [appwrite, setIsLoggedIn, setIsLoading, setUser, dispatch]);
  if (isLoading) return <Loading />;
  if (!isLoggedIn) return <Redirect href="/sign_in" />;
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
