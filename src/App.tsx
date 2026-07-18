import React, { useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Platform } from "react-native";
import {
  Home,
  Bookmark,
  User as UserIcon,
  LayoutDashboard,
  CalendarDays,
  BarChart2,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { theme } from "./theme";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { LanguageProvider } from "./lib/LanguageContext";
import SplashScreen from "./components/Splashscreen";

import CustomerDashboard from "./pages/customer/Dashboard";
import Collections from "./pages/customer/Collections";
import Profile from "./pages/customer/Profile";
import RestaurantDetail from "./pages/RestaurantDetail";
import ReservationPage from "./pages/ReservationPage";
import OwnerDashboard from "./pages/owner/Dashboard";
import OwnerReservations from "./pages/owner/Reservations";
import OwnerAnalytics from "./pages/owner/Analytics";
import OwnerSettings from "./pages/owner/Settings";
import AdminDashboard from "./pages/admin/Dashboard";
import AuthPage from "./pages/AuthPage";
import { useFonts } from "expo-font";
import { SettingsProvider } from "./lib/SettingsContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function CustomerTabs() {
  return (
    <Tab.Navigator
      id="customer-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: theme.colors.charcoal,
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 88 : 72,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
          paddingTop: 12,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          ...theme.shadows.premium,
        },
        tabBarActiveTintColor: theme.colors.oliveAccent,
        tabBarInactiveTintColor: "rgba(255, 255, 255, 0.3)",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: 1.2,
        },
        tabBarIcon: ({ color, focused }) => {
          let icon;
          const iconSize = 22;
          const sw = focused ? 2.2 : 1.5;
          if (route.name === "Home") {
            icon = <Home size={iconSize} color={color} strokeWidth={sw} />;
          } else if (route.name === "Saved") {
            icon = <Bookmark size={iconSize} color={color} strokeWidth={sw} />;
          } else if (route.name === "Me") {
            icon = <UserIcon size={iconSize} color={color} strokeWidth={sw} />;
          }
          return (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
              }}
            >
              {focused && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: theme.colors.oliveAccent + "15",
                    }}
                  />
                </View>
              )}
              {icon}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={CustomerDashboard} />
      <Tab.Screen name="Saved" component={Collections} />
      <Tab.Screen name="Me" component={Profile} />
    </Tab.Navigator>
  );
}

function OwnerTabs() {
  return (
    <Tab.Navigator
      id="owner-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: theme.colors.charcoal,
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 88 : 72,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
          paddingTop: 12,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          ...theme.shadows.premium,
        },
        tabBarActiveTintColor: theme.colors.oliveAccent,
        tabBarInactiveTintColor: "rgba(255, 255, 255, 0.3)",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: 1.2,
        },
        tabBarIcon: ({ color, focused }) => {
          const iconSize = 22;
          const sw = focused ? 2.2 : 1.5;
          let icon;
          if (route.name === "OwnerDashboard") {
            icon = (
              <LayoutDashboard size={iconSize} color={color} strokeWidth={sw} />
            );
          } else if (route.name === "OwnerReservations") {
            icon = (
              <CalendarDays size={iconSize} color={color} strokeWidth={sw} />
            );
          } else if (route.name === "OwnerAnalytics") {
            icon = <BarChart2 size={iconSize} color={color} strokeWidth={sw} />;
          } else if (route.name === "OwnerSettings") {
            icon = (
              <SettingsIcon size={iconSize} color={color} strokeWidth={sw} />
            );
          }
          return (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
              }}
            >
              {focused && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: theme.colors.oliveAccent + "15",
                    }}
                  />
                </View>
              )}
              {icon}
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="OwnerDashboard"
        component={OwnerDashboard}
        options={{ tabBarLabel: "Dashboard" }}
      />
      <Tab.Screen
        name="OwnerReservations"
        component={OwnerReservations}
        options={{ tabBarLabel: "Bookings" }}
      />
      <Tab.Screen
        name="OwnerAnalytics"
        component={OwnerAnalytics}
        options={{ tabBarLabel: "Analytics" }}
      />
      <Tab.Screen
        name="OwnerSettings"
        component={OwnerSettings}
        options={{ tabBarLabel: "Settings" }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { user, loading: authLoading } = useAuth();

  // Two real init steps: fonts + auth check. Extend the denominator
  // if you add another awaited step (e.g. an initial data fetch).
  const progress = useMemo(() => {
    let completed = 0;
    if (fontsLoaded) completed += 1;
    if (!authLoading) completed += 1;
    return completed / 2;
  }, [fontsLoaded, authLoading]);

  if (!fontsLoaded || authLoading) {
    return <SplashScreen progress={progress} />;
  }

  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin";

  return (
    <Stack.Navigator
      id="main"
      screenOptions={{ headerShown: false, animation: "fade" }}
    >
      {!user ? (
        <Stack.Screen name="Auth" component={AuthPage as any} />
      ) : (
        <>
          {isAdmin ? (
            <Stack.Screen
              name="AdminDashboard"
              component={AdminDashboard as any}
            />
          ) : isOwner ? (
            <Stack.Screen name="OwnerMain" component={OwnerTabs as any} />
          ) : (
            <Stack.Screen name="CustomerMain" component={CustomerTabs} />
          )}
          <Stack.Screen
            name="RestaurantDetail"
            component={RestaurantDetail as any}
          />
          <Stack.Screen
            name="ReservationPage"
            component={ReservationPage as any}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    "Inria Serif Italic": require("../assets/fonts/InriaSerif-Italic.ttf"),
  });

  // Note: providers now always mount, even before fonts finish loading,
  // so AppNavigator (inside AuthProvider) can show the splash with a
  // progress bar instead of returning null / a bare spinner.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <LanguageProvider>
            <SettingsProvider>
              <AuthProvider>
                <AppNavigator fontsLoaded={fontsLoaded} />
              </AuthProvider>
            </SettingsProvider>
          </LanguageProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
