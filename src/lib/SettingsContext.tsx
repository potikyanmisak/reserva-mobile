import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SettingsContextType {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  distanceUnit: "km" | "mi";
  setDistanceUnit: (unit: "km" | "mi") => void;
}

const SettingsContext = createContext<SettingsContextType>({
  darkMode: false,
  setDarkMode: () => {},
  distanceUnit: "km",
  setDistanceUnit: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [darkMode, setDarkModeState] = useState(false);
  const [distanceUnit, setDistanceUnitState] = useState<"km" | "mi">("km");

  useEffect(() => {
    AsyncStorage.multiGet(["reserva_dark_mode", "reserva_distance_unit"]).then(
      (pairs) => {
        pairs.forEach(([key, value]) => {
          if (key === "reserva_dark_mode" && value !== null)
            setDarkModeState(value === "true");
          if (
            key === "reserva_distance_unit" &&
            (value === "km" || value === "mi")
          )
            setDistanceUnitState(value);
        });
      },
    );
  }, []);

  const setDarkMode = async (val: boolean) => {
    setDarkModeState(val);
    await AsyncStorage.setItem("reserva_dark_mode", String(val));
  };

  const setDistanceUnit = async (unit: "km" | "mi") => {
    setDistanceUnitState(unit);
    await AsyncStorage.setItem("reserva_distance_unit", unit);
  };

  return (
    <SettingsContext.Provider
      value={{ darkMode, setDarkMode, distanceUnit, setDistanceUnit }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
