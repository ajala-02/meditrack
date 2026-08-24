import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorageLib from "@react-native-async-storage/async-storage";
const AsyncStorage = AsyncStorageLib.default || AsyncStorageLib;
import api from "../api/axios";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (!storedUser) {
          setLoading(false);
          return;
        }

        // Try to refresh token or assume we're good until a 401 hits
        const { data } = await api.post("/auth/refresh");
        await AsyncStorage.setItem("accessToken", data.accessToken);
        
        // Wait, refresh endpoint doesn't return the full user. 
        // For mobile we rely on the stored user object, but we could fetch /api/patients/me if needed.
        // For now, storedUser has the condition.
        setUser(JSON.parse(storedUser));
      } catch (error) {
        // Refresh failed or no session, clear whatever we have
        await AsyncStorage.multiRemove(["accessToken", "user"]);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email, joinCode) => {
    // We send joinCode instead of password for patients
    const { data } = await api.post("/auth/login", { email, joinCode });

    await AsyncStorage.setItem("accessToken", data.accessToken);
    await AsyncStorage.setItem("user", JSON.stringify(data.user));

    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore errors on logout
    } finally {
      await AsyncStorage.multiRemove(["accessToken", "user"]);
      setUser(null);
    }
  }, []);

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
