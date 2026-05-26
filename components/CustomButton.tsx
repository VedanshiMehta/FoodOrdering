import { CustomButtonProps } from "@/type";
import cn from "clsx";
import React, { FC } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

const CustomButton: FC<CustomButtonProps> = ({
  onPress,
  title = "Click Me",
  style,
  textStyle,
  leftIcon,
  isLoading = false,
}) => {
  return (
    <TouchableOpacity
      className={cn(style ? style : "custom-btn")}
      onPress={onPress}
    >
      {leftIcon}
      <View className="flex-center flex-row">
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text
            className={cn(
              textStyle ? textStyle : "text-white-100 paragraph-semibold",
            )}
          >
            {title}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default CustomButton;
