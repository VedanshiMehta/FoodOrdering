import { User } from "@/type";
import React, {
  FC,
  PropsWithChildren,
  createContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import Appwrite from "./appwrite";

type AppContextType = {
  appwrite: Appwrite;
  isLoggedIn: boolean;
  user: User | null;
  isLoading: boolean;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  setUser: (user: User | null) => void;
};

export const AppwriteContext = createContext<AppContextType>({
  appwrite: new Appwrite(),
  user: null,
  isLoggedIn: false,
  isLoading: true,
  setIsLoggedIn: () => {},
  setUser: () => {},
});

export const AppwriteProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appwriteInstance = useMemo(() => new Appwrite(), []);

  useEffect(() => {
    appwriteInstance
      .getCurrentUser()
      .then((response) => {
        if (response) {
          setIsLoggedIn(true);
          setUser(response as User);
        } else {
          setIsLoggedIn(false);
          setUser(null);
        }
      })
      .catch((error) => {
        console.log("AppwriteProvider session restoration failed:", error);
        setIsLoggedIn(false);
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [appwriteInstance]);

  const contextValue = useMemo(() => {
    return {
      appwrite: appwriteInstance,
      isLoggedIn,
      user,
      isLoading,
      setIsLoggedIn,
      setUser,
    };
  }, [appwriteInstance, user, isLoggedIn, isLoading, setIsLoggedIn, setUser]);

  return (
    <AppwriteContext.Provider value={contextValue}>
      {children}
    </AppwriteContext.Provider>
  );
};

export default AppwriteContext;
