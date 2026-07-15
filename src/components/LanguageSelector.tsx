import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Pressable,
  Animated,
  PanResponder,
} from "react-native";
import { Check, Globe } from "lucide-react-native";
import { useLanguage } from "../lib/LanguageContext";
import { theme } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

interface LanguageSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "am", name: "Հայերեն", flag: "🇦🇲" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
];

const SWIPE_DOWN_THRESHOLD = 80;

export default function LanguageSelector({
  isOpen,
  onClose,
}: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(height)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // Drag offset while panning
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      dragY.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 25,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  // PanResponder for swipe-down-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SWIPE_DOWN_THRESHOLD) {
          // Animate off screen then close
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: height,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 180,
              useNativeDriver: true,
            }),
          ]).start(() => {
            dragY.setValue(0);
            onClose();
          });
        } else {
          // Snap back
          Animated.spring(dragY, {
            toValue: 0,
            damping: 20,
            stiffness: 300,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  if (!isOpen && (translateY as any)._value === height) return null;

  return (
    <View style={styles.overlay} pointerEvents={isOpen ? "auto" : "none"}>
      <Animated.View style={[styles.backdropContainer, { opacity }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: Animated.add(translateY, dragY) }],
            paddingBottom: insets.bottom + 48,
          },
        ]}
      >
        {/* Drag handle — the only dismiss affordance */}
        <View style={styles.handleRow} {...panResponder.panHandlers}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBox}>
              <Globe size={20} color={theme.colors.oliveMuted} />
            </View>
            <Text style={styles.title}>{t("settings.language_select")}</Text>
          </View>
          {/* No X button — swipe down or tap backdrop to dismiss */}
        </View>

        <View style={styles.options}>
          {LANGUAGES.map((lang) => {
            const isActive = language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => {
                  setLanguage(lang.code as any);
                  setTimeout(onClose, 200);
                }}
                style={[
                  styles.optionButton,
                  isActive ? styles.activeOption : styles.inactiveOption,
                ]}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.optionText,
                      isActive ? styles.activeText : styles.inactiveText,
                    ]}
                  >
                    {lang.name}
                  </Text>
                </View>
                {isActive && (
                  <View style={styles.checkBadge}>
                    <Check size={14} strokeWidth={3} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Subtle hint */}
        <Text style={styles.swipeHint}>{t("settings.swipe_down_close")}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  backdropContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26, 26, 26, 0.4)",
  },
  sheet: {
    backgroundColor: theme.colors.bgBase,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  handleRow: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    padding: 8,
    backgroundColor: "rgba(90, 90, 64, 0.05)",
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.charcoal,
    textTransform: "uppercase",
    letterSpacing: -0.5,
  },
  options: {
    gap: 12,
  },
  optionButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 28,
    borderWidth: 1,
  },
  activeOption: {
    backgroundColor: "white",
    borderColor: "rgba(90, 90, 64, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inactiveOption: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderColor: "rgba(0, 0, 0, 0.03)",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  flag: { fontSize: 24 },
  optionText: { fontSize: 14, fontWeight: "bold" },
  activeText: { color: theme.colors.charcoal },
  inactiveText: { color: theme.colors.textDim },
  checkBadge: {
    width: 24,
    height: 24,
    backgroundColor: theme.colors.oliveMuted,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeHint: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 11,
    color: "rgba(0,0,0,0.2)",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
