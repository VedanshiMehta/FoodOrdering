import React, { useEffect, useRef } from "react";
import { Animated, Text, View, Easing } from "react-native";
import { images } from "../constants";

interface LoadingProps {
  text?: string;
}

const Loading: React.FC<LoadingProps> = ({ text = "Loading..." }) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const shadowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: -30,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    const shadow = Animated.sequence([
      Animated.timing(shadowAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(shadowAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    Animated.loop(Animated.parallel([bounce, shadow])).start();
  }, [bounceAnim, shadowAnim]);

  // Interpolate shadow size and opacity
  const shadowScale = shadowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.6],
  });
  const shadowOpacity = shadowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.1],
  });

  return (
    <View className="flex-1 justify-center items-center bg-white px-5">
      <View className="items-center justify-center relative mb-8 h-32 w-32">
        <Animated.Image
          source={images.burgerOne}
          className="w-24 h-24 z-10"
          resizeMode="contain"
          style={{
            transform: [{ translateY: bounceAnim }],
          }}
        />
        <Animated.View
          className="w-16 h-4 bg-gray-500 rounded-full absolute bottom-4 z-0"
          style={{
            opacity: shadowOpacity,
            transform: [{ scale: shadowScale }],
          }}
        />
      </View>
      <Text 
        className="text-lg text-dark-100 text-center" 
        style={{ fontFamily: "Quicksand-Bold" }}
      >
        {text}
      </Text>
      <View className="flex-row items-center mt-3 gap-2">
        <View className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <View className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" style={{ opacity: 0.7 }} />
        <View className="w-2 h-2 rounded-full bg-orange-300 animate-pulse" style={{ opacity: 0.4 }} />
      </View>
    </View>
  );
};

export default Loading;
