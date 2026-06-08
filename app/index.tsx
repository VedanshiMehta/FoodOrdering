import { Redirect } from "expo-router";
import { useContext } from "react";
import AppwriteContext from "./lib/services/auth_services/AppwirteContext";
import Loading from "@/components/Loading";

export default function Index() {
  const { isLoggedIn, user, isLoading } = useContext(AppwriteContext);

  if (isLoading) return <Loading />;
  if (!isLoggedIn) return <Redirect href={"/(auth)/sign_in" as any} />;

  // Role-Based Router Redirection
  if (user?.role === "admin") return <Redirect href={"/(admin)" as any} />;
  if (user?.role === "manager" || user?.role === "hotel") return <Redirect href={"/(hotel)" as any} />;
  if (user?.role === "rider" || user?.role === "delivery") return <Redirect href={"/(delivery)" as any} />;

  return <Redirect href={"/(tabs)" as any} />;
}
