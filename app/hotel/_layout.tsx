import { Redirect, Tabs } from "expo-router";
import React, { useContext } from "react";
import Loading from "@/components/Loading";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Image } from "react-native";
import cn from "clsx";
import { images } from "@/constants";

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
          className="size-7"
          resizeMode="contain"
          tintColor={focused ? "#FE8C00" : "#5D5F6D"}
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

  if (isLoading) return <Loading />;
  if (!isLoggedIn) return <Redirect href="/sign_in" />;
  if (!user) return <Loading />;
  if (user?.role !== "manager" && user?.role !== "hotel") return <Redirect href="/" />;

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
            navigation.navigate("add", { editId: undefined });
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


