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
      .setProject(APPWRITE_PROJECT_ID);

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
        await this.account.deleteSession('current');
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
      };
    } catch (error) {
      console.log("Appwrite service :: getCurrentAccount() :: " + error);
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
  getCategories = async () => {
    const categories = await this.database.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: CATEGORIES_COLLECTION_ID,
    });
    return categories.rows;
  };
}

export default AppwriteService;
