import { CustomInputProps } from "@/type";
import cn from "clsx";
import React, { FC, useState } from "react";
import { Text, TextInput, View } from "react-native";

const CustomInput: FC<CustomInputProps> = ({
  placeholder = "Enter text",
  value,
  onChangeText,
  label,
  secureTextEntry = false,
  keyboardType = "default",
  returnKeyType = "done",
  maxLength,
}) => {
  const [isfocused, setIsFocused] = useState(false);

  return (
    <View className="w-full">
      <Text className="label">{label}</Text>
      <TextInput
        placeholder={placeholder}
        value={value}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholderTextColor={"#888"}
        returnKeyType={returnKeyType}
        maxLength={maxLength}
        className={cn(
          "input",
          isfocused ? "border-primary" : "border-gray-300",
        )}
      />
    </View>
  );
};

export default CustomInput;
