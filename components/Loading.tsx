import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

const Loading = () => {
  return (
    <View className="{flex-1 justify-center items-center gap-5}">
      <ActivityIndicator size="large" color="orange" />
      <Text>Loading</Text>
    </View>
  );
};

export default Loading;
