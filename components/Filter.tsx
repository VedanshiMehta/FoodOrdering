import { Category } from "@/type";
import cn from "clsx";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Platform, Text, TouchableOpacity, View } from "react-native";

const Filter = ({ categories }: { categories: Category[] }) => {
  const searchParams = useLocalSearchParams();
  const categoryParam =
    typeof searchParams.category === "string" ? searchParams.category : "all";
  const [active, setActive] = useState(categoryParam || "all");

  useEffect(() => {
    setActive(categoryParam || "all");
  }, [categoryParam]);

  const handlePress: (id: string) => void = (id) => {
    setActive(id);
    if (id === "all") router.setParams({ category: "all" });
    else router.setParams({ category: id });
  };
  const filterData: (Category | { $id: string; name: string })[] = categories
    ? [{ $id: "all", name: "All" }, ...categories]
    : [{ $id: "all", name: "All" }];
  return (
    <View>
      <FlatList
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-x-2 pb-3"
        data={filterData}
        renderItem={({ item }) => {
          return (
            <TouchableOpacity
              key={item.$id}
              className={cn(
                "filter",
                active === item.$id ? "bg-amber-500" : "bg-white",
              )}
              style={
                Platform.OS === "android"
                  ? { elevation: 5, shadowColor: "#878787" }
                  : {}
              }
              onPress={() => handlePress(item.$id)}
            >
              <Text
                className={cn(
                  "body-medium",
                  active === item.$id ? "text-white" : "text-grey-200",
                )}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item) => item.$id}
      />
    </View>
  );
};

export default Filter;
