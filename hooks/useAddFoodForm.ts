import React, { useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ID } from "react-native-appwrite";
import AppwriteContext from "../app/lib/services/auth_services/AppwirteContext";
import {
  APPWRITE_DATABASE_ID,
  MENU_COLLECTION_ID,
  MENU_CUSTOMIZATIONS_COLLECTION_ID,
  CATEGORIES_COLLECTION_ID,
  CUSTOMIZATIONS_COLLECTION_ID,
} from "../app/lib/services/auth_services/appwrite";
import { addMyFoodItem } from "../app/hotel/_menuState";

export default function useAddFoodForm() {
  const { user, appwrite } = useContext(AppwriteContext);
  const router = useRouter();

  // Form Field States
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("350");
  const [protein, setProtein] = useState("22");
  const [categoryId, setCategoryId] = useState("");
  
  // Customization States
  const [customizations, setCustomizations] = useState<any[]>([]);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [loadingCustomizations, setLoadingCustomizations] = useState(false);

  // Image Upload State
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch customizations from database on mount
  const fetchCustomizations = async () => {
    setLoadingCustomizations(true);
    try {
      const allCus = await appwrite.getCustomizations();
      setCustomizations(allCus);
    } catch (err) {
      console.error("Failed to load customizations:", err);
    } finally {
      setLoadingCustomizations(false);
    }
  };

  useEffect(() => {
    fetchCustomizations();
  }, []);

  const toggleTopping = (id: string) => {
    setSelectedToppings((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSide = (id: string) => {
    setSelectedSides((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please enable photo library access in your settings to select a food photo.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Gallery launch error:", error);
      Alert.alert("Error", "Could not open your gallery. Please rebuild the app or try again.");
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please enable camera access in your settings to snap a food photo.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Camera launch error:", error);
      Alert.alert("Error", "Could not open your camera. Please rebuild the app or try again.");
    }
  };

  const handlePublishFood = async () => {
    if (!name.trim()) {
      Alert.alert("Field Required", "Please enter a food item name.");
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      Alert.alert("Field Required", "Please enter a valid price (number).");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Field Required", "Please enter a description.");
      return;
    }
    if (!categoryId) {
      Alert.alert("Field Required", "Please select a category.");
      return;
    }
    if (!imageUri) {
      Alert.alert("Image Required", "Please snap a food photo or select one from the gallery.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload local image to Appwrite storage bucket
      const uploadedUrl = await appwrite.uploadFile(imageUri);
      if (!uploadedUrl) {
        throw new Error("Failed to upload food image to Appwrite storage.");
      }

      // 2. Insert dish item into menu collection
      const menuItemId = ID.unique();
      let menuDoc;
      try {
        menuDoc = await appwrite.database.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: MENU_COLLECTION_ID,
          rowId: menuItemId,
          data: {
            name: name.trim(),
            description: description.trim(),
            price: parseFloat(price) || 9.99,
            rating: 4.5,
            calories: parseInt(calories) || 350,
            protein: parseInt(protein) || 20,
            image_url: uploadedUrl,
            categories: categoryId,
            userId: user?.$id,
          },
        });
      } catch (schemaError: any) {
        console.log("Appwrite menu schema lacks userId attribute or validation failed. Retrying without it...");
        menuDoc = await appwrite.database.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: MENU_COLLECTION_ID,
          rowId: menuItemId,
          data: {
            name: name.trim(),
            description: description.trim(),
            price: parseFloat(price) || 9.99,
            rating: 4.5,
            calories: parseInt(calories) || 350,
            protein: parseInt(protein) || 20,
            image_url: uploadedUrl,
            categories: categoryId,
          },
        });
      }

      if (!menuDoc) {
        throw new Error("Failed to write menu item into the database.");
      }

      // 3. Batch seed selections inside menu_customizations collection linking menu item to customizations
      const allSelectedCustomizations = [...selectedToppings, ...selectedSides];
      for (const cusId of allSelectedCustomizations) {
        await appwrite.database.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: MENU_CUSTOMIZATIONS_COLLECTION_ID,
          rowId: ID.unique(),
          data: {
            menu: menuItemId,
            customizations: cusId,
          },
        });
      }

      // 4. Update the local catalog state
      const localFoodItem = {
        $id: menuItemId,
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price) || 9.99,
        calories: parseInt(calories) || 350,
        protein: parseInt(protein) || 20,
        image_url: uploadedUrl,
      };
      addMyFoodItem(localFoodItem);

      Alert.alert("Listing Published", `Dish "${name.trim()}" and its customizations have been listed successfully!`);
      
      // Clear inputs
      setName("");
      setPrice("");
      setDescription("");
      setImageUri(null);
      setSelectedToppings([]);
      setSelectedSides([]);

      router.push("/hotel" as any);
    } catch (err: any) {
      console.error("Failed to add new food dish:", err);
      Alert.alert("Publish Failed", "Could not upload the details to Appwrite. Please verify database columns and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async (catName: string, catDesc: string) => {
    if (!catName.trim()) {
      Alert.alert("Error", "Please enter a category name.");
      return null;
    }
    try {
      const newCatDoc = await appwrite.database.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: CATEGORIES_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          name: catName.trim(),
          description: catDesc.trim() || "Delicious option",
        },
      });
      if (newCatDoc) {
        setCategoryId(newCatDoc.$id);
        Alert.alert("Category Created", `Category "${catName.trim()}" has been created and selected.`);
        return newCatDoc;
      }
    } catch (error) {
      console.error("Failed to create category:", error);
      Alert.alert("Error", "Failed to create category in database.");
    }
    return null;
  };

  const handleCreateCustomization = async (
    cusName: string,
    cusPrice: number,
    cusType: "topping" | "side",
    imageUri?: string
  ) => {
    if (!cusName.trim()) {
      Alert.alert("Error", "Please enter a customization name.");
      return null;
    }
    try {
      let uploadedUrl: string | null = null;
      if (imageUri) {
        uploadedUrl = await appwrite.uploadFile(imageUri);
      }

      const baseData: any = {
        name: cusName.trim(),
        price: cusPrice || 0,
        type: cusType,
      };

      try {
        const docData = { ...baseData };
        if (uploadedUrl) {
          docData.image_url = uploadedUrl;
        }

        const newCusDoc = await appwrite.database.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: CUSTOMIZATIONS_COLLECTION_ID,
          rowId: ID.unique(),
          data: docData,
        });

        if (newCusDoc) {
          await fetchCustomizations();
          
          if (cusType === "topping") {
            setSelectedToppings((prev) => [...prev, newCusDoc.$id]);
          } else {
            setSelectedSides((prev) => [...prev, newCusDoc.$id]);
          }
          
          Alert.alert("Add-on Created", `"${cusName.trim()}" has been added and selected.`);
          return newCusDoc;
        }
      } catch (schemaError: any) {
        const errorStr = String(schemaError);
        if (errorStr.includes("image_url") || errorStr.includes("Attribute") || errorStr.includes("not found")) {
          console.log("Appwrite customizations schema lacks image_url attribute. Retrying without it...");
          
          const fallbackDoc = await appwrite.database.createRow({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: CUSTOMIZATIONS_COLLECTION_ID,
            rowId: ID.unique(),
            data: baseData,
          });

          if (fallbackDoc) {
            await fetchCustomizations();
            
            if (cusType === "topping") {
              setSelectedToppings((prev) => [...prev, fallbackDoc.$id]);
            } else {
              setSelectedSides((prev) => [...prev, fallbackDoc.$id]);
            }
            
            Alert.alert(
              "Add-on Created (No Image)",
              `"${cusName.trim()}" was created without an image because the "image_url" attribute is missing in your Appwrite customization collection. Please add an optional "image_url" String attribute in your Appwrite Console to enable custom images.`
            );
            return fallbackDoc;
          }
        } else {
          throw schemaError;
        }
      }
    } catch (error) {
      console.error("Failed to create customization:", error);
      Alert.alert("Error", "Failed to create customization in database.");
    }
    return null;
  };

  return {
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
    setImageUri,
    isSubmitting,
    handlePickImage,
    handleTakePhoto,
    handlePublishFood,
    handleCreateCategory,
    handleCreateCustomization,
  };
}
