import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { getApiUrl } from "./api";
import Constants from "expo-constants";

interface User {
  id: number;
  email: string;
  name: string;
  surname: string;
  role: "customer" | "owner" | "admin";
  photo_url?: string;
  reliability_score?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Requests permission, gets an Expo push token, and saves it to the backend.
// Safe to call multiple times — no-ops on simulators or if permission is denied.
async function registerPushToken(authToken: string) {
  try {
    if (!Device.isDevice) return;

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[Reserva] Push notification permission not granted");
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenData.data;

    await fetch(getApiUrl("/api/user/push-token"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ push_token: pushToken }),
    });
  } catch (err) {
    console.error("[Reserva] Push token registration error:", err);
  }
}
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Define logout first so it can be referenced inside useEffect below
  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("reserva_token");
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (newToken: string, newUser: User) => {
    await AsyncStorage.setItem("reserva_token", newToken);
    setToken(newToken);
    setUser(newUser);
    registerPushToken(newToken);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("reserva_token");
        if (storedToken) {
          setToken(storedToken);
          const res = await fetch(getApiUrl("/api/me"), {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          const text = await res.text();
          if (res.ok) {
            try {
              const data = JSON.parse(text);
              setUser(data);
              setToken(storedToken);
              registerPushToken(storedToken);
            } catch (parseError) {
              console.error(
                "Auth context parse error:",
                parseError,
                "Response text:",
                text,
              );
              await logout();
            }
          } else {
            console.warn(
              "Auth init failed with status:",
              res.status,
              "Response:",
              text,
            );
            await logout();
          }
        }
      } catch (e) {
        console.error("Auth init error:", e);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
