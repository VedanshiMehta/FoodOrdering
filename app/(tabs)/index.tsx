import CartButton from "@/components/CartButton";
import cn from "clsx";
import { Fragment, useContext } from "react";
import {
  FlatList,
  Image,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { images, offers } from "../../constants";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import { useSelector } from "react-redux";
import { RootState } from "../../store/store";
import { useRouter } from "expo-router";
import useAppwrite from "../lib/services/appwrite_data_services/useApprwriteData";

export default function Index() {
  const { user, appwrite } = useContext(AppwriteContext);
  const { address, flatHouseNo } = useSelector(
    (state: RootState) => state.location,
  );
  const router = useRouter();
  const deliveryAddress = flatHouseNo || address?.split(",")[0];

  const { data: categories } = useAppwrite({
    fn: () => appwrite.getCategories(),
  });

  const handleOfferPress = (title: string) => {
    let targetName = "";
    const upperTitle = title.toUpperCase();
    if (upperTitle.includes("COMBO") || upperTitle.includes("BURGER")) {
      targetName = "Burgers";
    } else if (upperTitle.includes("PIZZA")) {
      targetName = "Pizzas";
    } else if (upperTitle.includes("BURRITO")) {
      targetName = "Burritos";
    }

    const matchedCategory = categories?.find(
      (cat: any) => cat.name.toLowerCase() === targetName.toLowerCase()
    );

    if (matchedCategory) {
      router.push({
        pathname: "/search",
        params: { category: matchedCategory.$id },
      });
    } else {
      router.push({
        pathname: "/search",
        params: { category: "all" },
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <FlatList
        data={offers}
        renderItem={({ item, index }) => {
          const isEven = index % 2 === 0;
          return (
            <View>
              <Pressable
                className={cn(
                  "offer-card",
                  isEven ? "flex-row-reverse" : "flex-row",
                )}
                style={{ backgroundColor: item.color }}
                android_ripple={{ color: "#ffffff22" }}
                onPress={() => handleOfferPress(item.title)}
              >
                {({ pressed }) => (
                  <Fragment>
                    <View className="h-full w-1/2">
                      <Image
                        source={item.image}
                        className={"size-full"}
                        resizeMode={"contain"}
                      />
                    </View>
                    <View
                      className={cn(
                        "offer-card__info",
                        isEven ? "pl-10" : "pr-10",
                      )}
                    >
                      <Text className="h1-bold text-white leading-tight">
                        {item.title}
                      </Text>
                      <Image
                        source={images.arrowRight}
                        className="size-10"
                        resizeMode="contain"
                        tintColor="white"
                      />
                    </View>
                  </Fragment>
                )}
              </Pressable>
            </View>
          );
        }}
        contentContainerClassName="pb-28 px-5"
        ListHeaderComponent={() => (
          <View className="flex-between flex-row w-full px-2 pt-5">
            <View className="flex-start">
              {/* <Text className="h2-bold text-dark-100 ">
                Welcome {user?.name}
              </Text> */}
              <Text className="small-bold text-primary uppercase">
                Deliver To
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/select-location" as any)}
                className="flex-center flex-row gap-x-1 mt-0.5"
              >
                <Text
                  className="paragraph-bold text-dark-100"
                  numberOfLines={1}
                  style={{ maxWidth: 150 }}
                >
                  {deliveryAddress || "Select Location"}
                </Text>
                <Image
                  source={images.arrowDown}
                  className="size-3"
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
            <CartButton />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
