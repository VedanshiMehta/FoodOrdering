import { User } from "@/type";
import React, {
  FC,
  PropsWithChildren,
  createContext,
  useMemo,
  useState,
} from "react";
import Appwrite from "./appwrite";

type AppContextType = {
  appwrite: Appwrite;
  isLoggedIn: boolean;
  user: User | null;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  setUser: (user: User | null) => void;
};

export const AppwriteContext = createContext<AppContextType>({
  appwrite: new Appwrite(),
  user: null,
  isLoggedIn: false,
  setIsLoggedIn: () => {},
  setUser: () => {},
});

export const AppwriteProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const appwriteInstance = useMemo(() => new Appwrite(), []);
  console.log(isLoggedIn);

  const contextValue = useMemo(() => {
    return {
      appwrite: appwriteInstance, // Use the memoized instance
      isLoggedIn,
      user,
      setIsLoggedIn,
      setUser,
    };
  }, [appwriteInstance, user, isLoggedIn, setIsLoggedIn, setUser]); // Dependencies for re-calculation

  return (
    <AppwriteContext.Provider value={contextValue}>
      {children}
    </AppwriteContext.Provider>
  );
};

export default AppwriteContext;
