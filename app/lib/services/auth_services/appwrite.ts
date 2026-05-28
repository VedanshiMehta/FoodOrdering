import { CreateUserPrams, GetMenuParams, SignInParams } from "@/type";
import {
  Account,
  Avatars,
  Client,
  ID,
  Query,
  Storage,
  TablesDB,
} from "react-native-appwrite";
import utils from "../../../utils/utils";

const appwriteClient = new Client();

export const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!;
export const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!;
export const APPWRITE_PLATFORM =
  process.env.EXPO_PUBLIC_APPWRITE_PLATFORM ?? "com.anonymous.FoodDelivery";
export const APPWRITE_DATABASE_ID =
  process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
export const APPWRITE_USERS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID!;
export const STORAGE_BUCKET_ID = process.env.EXPO_PUBLIC_APPWRITE_BUCKET_ID!;
export const CATEGORIES_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_CATEGORIES_COLLECTION_ID!;
export const MENU_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_MENU_COLLECTION_ID!;
export const CUSTOMIZATIONS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_CUSTOMIZATIONS_COLLECTION_ID!;
export const MENU_CUSTOMIZATIONS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_MENU_CUSTOMIZATIONS_COLLECTION_ID!;

class AppwriteService {
  account;
  database;
  storage;
  avatars;

  constructor() {
    appwriteClient
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setPlatform(APPWRITE_PLATFORM);

    this.account = new Account(appwriteClient);
    this.database = new TablesDB(appwriteClient);
    this.storage = new Storage(appwriteClient);
    this.avatars = new Avatars(appwriteClient);
  }

  //create a new record of user inside appwrite
  async createAccount({ email, password, name }: CreateUserPrams) {
    try {
      const userAccount = await this.account.create({
        userId: ID.unique(),
        email: email,
        password: password,
        name: name,
      });
      if (userAccount) {
        this.login({ email, password });
        const avatarUrl = this.avatars.getInitialsURL(name);
        return await this.database.createRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_USERS_COLLECTION_ID,
          rowId: userAccount.$id,
          data: {
            accountID: userAccount.$id,
            email: email,
            name: name,
            avatar: avatarUrl,
          },
        });
      } else {
        throw new Error("Failed to create user account");
      }
    } catch (error) {
      utils.showAlert(String(error), "Error");
      console.log("Appwrite service :: createAccount() :: " + error);
    }
  }

  async login({ email, password }: SignInParams) {
    try {
      try {
        await this.account.deleteSession("current");
      } catch (e) {
        // Ignored. Just means no session existed.
      }
      return await this.account.createEmailPasswordSession({
        email: email,
        password: password,
      });
    } catch (error) {
      utils.showAlert(String(error), "Error");
      console.log("Appwrite service :: loginAccount() :: " + error);
    }
  }

  async getCurrentUser() {
    try {
      const currentAccount = await this.account.get();
      if (!currentAccount) throw new Error("No user logged in");
      const currentUser = await this.database.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_USERS_COLLECTION_ID,
        queries: [Query.equal("accountID", currentAccount.$id)],
      });
      if (!currentUser) throw new Error("User not found in database");
      const user = currentUser.rows[0];
      return {
        $id: user.$id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phoneNumber: user.phoneNumber || null,
        address: user.address || null,
        addressLabel: user.addressLabel || null,
        latitude: user.latitude !== undefined && user.latitude !== null ? parseFloat(user.latitude) : null,
        longitude: user.longitude !== undefined && user.longitude !== null ? parseFloat(user.longitude) : null,
      };
    } catch (error) {
      const message = String(error);
      if (
        !message.includes("role: guests") &&
        !message.includes("missing scopes")
      ) {
        console.log("Appwrite service :: getCurrentUser() :: " + error);
      }
      return null;
    }
  }

  async updateUserProfile({
    userId,
    phoneNumber,
    address,
    addressLabel,
    latitude,
    longitude,
  }: {
    userId: string;
    phoneNumber: string;
    address: string;
    addressLabel: string;
    latitude?: number;
    longitude?: number;
  }) {
    try {
      const data: any = {
        phoneNumber: phoneNumber,
        address: address,
        addressLabel: addressLabel,
      };
      if (latitude !== undefined && latitude !== null) {
        data.latitude = String(latitude);
      }
      if (longitude !== undefined && longitude !== null) {
        data.longitude = String(longitude);
      }
      return await this.database.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_USERS_COLLECTION_ID,
        rowId: userId,
        data,
      });
    } catch (error) {
      console.log("Appwrite service :: updateUserProfile() with coordinates failed: " + error + ". Retrying without coordinates...");
      try {
        return await this.database.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_USERS_COLLECTION_ID,
          rowId: userId,
          data: {
            phoneNumber: phoneNumber,
            address: address,
            addressLabel: addressLabel,
          },
        });
      } catch (innerError) {
        console.log("Appwrite service :: updateUserProfile() fallback failed: " + innerError + ". Falling back to local state.");
        return null;
      }
    }
  }

  async updateUserBasicInfo({
    userId,
    name,
    phoneNumber,
  }: {
    userId: string;
    name: string;
    phoneNumber: string;
  }) {
    try {
      // 1. Update name on Account service
      try {
        await this.account.updateName(name);
      } catch (accountError) {
        console.log("Appwrite service :: updateName on account failed: " + accountError);
      }

      // 2. Update name and phone number on database row
      const avatarUrl = this.avatars.getInitialsURL(name);
      return await this.database.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_USERS_COLLECTION_ID,
        rowId: userId,
        data: {
          name: name,
          phoneNumber: phoneNumber,
          avatar: avatarUrl,
        },
      });
    } catch (error) {
      console.log("Appwrite service :: updateUserBasicInfo() failed: " + error);
      return null;
    }
  }

  async uploadProfileImage({
    userId,
    imageUri,
  }: {
    userId: string;
    imageUri: string;
  }) {
    try {
      // 1. Fetch details to build the Appwrite file object
      const response = await fetch(imageUri);
      const blob = await response.blob();

      const fileObj = {
        name: imageUri.split("/").pop() || `avatar-${Date.now()}.jpg`,
        type: blob.type || "image/jpeg",
        size: blob.size,
        uri: imageUri,
      };

      // 2. Upload to storage bucket
      const file = await this.storage.createFile({
        bucketId: STORAGE_BUCKET_ID,
        fileId: ID.unique(),
        file: fileObj,
      });

      // 3. Get file preview URL
      const avatarUrl = this.storage.getFileViewURL(STORAGE_BUCKET_ID, file.$id);

      // 4. Update the user database row with the new avatar URL
      return await this.database.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_USERS_COLLECTION_ID,
        rowId: userId,
        data: {
          avatar: avatarUrl,
        },
      });
    } catch (error) {
      console.log("Appwrite service :: uploadProfileImage() failed: " + error);
      return null;
    }
  }

  async logout() {
    try {
      return await this.account.deleteSessions();
    } catch (error) {
      console.log("Appwrite service :: getCurrentAccount() :: " + error);
    }
  }
  getMenu = async ({ category, query }: GetMenuParams) => {
    try {
      const filters = [];
      if (category) filters.push(Query.equal("categories", category));
      if (query) filters.push(Query.search("name", query));

      const menuItems = await this.database.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: MENU_COLLECTION_ID,
        queries: filters,
      });
      return menuItems.rows;
    } catch (error) {
      console.log("Appwrite service :: getMenu() :: " + error);
    }
  };

  getMenuItem = async (itemId: string) => {
    try {
      return await this.database.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: MENU_COLLECTION_ID,
        rowId: itemId,
      });
    } catch (error) {
      console.log("Appwrite service :: getMenuItem() :: " + error);
      return null;
    }
  };

  getCategories = async () => {
    const categories = await this.database.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: CATEGORIES_COLLECTION_ID,
    });
    return categories.rows;
  };

  createOrder = async (orderData: any) => {
    try {
      const doc = await this.database.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "orders",
        rowId: ID.unique(),
        data: {
          orderId: orderData.id,
          total: orderData.total,
          paymentMethod: orderData.paymentMethod,
          address: orderData.address,
          timestamp: orderData.timestamp,
          items: JSON.stringify(orderData.items),
          userId: orderData.userId || "guest",
          userName: orderData.userName || "Guest User",
        },
      });
      return doc;
    } catch (error) {
      console.log("Appwrite service :: createOrder() :: " + error + ". Falling back to local state.");
      return null;
    }
  };

  getOrders = async (userId?: string) => {
    try {
      const queries = [];
      if (userId) {
        queries.push(Query.equal("userId", userId));
      }
      const orders = await this.database.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: "orders",
        queries: queries,
      });
      return orders.rows.map((row: any) => ({
        id: row.orderId,
        total: row.total,
        paymentMethod: row.paymentMethod,
        address: row.address,
        timestamp: row.timestamp,
        userId: row.userId || null,
        userName: row.userName || null,
        items: JSON.parse(row.items),
      }));
    } catch (error) {
      console.log("Appwrite service :: getOrders() :: " + error + ". Falling back to local state.");
      return null;
    }
  };
}

export default AppwriteService;
