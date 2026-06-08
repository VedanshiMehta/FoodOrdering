import CartButton from "@/components/CartButton";
import Filter from "@/components/Filter";
import MenuCard from "@/components/MenuCard";
import SearchBar from "@/components/SearchBar";
import { images } from "@/constants";
import { Category, MenuItem } from "@/type";
import cn from "clsx";
import { useGlobalSearchParams } from "expo-router";
import React, { useContext, useEffect } from "react";
import { FlatList, Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useAppwrite from "../lib/services/appwrite_data_services/useApprwriteData";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";

const Search = () => {
  const { appwrite } = useContext(AppwriteContext);
  const { category, query } = useGlobalSearchParams<{
    query: string;
    category: string;
  }>();
  const selectedCategory = category && category !== "all" ? category : undefined;
  const searchQuery = query?.trim() || undefined;

  // fetch Menu Items
  const { data, refetch, loading } = useAppwrite({
    fn: appwrite.getMenu,
    params: {
      category: selectedCategory,
      query: searchQuery,
      limit: 6,
    },
  });
  // Fetch Categories
  const { data: categories } = useAppwrite({
    fn: () => appwrite.getCategories(),
  });
  useEffect(() => {
    refetch({ category: selectedCategory, query: searchQuery, limit: 6 });
  }, [selectedCategory, searchQuery]);

  return (
    <SafeAreaView className="bg-white h-full">
      <FlatList
        data={data}
        renderItem={({ item, index }) => {
          const isFirstRightColItem = index % 2 === 0;
          return (
            <View
              className={cn(
                "flex-1 max-w-[48%]",
                !isFirstRightColItem ? "mt-10" : "mt-0",
              )}
            >
              <MenuCard item={item as unknown as MenuItem} />
            </View>
          );
        }}
        keyExtractor={(item) => item.$id}
        numColumns={2}
        columnWrapperClassName="gap-7"
        contentContainerClassName="gap-7 px-5 pb-32"
        ListHeaderComponent={() => (
          <View className="my-5 gap-5">
            <View className="flex-between flex-row w-full">
              <View className="flex-start">
                <Text className="small-bold uppercase text-primary">
                  Search
                </Text>
                <View className="flex-start flex-row gap-x-1 mt-0.5">
                  <Text className="paragraph-semibold text-dark-100">
                    Find your favorite food
                  </Text>
                </View>
              </View>
              <CartButton />
            </View>
            <SearchBar />

            <Filter categories={(categories as unknown as Category[]) ?? []} />
          </View>
        )}
        ListEmptyComponent={() =>
          !loading && (
            <View className="flex-1 items-center justify-center">
              <Image
                source={images.emptyState}
                className="size-40"
                resizeMode="contain"
              />
              <Text className="paragraph-bold text-dark-100 text-center">
                Nothing matched your serach
              </Text>
              <Text className="body-medium text-gray-200 text-center mt-2">
                Try a different search term or check for typos
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
};

export default Search;
