import CustomButton from "@/components/CustomButton";
import CustomInput from "@/components/CustomInput";
import { User } from "@/type";
import { Link, router } from "expo-router";
import React, { useContext, useState } from "react";
import { Text, View } from "react-native";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import utils from "../utils/utils";

const SignIn = () => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const { appwrite, setIsLoggedIn, setUser } = useContext(AppwriteContext);
  const submit = async () => {
    const { email, password } = form;
    if (!email || !password)
      return utils.showAlert("Please enter valid email and password", "Error");
    setIsSubmitting(true);
    try {
      appwrite.login({ email, password }).then((response) => {
        if (response) {
          setIsLoggedIn(true);
          appwrite.getCurrentUser().then((userResponse) => {
            if (userResponse) {
              setUser(userResponse as User);
            }
          });
        }
      });
      // utils.showAlert("Signed in successful", "Success");
      router.replace("/");
    } catch (error) {
      utils.showAlert(String(error), "Error");
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <View className="gap-10 bg-white rounded-lg p-5 mt-5">
      <CustomInput
        placeholder="Enter your email"
        label="Email"
        value={form.email}
        onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
        keyboardType="email-address"
        returnKeyType="next"
      />
      <CustomInput
        placeholder="Enter your password"
        label="Password"
        value={form.password}
        maxLength={8}
        onChangeText={(text) =>
          setForm((prev) => ({ ...prev, password: text }))
        }
        secureTextEntry={true}
        returnKeyType="done"
      />
      <CustomButton title="Sign In" isLoading={isSubmitting} onPress={submit} />
      <View className="flex justify-center mt-5 flex-row gap-2">
        <Text className="base-regular text-gray-100">
          Don't have an account?
        </Text>
        <Link href="/sign_up" className="base-bold text-primary">
          Sign Up
        </Link>
      </View>
    </View>
  );
};

export default SignIn;
