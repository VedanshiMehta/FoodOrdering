import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { useDebouncedCallback } from "use-debounce";

const SearchBar = () => {
  const params = useLocalSearchParams<{ query?: string }>();
  const [query, setQuery] = useState(params.query ?? "");
  const debouncedSearch = useDebouncedCallback((text: string) => {
    router.setParams({ query: text || undefined });
  }, 500);

  const handleChange: (text: string) => void = (text) => {
    setQuery(text);
    debouncedSearch(text.trim());
  };

  const handleClear = () => {
    debouncedSearch.cancel();
    setQuery("");
    router.setParams({ query: undefined });
  };

  const handleSubmit: () => void = () => {
    debouncedSearch.cancel();
    router.setParams({ query: query.trim() || undefined });
  };

  return (
    <View className="searchbar">
      <TextInput
        className="flex-1 p-5 font-quicksand-medium text-dark-100"
        placeholder="Search for pizzas, burgers and more..."
        value={query}
        onChangeText={handleChange}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
        placeholderTextColor={"#A0A0A0"}
      />
      {query ? (
        <TouchableOpacity className="pr-5" onPress={handleClear}>
          <Ionicons name="close-circle" size={24} color="#5D5F6D" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default SearchBar;
