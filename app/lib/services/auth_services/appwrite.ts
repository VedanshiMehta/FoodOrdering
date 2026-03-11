import { CreateUserPrams, SignInParams } from "@/type";
import {
  Account,
  Avatars,
  Client,
  ID,
  Query,
  TablesDB,
} from "react-native-appwrite";
import utils from "../../../utils/utils";

const appwriteClient = new Client();

const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const APPWRITE_USERS_COLLECTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID!;

class AppwriteService {
  account;
  database;
  avatars;

  constructor() {
    appwriteClient
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID);

    this.account = new Account(appwriteClient);
    this.database = new TablesDB(appwriteClient);
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
}

export default AppwriteService;
