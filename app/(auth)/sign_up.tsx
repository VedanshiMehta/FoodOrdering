import CustomButton from "@/components/CustomButton";
import CustomInput from "@/components/CustomInput";
import { User } from "@/type";
import { Link, router } from "expo-router";
import React, { useContext, useState } from "react";
import { Text, View } from "react-native";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import utils from "../utils/utils";

const SignUp = () => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { appwrite, setIsLoggedIn, setUser } = useContext(AppwriteContext);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const submit = async () => {
    const { name, email, password } = form;
    if (!name || !email || !password)
      return utils.showAlert(
        "Please enter valid name, email and password",
        "Error",
      );
    if (password.length < 8)
      return utils.showAlert("Password must be 8 characters long", "Error");
    setIsSubmitting(true);
    try {
      const response = await appwrite.createAccount({
        name: name,
        email: email,
        password: password,
        role: "customer",
      });
      if (response) {
        const userResponse = await appwrite.getCurrentUser();
        if (userResponse) {
          setUser(userResponse as User);
        }
        setIsLoggedIn(true);
        router.replace("/(tabs)");
      }
    } catch (error) {
      utils.showAlert(String(error), "Error");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <View className="gap-6 bg-white rounded-lg p-5 mt-5">
      <CustomInput
        placeholder="Enter your name"
        label="Full Name"
        returnKeyType="next"
        value={form.name}
        onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
      />
      <CustomInput
        placeholder="Enter your email"
        label="Email"
        value={form.email}
        returnKeyType="next"
        onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
        keyboardType="email-address"
      />
      <CustomInput
        placeholder="Enter your password"
        label="Password"
        value={form.password}
        returnKeyType="done"
        onChangeText={(text) =>
          setForm((prev) => ({ ...prev, password: text }))
        }
        secureTextEntry={true}
      />

      <CustomButton title="Sign Up" isLoading={isSubmitting} onPress={submit} />
      <View className="flex justify-center mt-2 flex-row gap-2">
        <Text className="base-regular text-gray-100">
          Already have an account?
        </Text>
        <Link href="/sign_in" className="base-bold text-primary">
          Sign In
        </Link>
      </View>
    </View>
  );
};

export default SignUp;
