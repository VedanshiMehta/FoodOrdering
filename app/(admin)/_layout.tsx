import { Redirect, Stack } from "expo-router";
import React, { useContext } from "react";
import Loading from "@/components/Loading";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";

export default function AdminLayout() {
  const { isLoggedIn, user, isLoading } = useContext(AppwriteContext);

  if (isLoading) return <Loading />;
  if (!isLoggedIn) return <Redirect href={"/(auth)/sign_in" as any} />;
  if (!user) return <Loading />;
  if (user?.role !== "admin") return <Redirect href={"/(tabs)" as any} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
