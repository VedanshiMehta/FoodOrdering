import { ID } from "react-native-appwrite";
import dummyData from "./data";
import AppwriteService, {
  APPWRITE_DATABASE_ID,
  CATEGORIES_COLLECTION_ID,
  CUSTOMIZATIONS_COLLECTION_ID,
  MENU_COLLECTION_ID,
  MENU_CUSTOMIZATIONS_COLLECTION_ID,
  STORAGE_BUCKET_ID,
} from "./services/auth_services/appwrite";

const appwrite = new AppwriteService();

interface Category {
  name: string;
  description: string;
}

interface Customization {
  name: string;
  price: number;
  type: "topping" | "side" | "size" | "crust" | string; // extend as needed
}

interface MenuItem {
  name: string;
  description: string;
  image_url: string;
  price: number;
  rating: number;
  calories: number;
  protein: number;
  category_name: string;
  customizations: string[]; // list of customization names
}

interface DummyData {
  categories: Category[];
  customizations: Customization[];
  menu: MenuItem[];
}

// ensure dummyData has correct shape
const data = dummyData as DummyData;

async function clearAll(collectionId: string): Promise<void> {
  const list = await appwrite.database.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: collectionId,
  });

  await Promise.all(
    list.rows.map((doc) =>
      appwrite.database.deleteRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: collectionId,
        rowId: doc.$id,
      }),
    ),
  );
}

async function clearStorage(): Promise<void> {
  const list = await appwrite.storage.listFiles({
    bucketId: STORAGE_BUCKET_ID,
  });

  await Promise.all(
    list.files.map((file) =>
      appwrite.storage.deleteFile({
        bucketId: STORAGE_BUCKET_ID,
        fileId: file.$id,
      }),
    ),
  );
}

async function uploadImageToStorage(imageUrl: string) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  const fileObj = {
    name: imageUrl.split("/").pop() || `file-${Date.now()}.jpg`,
    type: blob.type,
    size: blob.size,
    uri: imageUrl,
  };

  const file = await appwrite.storage.createFile({
    bucketId: STORAGE_BUCKET_ID,
    fileId: ID.unique(),
    file: fileObj,
  });

  return appwrite.storage.getFileViewURL(STORAGE_BUCKET_ID, file.$id);
}

async function seed(): Promise<void> {
  // 1. Clear all
  await clearAll(CATEGORIES_COLLECTION_ID);
  await clearAll(CUSTOMIZATIONS_COLLECTION_ID);
  await clearAll(MENU_COLLECTION_ID);
  await clearAll(MENU_CUSTOMIZATIONS_COLLECTION_ID);
  await clearStorage();
  console.log("✅ Seeding Started.");
  // 2. Create Categories
  const categoryMap: Record<string, string> = {};
  for (const cat of data.categories) {
    const doc = await appwrite.database.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: CATEGORIES_COLLECTION_ID,
      rowId: ID.unique(),
      data: cat,
    });
    categoryMap[cat.name] = doc.$id;
  }

  // 3. Create Customizations
  const customizationMap: Record<string, string> = {};
  for (const cus of data.customizations) {
    const doc = await appwrite.database.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: CUSTOMIZATIONS_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        name: cus.name,
        price: cus.price,
        type: cus.type,
      },
    });
    customizationMap[cus.name] = doc.$id;
  }

  // 4. Create Menu Items
  const menuMap: Record<string, string> = {};
  for (const item of data.menu) {
    const uploadedImage = await uploadImageToStorage(item.image_url);

    const doc = await appwrite.database.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: MENU_COLLECTION_ID,
      rowId: ID.unique(),
      data: {
        name: item.name,
        description: item.description,
        image_url: uploadedImage,
        price: item.price,
        rating: item.rating,
        calories: item.calories,
        protein: item.protein,
        categories: categoryMap[item.category_name],
      },
    });

    menuMap[item.name] = doc.$id;

    // 5. Create menu_customizations
    for (const cusName of item.customizations) {
      await appwrite.database.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: MENU_CUSTOMIZATIONS_COLLECTION_ID,
        rowId: ID.unique(),
        data: {
          menu: doc.$id,
          customizations: customizationMap[cusName],
        },
      });
    }
  }

  console.log("✅ Seeding complete.");
}

export default seed;
