import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";

const BACKGROUND_COLOR = "#A69D8A"; // matches the taupe background from your app icon
const BAR_COLOR = "#5C6E3F";
const BAR_WIDTH = 160;

interface SplashScreenProps {
  /** 0 to 1. Drive this from your real init steps (fonts, auth, initial fetch). */
  progress: number;
}

export default function SplashScreen({ progress }: SplashScreenProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // width isn't supported by the native driver
    }).start();
  }, [progress]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BAR_WIDTH],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>R E S E R V A</Text>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: animatedWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    color: "#FFF9F2",
    fontSize: 28,
    fontWeight: "400",
    letterSpacing: 10,
    marginBottom: 28,
  },
  barTrack: {
    width: BAR_WIDTH,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 1.5,
    backgroundColor: BAR_COLOR,
  },
});
