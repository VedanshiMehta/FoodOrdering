import Loading from "@/components/Loading";
import { images } from "@/constants";
import { TabBarIconProps, User } from "@/type";
import cn from "clsx";
import { Redirect, Tabs } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";

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

  useEffect(() => {
    appwrite
      .getCurrentUser()
      .then((response) => {
        setIsLoading(false);
        if (response) {
          setIsLoggedIn(true);
          setUser(response as User);
          console.log({ isLoggedIn });
        }
      })
      .catch((error) => {
        setIsLoggedIn(false);
        setIsLoading(false);
        console.log({ isLoggedIn });
      });
  }, [appwrite, setIsLoading, setUser]);
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
          backgroundColor: "#0000000F",
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
