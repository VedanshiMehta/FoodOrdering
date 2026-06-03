import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AppwriteContext from "../lib/services/auth_services/AppwirteContext";
import useAppwrite from "../lib/services/appwrite_data_services/useApprwriteData";
import useAddFoodForm from "../../hooks/useAddFoodForm";

export default function AddFoodScreen() {
  const { appwrite } = useContext(AppwriteContext);

  // Load dynamic categories from database for dropdown selection
  const { data: categoriesData, refetch: refetchCategories } = useAppwrite({
    fn: () => appwrite.getCategories(),
  });

  const {
    name,
    setName,
    price,
    setPrice,
    description,
    setDescription,
    calories,
    setCalories,
    protein,
    setProtein,
    categoryId,
    setCategoryId,
    customizations,
    selectedToppings,
    selectedSides,
    toggleTopping,
    toggleSide,
    loadingCustomizations,
    imageUri,
    isSubmitting,
    handlePickImage,
    handleTakePhoto,
    handlePublishFood,
    handleCreateCategory,
    handleCreateCustomization,
    isEditMode,
  } = useAddFoodForm();

  // Bottom Sheets Visibility
  const [isPhotoSheetOpen, setIsPhotoSheetOpen] = useState(false);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false);

  // Creators Modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  const [isCusModalOpen, setIsCusModalOpen] = useState(false);
  const [newCusName, setNewCusName] = useState("");
  const [newCusPrice, setNewCusPrice] = useState("");
  const [newCusType, setNewCusType] = useState<"topping" | "side">("topping");
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [newCusImage, setNewCusImage] = useState<string | null>(null);

  // Pre-select first category when loaded
  useEffect(() => {
    if (categoriesData && categoriesData.length > 0 && !categoryId) {
      setCategoryId(categoriesData[0].$id);
    }
  }, [categoriesData, categoryId, setCategoryId]);

  const selectedCategory = categoriesData?.find((cat: any) => cat.$id === categoryId);
  const selectedCategoryName = selectedCategory ? selectedCategory.name : "";

  const submitNewCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert("Error", "Please enter a category name.");
      return;
    }
    setIsSavingCustom(true);
    const result = await handleCreateCategory(newCatName, newCatDesc);
    setIsSavingCustom(false);
    if (result) {
      setNewCatName("");
      setNewCatDesc("");
      setIsCatModalOpen(false);
      if (refetchCategories) {
        refetchCategories();
      }
    }
  };

  const pickCusImage = async (useCamera = false) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Please enable camera access in your settings to snap a customization photo.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Please enable media library access in your settings to pick a photo.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewCusImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Customization image pick error:", error);
      Alert.alert("Error", "Could not pick image.");
    }
  };

  const submitNewCustomization = async () => {
    if (!newCusName.trim()) {
      Alert.alert("Error", "Please enter a customization name.");
      return;
    }
    const parsedPrice = parseInt(newCusPrice) || 0;
    setIsSavingCustom(true);
    const result = await handleCreateCustomization(
      newCusName,
      parsedPrice,
      newCusType,
      newCusImage || undefined
    );
    setIsSavingCustom(false);
    if (result) {
      setNewCusName("");
      setNewCusPrice("");
      setNewCusImage(null);
      setIsCusModalOpen(false);
    }
  };

  const closeCusModal = () => {
    setNewCusName("");
    setNewCusPrice("");
    setNewCusImage(null);
    setIsCusModalOpen(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-5 bg-gray-50">
        <View>
          <Text className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Quicksand-Bold" }}>
            {isEditMode ? "Edit Menu Listing" : "Add Menu Listing"}
          </Text>
          <Text className="text-xs text-gray-400 mt-1" style={{ fontFamily: "Quicksand-Medium" }}>
            {isEditMode ? "Update details for an existing dish" : "Create a new delicious dish for your catalog"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* ADD DISH SCROLLABLE FORM */}
        <ScrollView className="flex-1 px-5 mt-2" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          <View className="bg-white rounded-3xl p-6 gap-6 shadow-sm shadow-black/5">
            <View className="flex-row items-center gap-3 border-b border-gray-100 pb-4">
              <View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center border border-orange-100/40">
                <Ionicons name="fast-food" size={20} color="#f97316" />
              </View>
              <View>
                <Text className="text-base font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                  {isEditMode ? "Update Menu Item" : "Create Menu Item"}
                </Text>
                <Text className="text-[11px] text-gray-400" style={{ fontFamily: "Quicksand-Medium" }}>
                  {isEditMode ? "Update details on the customer catalog" : "List a new meal on the customer catalog"}
                </Text>
              </View>
            </View>

            {/* Food Photo Picker Box */}
            <View className="gap-2">
              <Text className="text-sm font-bold text-gray-700 pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Food Photo
              </Text>
              <TouchableOpacity
                onPress={() => setIsPhotoSheetOpen(true)}
                activeOpacity={0.85}
              >
                {imageUri ? (
                  <View className="relative w-full h-48 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200/50">
                    <Image source={{ uri: imageUri }} className="w-full h-full object-cover" style={{ resizeMode: "cover" }} />
                    <View className="absolute bottom-3 right-3 bg-black/60 px-4 py-2 rounded-xl flex-row items-center gap-1.5">
                      <Ionicons name="camera" size={14} color="#fff" />
                      <Text className="text-white text-xs font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                        Change Photo
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="w-full border border-dashed border-gray-300 rounded-3xl p-8 items-center justify-center bg-gray-50/50 gap-3">
                    <View className="w-12 h-12 bg-orange-50 rounded-full items-center justify-center border border-orange-100/40">
                      <Ionicons name="camera-outline" size={22} color="#f97316" />
                    </View>
                    <View className="items-center">
                      <Text className="text-sm font-bold text-gray-700" style={{ fontFamily: "Quicksand-Bold" }}>
                        Tap to Upload Food Photo
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5 text-center" style={{ fontFamily: "Quicksand-Medium" }}>
                        Provide a vibrant photo to attract more orders
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Food Item Name */}
            <View className="gap-2">
              <Text className="text-sm font-bold text-gray-700 pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Food Item Name
              </Text>
              <TextInput
                placeholder="e.g. Classic Cheeseburger"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200/60 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Price & Category */}
            <View className="flex-row gap-4">
              <View className="flex-1 gap-2">
                <Text className="text-sm font-bold text-gray-700 pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                  Price ($ USD)
                </Text>
                <TextInput
                  placeholder="e.g. 12.99"
                  placeholderTextColor="#9ca3af"
                  className="bg-gray-50 border border-gray-200/60 rounded-2xl p-4 text-sm font-semibold text-gray-800 h-[52px]"
                  style={{ fontFamily: "Quicksand-SemiBold" }}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>

              <View className="flex-1 gap-2">
                <Text className="text-sm font-bold text-gray-700 pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                  Category
                </Text>
                <TouchableOpacity
                  onPress={() => setIsCategorySheetOpen(true)}
                  className="bg-gray-50 border border-gray-200/60 rounded-2xl p-4 flex-row items-center justify-between h-[52px]"
                  activeOpacity={0.8}
                >
                  <Text
                    className={`text-sm font-semibold ${selectedCategoryName ? "text-gray-800" : "text-gray-400"}`}
                    style={{ fontFamily: "Quicksand-SemiBold" }}
                  >
                    {selectedCategoryName || "Select..."}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Description */}
            <View className="gap-2">
              <Text className="text-sm font-bold text-gray-700 pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                Description / Ingredients
              </Text>
              <TextInput
                placeholder="Beef patty, melted cheddar cheese, tomato, lettuce, special sauce..."
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200/60 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Calories & Protein */}
            <View className="flex-row gap-4">
              <View className="flex-1 gap-2">
                <Text className="text-sm font-bold text-gray-700 pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                  Calories
                </Text>
                <TextInput
                  placeholder="350"
                  placeholderTextColor="#9ca3af"
                  className="bg-gray-50 border border-gray-200/60 rounded-2xl p-4 text-sm font-semibold text-gray-800 h-[52px]"
                  style={{ fontFamily: "Quicksand-SemiBold" }}
                  keyboardType="numeric"
                  value={calories}
                  onChangeText={setCalories}
                />
              </View>

              <View className="flex-1 gap-2">
                <Text className="text-sm font-bold text-gray-700 pl-1" style={{ fontFamily: "Quicksand-Bold" }}>
                  Protein (g)
                </Text>
                <TextInput
                  placeholder="22"
                  placeholderTextColor="#9ca3af"
                  className="bg-gray-50 border border-gray-200/60 rounded-2xl p-4 text-sm font-semibold text-gray-800 h-[52px]"
                  style={{ fontFamily: "Quicksand-SemiBold" }}
                  keyboardType="numeric"
                  value={protein}
                  onChangeText={setProtein}
                />
              </View>
            </View>

            {/* Add-ons & Customizations Section */}
            <View className="border-t border-gray-100 pt-5 gap-5">
              <View>
                <Text className="text-base font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                  Add-ons & Customizations
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
                  Toggle customization extras that customers can add to this dish
                </Text>
              </View>

              {loadingCustomizations ? (
                <ActivityIndicator size="small" color="#f97316" className="py-4" />
              ) : (
                <>
                  {/* Select Toppings Selection */}
                  <View className="gap-2.5">
                    <View className="flex-row justify-between items-center pl-1">
                      <Text className="text-sm font-bold text-gray-700" style={{ fontFamily: "Quicksand-Bold" }}>
                        Select Toppings
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setNewCusType("topping");
                          setIsCusModalOpen(true);
                        }}
                        className="flex-row items-center bg-orange-50 border border-orange-100 rounded-xl px-2.5 py-1.5"
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={12} color="#f97316" />
                        <Text className="text-orange-500 text-[10px] font-bold ml-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                          Custom
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {customizations
                        .filter((cus: any) => cus.type === "topping")
                        .map((cus: any) => {
                          const isSelected = selectedToppings.includes(cus.$id);
                          return (
                            <TouchableOpacity
                              key={cus.$id}
                              onPress={() => toggleTopping(cus.$id)}
                              className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                                isSelected
                                  ? "bg-orange-50 border-orange-500"
                                  : "bg-white border-gray-200"
                              }`}
                              activeOpacity={0.8}
                            >
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={14} color="#f97316" />
                              )}
                              <Text
                                className={`text-xs font-semibold ${
                                  isSelected ? "text-orange-600" : "text-gray-600"
                                }`}
                                style={{ fontFamily: "Quicksand-SemiBold" }}
                              >
                                {cus.name}
                              </Text>
                              <Text
                                className={`text-[10px] ${
                                  isSelected ? "text-orange-500" : "text-gray-400"
                                }`}
                                style={{ fontFamily: "Quicksand-Medium" }}
                              >
                                (+${(cus.price / 10).toFixed(2)})
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </View>

                  {/* Select Sides Selection */}
                  <View className="gap-2.5 mt-2">
                    <View className="flex-row justify-between items-center pl-1">
                      <Text className="text-sm font-bold text-gray-700" style={{ fontFamily: "Quicksand-Bold" }}>
                        Select Sides / Drinks
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setNewCusType("side");
                          setIsCusModalOpen(true);
                        }}
                        className="flex-row items-center bg-orange-50 border border-orange-100 rounded-xl px-2.5 py-1.5"
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={12} color="#f97316" />
                        <Text className="text-orange-500 text-[10px] font-bold ml-0.5" style={{ fontFamily: "Quicksand-Bold" }}>
                          Custom
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {customizations
                        .filter((cus: any) => cus.type === "side")
                        .map((cus: any) => {
                          const isSelected = selectedSides.includes(cus.$id);
                          return (
                            <TouchableOpacity
                              key={cus.$id}
                              onPress={() => toggleSide(cus.$id)}
                              className={`px-3 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                                isSelected
                                  ? "bg-orange-50 border-orange-500"
                                  : "bg-white border-gray-200"
                              }`}
                              activeOpacity={0.8}
                            >
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={14} color="#f97316" />
                              )}
                              <Text
                                className={`text-xs font-semibold ${
                                  isSelected ? "text-orange-600" : "text-gray-600"
                                }`}
                                style={{ fontFamily: "Quicksand-SemiBold" }}
                              >
                                {cus.name}
                              </Text>
                              <Text
                                className={`text-[10px] ${
                                  isSelected ? "text-orange-500" : "text-gray-400"
                                }`}
                                style={{ fontFamily: "Quicksand-Medium" }}
                              >
                                (+${(cus.price / 10).toFixed(2)})
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Primary Action Button (unified height: 56px, rounded: 18px, shadow-offset) */}
            <TouchableOpacity
              className="bg-orange-500 h-[56px] rounded-2xl items-center justify-center flex-row gap-2 mt-4 shadow-md shadow-orange-500/25"
              style={{ borderRadius: 18 }}
              onPress={handlePublishFood}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name={isEditMode ? "save" : "add"} size={20} color="#fff" />
                  <Text className="text-white text-base font-bold" style={{ fontFamily: "Quicksand-Bold" }}>
                    {isEditMode ? "Update Item" : "Add Item to Menu"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* PHOTO SELECTOR BOTTOM SHEET */}
      <Modal
        visible={isPhotoSheetOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPhotoSheetOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <TouchableOpacity className="flex-1" onPress={() => setIsPhotoSheetOpen(false)} />
          <View className="bg-white rounded-t-3xl p-6 pb-10 gap-5 max-h-[50%]">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <Text className="text-lg font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                Select Food Photo
              </Text>
              <TouchableOpacity onPress={() => setIsPhotoSheetOpen(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                setIsPhotoSheetOpen(false);
                handleTakePhoto();
              }}
              className="flex-row items-center gap-4 py-4 border-b border-gray-50"
              activeOpacity={0.75}
            >
              <View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center">
                <Ionicons name="camera" size={20} color="#f97316" />
              </View>
              <View>
                <Text className="text-sm font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                  Take Photo
                </Text>
                <Text className="text-[11px] text-gray-400" style={{ fontFamily: "Quicksand-Medium" }}>
                  Snap a photo of the dish with your camera
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setIsPhotoSheetOpen(false);
                handlePickImage();
              }}
              className="flex-row items-center gap-4 py-4 border-b border-gray-50"
              activeOpacity={0.75}
            >
              <View className="w-10 h-10 bg-orange-50 rounded-full items-center justify-center">
                <Ionicons name="images" size={20} color="#f97316" />
              </View>
              <View>
                <Text className="text-sm font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                  Choose from Gallery
                </Text>
                <Text className="text-[11px] text-gray-400" style={{ fontFamily: "Quicksand-Medium" }}>
                  Pick an existing image from your photo library
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsPhotoSheetOpen(false)}
              className="bg-gray-100 py-3.5 rounded-2xl items-center mt-2"
            >
              <Text className="text-gray-500 font-bold text-sm" style={{ fontFamily: "Quicksand-Bold" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CATEGORY SELECTOR BOTTOM SHEET */}
      <Modal
        visible={isCategorySheetOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCategorySheetOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <TouchableOpacity className="flex-1" onPress={() => setIsCategorySheetOpen(false)} />
          <View className="bg-white rounded-t-3xl p-6 pb-8 gap-4 max-h-[75%]">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <Text className="text-lg font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                Select Category
              </Text>
              <TouchableOpacity onPress={() => setIsCategorySheetOpen(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-grow-0" showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              <View className="gap-1">
                {categoriesData?.map((cat: any) => {
                  const isSelected = categoryId === cat.$id;
                  return (
                    <TouchableOpacity
                      key={cat.$id}
                      onPress={() => {
                        setCategoryId(cat.$id);
                        setIsCategorySheetOpen(false);
                      }}
                      className="flex-row items-center justify-between py-3.5 border-b border-gray-50/50"
                      activeOpacity={0.7}
                    >
                      <View className="flex-1 pr-4">
                        <Text
                          className={`text-sm font-bold ${isSelected ? "text-orange-500" : "text-gray-700"}`}
                          style={{ fontFamily: "Quicksand-Bold" }}
                        >
                          {cat.name}
                        </Text>
                        <Text className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
                          {cat.description || "Fresh listing option"}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#f97316" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setIsCategorySheetOpen(false);
                setIsCatModalOpen(true);
              }}
              className="flex-row items-center justify-center gap-1.5 py-4 border-2 border-dashed border-orange-200 bg-orange-50/30 rounded-2xl mt-2"
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color="#f97316" />
              <Text className="text-orange-500 font-bold text-sm" style={{ fontFamily: "Quicksand-Bold" }}>
                Create New Category
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CREATE CATEGORY MODAL TRIGGER */}
      <Modal
        visible={isCatModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCatModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 gap-5">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="grid-outline" size={20} color="#f97316" />
                <Text className="text-lg font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                  Create New Category
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsCatModalOpen(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-500 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                Category Name
              </Text>
              <TextInput
                placeholder="e.g. Desserts"
                value={newCatName}
                onChangeText={setNewCatName}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-500 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                Description
              </Text>
              <TextInput
                placeholder="e.g. Sweet delicacies and cakes"
                value={newCatDesc}
                onChangeText={setNewCatDesc}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
              />
            </View>

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={() => setIsCatModalOpen(false)}
                className="flex-1 bg-gray-100 py-4 rounded-2xl items-center"
              >
                <Text className="text-gray-500 font-bold text-sm" style={{ fontFamily: "Quicksand-Bold" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitNewCategory}
                className="flex-1 bg-orange-500 py-4 rounded-2xl items-center"
                disabled={isSavingCustom}
              >
                {isSavingCustom ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-sm" style={{ fontFamily: "Quicksand-Bold" }}>
                    Create Category
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CREATE CUSTOMIZATION MODAL TRIGGER */}
      <Modal
        visible={isCusModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={closeCusModal}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 gap-5 animate-slide-up">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="options-outline" size={20} color="#f97316" />
                <Text className="text-lg font-bold text-gray-800" style={{ fontFamily: "Quicksand-Bold" }}>
                  Create Add-on Option
                </Text>
              </View>
              <TouchableOpacity onPress={closeCusModal}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-500 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                Add-on Option Name
              </Text>
              <TextInput
                placeholder="e.g. Extra Cheese or Choco Lava Cake"
                value={newCusName}
                onChangeText={setNewCusName}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
              />
            </View>

            {/* Customization Image Picker (Camera / Gallery / Snapped Preview) */}
            <View className="gap-1.5">
              <Text className="text-xs text-gray-500 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                Add-on Photo (Optional)
              </Text>
              {newCusImage ? (
                <View className="flex-row items-center gap-4 bg-gray-50 border border-gray-200/50 rounded-2xl p-3.5">
                  <View className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-200 border border-gray-300/30">
                    <Image source={{ uri: newCusImage }} className="w-full h-full object-cover" />
                    <TouchableOpacity
                      onPress={() => setNewCusImage(null)}
                      className="absolute -top-1 -right-1 bg-black/60 w-5 h-5 rounded-full items-center justify-center"
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-gray-700" style={{ fontFamily: "Quicksand-Bold" }}>
                      Photo Selected
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-0.5" style={{ fontFamily: "Quicksand-Medium" }}>
                      Vibrant photo displayed next to choice card
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => pickCusImage(true)}
                    className="flex-1 flex-row items-center justify-center gap-2 border border-dashed border-gray-300 bg-gray-50/50 rounded-2xl py-3"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-outline" size={16} color="#4b5563" />
                    <Text className="text-xs font-bold text-gray-600" style={{ fontFamily: "Quicksand-Bold" }}>
                      Take Photo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => pickCusImage(false)}
                    className="flex-1 flex-row items-center justify-center gap-2 border border-dashed border-gray-300 bg-gray-50/50 rounded-2xl py-3"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="images-outline" size={16} color="#4b5563" />
                    <Text className="text-xs font-bold text-gray-600" style={{ fontFamily: "Quicksand-Bold" }}>
                      From Gallery
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-500 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                Price Increment (e.g. 25 = $2.50)
              </Text>
              <TextInput
                placeholder="e.g. 25"
                value={newCusPrice}
                onChangeText={setNewCusPrice}
                keyboardType="numeric"
                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-semibold text-gray-800"
                style={{ fontFamily: "Quicksand-SemiBold" }}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs text-gray-500 font-bold uppercase tracking-wider" style={{ fontFamily: "Quicksand-Bold" }}>
                Option Type
              </Text>
              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={() => setNewCusType("topping")}
                  className={`flex-1 py-3.5 border rounded-2xl items-center flex-row justify-center gap-2 ${
                    newCusType === "topping"
                      ? "bg-orange-50 border-orange-500"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Ionicons
                    name="pizza"
                    size={16}
                    color={newCusType === "topping" ? "#f97316" : "#6b7280"}
                  />
                  <Text
                    className={`text-sm font-bold ${
                      newCusType === "topping" ? "text-orange-500" : "text-gray-500"
                    }`}
                    style={{ fontFamily: "Quicksand-Bold" }}
                  >
                    Topping
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setNewCusType("side")}
                  className={`flex-1 py-3.5 border rounded-2xl items-center flex-row justify-center gap-2 ${
                    newCusType === "side"
                      ? "bg-orange-50 border-orange-500"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Ionicons
                    name="wine"
                    size={16}
                    color={newCusType === "side" ? "#f97316" : "#6b7280"}
                  />
                  <Text
                    className={`text-sm font-bold ${
                      newCusType === "side" ? "text-orange-500" : "text-gray-500"
                    }`}
                    style={{ fontFamily: "Quicksand-Bold" }}
                  >
                    Side / Drink
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={closeCusModal}
                className="flex-1 bg-gray-100 py-4 rounded-2xl items-center"
              >
                <Text className="text-gray-500 font-bold text-sm" style={{ fontFamily: "Quicksand-Bold" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitNewCustomization}
                className="flex-1 bg-orange-500 py-4 rounded-2xl items-center"
                disabled={isSavingCustom}
              >
                {isSavingCustom ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-sm" style={{ fontFamily: "Quicksand-Bold" }}>
                    Create Option
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
