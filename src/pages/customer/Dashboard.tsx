import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Dimensions,
  Switch,
  Pressable,
  Platform,
  Alert,
  Animated,
  PanResponder,
  Modal,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Search,
  MapPin,
  Star,
  Bell,
  Filter,
  Diamond,
  Calendar,
  Clock,
  X,
  Check,
  AlertCircle,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../lib/LanguageContext";
import { theme } from "../../theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "../../lib/api";
import { useSettings } from "../../lib/SettingsContext";
import { RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import {
  CUISINES,
  PRICE_RANGES,
  RATINGS,
  EXPERIENCE_GROUPS,
  AMENITIES,
  MOODS,
} from "../../lib/filterOptions";

const { width, height } = Dimensions.get("window");

// FIX: enable LayoutAnimation on Android (no-op on iOS, which supports it natively)
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function getPriceSymbol(min_price?: number, max_price?: number): string {
  const avg = ((min_price ?? 0) + (max_price ?? 0)) / 2;
  if (!avg) return "$$";
  if (avg < 5000) return "$";
  if (avg < 15000) return "$$";
  if (avg < 30000) return "$$$";
  return "$$$$";
}

// ── Fisher-Yates shuffle ──────────────────────────────────────────────────────
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const C = {
  bg: "#F5F0EB",
  white: "#FFFFFF",
  olive: "#5A5A40",
  oliveDeep: "#4A4A34",
  oliveLight: "#7C8B6D",
  text: "#1A1A1A",
  textSub: "#8A8A8A",
  border: "rgba(0,0,0,0.07)",
  cardBg: "#E8E0D8",
};

// NOTE: `label` values here are translation KEYS (not display text).
// They are resolved with t() at render time so the chip labels translate.
const CATEGORIES = [
  { id: "all", label: "categories.all" },
  { id: "dining", label: "categories.dining" },
  { id: "hookah", label: "categories.hookah" },
  { id: "cafe", label: "categories.cafe" },
  { id: "sushi", label: "categories.sushi" },
];

// ── Beautiful custom alert ────────────────────────────────────────────────────
function CustomAlert({
  visible,
  title,
  message,
  icon,
  iconColor,
  onClose,
  actions,
  okLabel,
}: {
  visible: boolean;
  title: string;
  message: string;
  icon?: React.ReactNode;
  iconColor?: string;
  onClose: () => void;
  actions?: { label: string; onPress: () => void; destructive?: boolean }[];
  okLabel?: string;
}) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={alertStyles.overlay}>
        <Animated.View
          style={[alertStyles.sheet, { transform: [{ scale }], opacity }]}
        >
          {icon && (
            <View
              style={[
                alertStyles.iconWrap,
                { backgroundColor: `${iconColor || C.olive}18` },
              ]}
            >
              {icon}
            </View>
          )}
          <Text style={alertStyles.title}>{title}</Text>
          <Text style={alertStyles.message}>{message}</Text>
          <View style={alertStyles.actions}>
            {actions && actions.length > 0 ? (
              actions.map((a, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    a.onPress();
                    onClose();
                  }}
                  style={[
                    alertStyles.actionBtn,
                    a.destructive && alertStyles.actionBtnDestructive,
                    i === 0 &&
                      actions.length > 1 &&
                      alertStyles.actionBtnSecondary,
                  ]}
                >
                  <Text
                    style={[
                      alertStyles.actionText,
                      a.destructive && alertStyles.actionTextDestructive,
                      i === 0 &&
                        actions.length > 1 &&
                        alertStyles.actionTextSecondary,
                    ]}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <TouchableOpacity onPress={onClose} style={alertStyles.actionBtn}>
                <Text style={alertStyles.actionText}>{okLabel || "OK"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const alertStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  sheet: {
    backgroundColor: C.white,
    borderRadius: 28,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 20,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    marginBottom: 8,
    fontFamily: "Georgia",
  },
  message: {
    fontSize: 14,
    color: C.textSub,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  actions: { flexDirection: "row", gap: 10, width: "100%" },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: C.olive,
  },
  actionBtnSecondary: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  actionBtnDestructive: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  actionText: { fontSize: 13, fontWeight: "800", color: "white" },
  actionTextSecondary: { color: C.textSub },
  actionTextDestructive: { color: "#ef4444" },
});

export default function CustomerDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const { distanceUnit } = useSettings();

  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, login } = useAuth();
  const { t } = useLanguage();

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [waitlistStatus, setWaitlistStatus] = useState<any>(null);
  const [nearestMode, setNearestMode] = useState(false);
  // FIX: use a single ref-based lock to prevent double-taps and race conditions
  const nearestLockRef = useRef(false);
  const [nearestLoading, setNearestLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  // FIX: showFilters now controls *mounting*; closing is animated from within
  // FilterModal itself, which calls onClose after the slide-out finishes.
  const [showFilters, setShowFilters] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");

  // FIX: Custom alert state
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    icon?: React.ReactNode;
    iconColor?: string;
    actions?: { label: string; onPress: () => void; destructive?: boolean }[];
  }>({ visible: false, title: "", message: "" });

  const showAlert = (config: Omit<typeof customAlert, "visible">) =>
    setCustomAlert({ ...config, visible: true });
  const hideAlert = () => setCustomAlert((p) => ({ ...p, visible: false }));

  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    cuisines: [],
    rating: null,
    priceRange: [],
    openNow: false,
    experiences: [],
    amenities: [],
    moods: [],
  });

  // FIX: random 5 discover restaurants, reshuffled on each fetch
  const [discoverRestaurants, setDiscoverRestaurants] = useState<any[]>([]);

  const fetchMyReservations = useCallback(async () => {
    if (!user) return;
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(getApiUrl("/api/my-reservations"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReservations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Customer Reservation Fetch Error:", err);
    }
  }, [user]);

  const fetchRestaurants = useCallback(() => {
    fetch(getApiUrl("/api/restaurants"))
      .then((res) => res.json())
      .then((data) => {
        const all = data.all || [];
        setRestaurants(all);
        setRecommended(data.recommended || []);
        // FIX: pick 5 random restaurants for discover
        setDiscoverRestaurants(shuffleArray(all).slice(0, 5));
      })
      .catch((err) => console.error("Fetch Restaurants Error:", err));
  }, []);

  useEffect(() => {
    if (!nearestMode) fetchRestaurants();
  }, [nearestMode]);

  const fetchWaitlistStatus = useCallback(async () => {
    if (!user) return;
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(getApiUrl("/api/my-waitlists"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setWaitlistStatus(data);
    } catch (err) {
      console.error("Waitlist fetch error:", err);
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(getApiUrl("/api/notifications"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Notifications fetch error:", err);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchMyReservations();
      await fetchWaitlistStatus();
      await fetchNotifications();
      if (!nearestMode) fetchRestaurants();
    } finally {
      setRefreshing(false);
    }
  }, [
    fetchMyReservations,
    fetchWaitlistStatus,
    fetchNotifications,
    fetchRestaurants,
  ]);

  useEffect(() => {
    if (user) {
      fetchMyReservations();
      fetchWaitlistStatus();
      fetchNotifications();
      const interval = setInterval(() => {
        fetchMyReservations();
        fetchWaitlistStatus();
        fetchNotifications();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [user, fetchMyReservations, fetchWaitlistStatus, fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        AsyncStorage.getItem("reserva_token").then((token) => {
          fetch(getApiUrl("/api/me"), {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.reliability_score !== undefined) {
                login(token || "", {
                  ...user,
                  reliability_score: data.reliability_score,
                });
              }
            });
        });
      }
    }, [user, login]),
  );

  // FIX: Completely rewritten toggleNearest — instant response, no double-fire, beautiful alerts
  const toggleNearest = useCallback(async () => {
    if (nearestLockRef.current) return;
    nearestLockRef.current = true;
    setNearestLoading(true);

    try {
      if (!nearestMode) {
        setSearchQuery("");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          showAlert({
            title: t("alerts.location_needed_title"),
            message: t("alerts.location_needed_msg"),
            icon: <MapPin size={28} color="#f59e0b" />,
            iconColor: "#f59e0b",
            actions: [{ label: t("alerts.got_it"), onPress: () => {} }],
          });
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const res = await fetch(
          getApiUrl(
            `/api/restaurants/nearest?lat=${loc.coords.latitude}&lng=${loc.coords.longitude}`,
          ),
        );
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setRestaurants(list);
        setNearestMode(true);
        if (list.length === 0) {
          showAlert({
            title: t("alerts.nothing_nearby_title"),
            message: t("alerts.nothing_nearby_msg"),
            icon: <MapPin size={28} color={C.textSub} />,
            iconColor: C.textSub,
            actions: [
              {
                label: t("alerts.show_all"),
                onPress: async () => {
                  const r = await fetch(getApiUrl("/api/restaurants"));
                  const d = await r.json();
                  const all = d.all || [];
                  setRestaurants(all);
                  setDiscoverRestaurants(shuffleArray(all).slice(0, 5));
                  setNearestMode(false);
                },
              },
            ],
          });
        }
      } else {
        const res = await fetch(getApiUrl("/api/restaurants"));
        const data = await res.json();
        const all = data.all || [];
        setRestaurants(all);
        setDiscoverRestaurants(shuffleArray(all).slice(0, 5));
        setNearestMode(false);
      }
    } catch (err) {
      console.error("Nearest toggle error:", err);
      showAlert({
        title: t("alerts.error_title"),
        message: t("alerts.error_msg"),
        icon: <AlertCircle size={28} color="#ef4444" />,
        iconColor: "#ef4444",
        actions: [{ label: t("alerts.ok"), onPress: () => {} }],
      });
    } finally {
      nearestLockRef.current = false;
      setNearestLoading(false);
    }
  }, [nearestMode, t]);

  const activeReservations = reservations.filter((r) => {
    if (r.status !== "pending" && r.status !== "confirmed") return false;
    const visitDateTime = new Date(`${r.date}T${r.time}`);
    const oneHourAfterVisit = new Date(
      visitDateTime.getTime() + 60 * 60 * 1000,
    );
    return new Date() < oneHourAfterVisit;
  });

  const visitedRestaurants = Array.from(
    new Set(
      reservations
        .filter((r) => {
          if (r.status !== "confirmed") return false;
          const visitDateTime = new Date(`${r.date}T${r.time}`);
          const oneHourAfterVisit = new Date(
            visitDateTime.getTime() + 60 * 60 * 1000,
          );
          return new Date() >= oneHourAfterVisit;
        })
        .map((r) => r.restaurant_id),
    ),
  )
    .map((id) => {
      const res = reservations.find((r) => r.restaurant_id === id);
      if (!res) return null;
      const fullRestaurant = restaurants.find((r) => r.id === id);
      return {
        id: res.restaurant_id,
        name: res.restaurant_name,
        logo_url: res.logo_url,
        cover_image_url: fullRestaurant?.cover_image_url || null,
        rating: res.rating || 4.6,
        location: res.location || "New York",
        dist_km: res.dist_km || 2.4,
        date: new Date(res.date).toLocaleDateString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const handleCancel = async (
    reservationId: number,
    status: string,
    date: string,
    time: string,
  ) => {
    const visitDateTime = new Date(`${date}T${time}`);
    const hoursUntilVisit =
      (visitDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    let warningMessage = t("alerts.cancel_msg_default");
    if (status === "confirmed") {
      if (hoursUntilVisit < 2) {
        warningMessage = t("alerts.cancel_msg_lt2h");
      } else if (hoursUntilVisit < 24) {
        warningMessage = t("alerts.cancel_msg_lt24h");
      } else {
        warningMessage = t("alerts.cancel_msg_confirmed");
      }
    }

    showAlert({
      title: t("alerts.cancel_reservation_title"),
      message: warningMessage,
      icon: <AlertCircle size={28} color="#ef4444" />,
      iconColor: "#ef4444",
      actions: [
        { label: t("alerts.keep_it"), onPress: () => {} },
        {
          label: t("alerts.cancel_reservation_title"),
          destructive: true,
          onPress: async () => {
            const token = await AsyncStorage.getItem("reserva_token");
            const res = await fetch(
              getApiUrl(`/api/reservations/${reservationId}/cancel`),
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (res.ok) fetchMyReservations();
          },
        },
      ],
    });
  };

  // FIX: Hookah — guard against non-array experience_types
  const categoryFilteredRestaurants = restaurants.filter((r) => {
    if (activeCategory === "all") return true;
    const name = (r.name || "").toLowerCase();
    const cuisine = (r.cuisine_type || "").toLowerCase();
    const cat = activeCategory.toLowerCase();
    // FIX: safely coerce experience_types to array
    const experienceTypes: string[] = Array.isArray(r.experience_types)
      ? r.experience_types
      : typeof r.experience_types === "string"
        ? [r.experience_types]
        : [];
    if (cat === "hookah")
      return (
        cuisine.includes("hookah") ||
        name.includes("hookah") ||
        experienceTypes.some((e: string) => e.toLowerCase().includes("hookah"))
      );
    if (cat === "cafe")
      return (
        cuisine.includes("cafe") ||
        name.includes("cafe") ||
        cuisine.includes("coffee")
      );
    if (cat === "sushi")
      return cuisine.includes("sushi") || name.includes("sushi");
    if (cat === "dining")
      return ["fine dining", "steakhouse", "italian", "armenian"].some((c) =>
        cuisine.includes(c),
      );
    return true;
  });

  const applyFilters = (list: any[]) =>
    list.filter((r) => {
      if (
        searchQuery &&
        !r.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      if (
        activeFilters.cuisines.length > 0 &&
        !activeFilters.cuisines.includes(r.cuisine_type)
      )
        return false;
      if (activeFilters.rating && (r.rating || 4.0) < activeFilters.rating)
        return false;
      if (activeFilters.priceRange.length > 0) {
        const sym = getPriceSymbol(r.min_price, r.max_price);
        if (!activeFilters.priceRange.includes(sym)) return false;
      }
      if (activeFilters.openNow) {
        const now = new Date();
        const cur = now.getHours() * 60 + now.getMinutes();
        const [oH, oM] = (r.open_time || "09:00").split(":").map(Number);
        const [cH, cM] = (r.close_time || "22:00").split(":").map(Number);
        if (cur < oH * 60 + oM || cur > cH * 60 + cM) return false;
      }
      const expTypes: string[] = Array.isArray(r.experience_types)
        ? r.experience_types
        : typeof r.experience_types === "string"
          ? [r.experience_types]
          : [];
      if (activeFilters.experiences.length > 0) {
        if (!activeFilters.experiences.some((e) => expTypes.includes(e)))
          return false;
      }
      if (activeFilters.amenities.length > 0) {
        const am = (Array.isArray(r.amenities) ? r.amenities : []) as string[];
        if (!activeFilters.amenities.some((a) => am.includes(a))) return false;
      }
      if (activeFilters.moods.length > 0) {
        const mo = (Array.isArray(r.moods) ? r.moods : []) as string[];
        if (!activeFilters.moods.some((m) => mo.includes(m))) return false;
      }
      return true;
    });

  const displayRestaurants = applyFilters(categoryFilteredRestaurants);
  // FIX: discover uses its own random-5 list (also filtered)
  const filteredDiscover = applyFilters(discoverRestaurants);

  const getTimeOfDay = () => {
    const h = new Date().getHours();
    if (h < 12) return t("dashboard.good_morning");
    if (h < 18) return t("dashboard.good_afternoon");
    return t("dashboard.good_evening");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const isFiltering =
    searchQuery ||
    activeCategory !== "all" ||
    activeFilters.cuisines.length > 0 ||
    activeFilters.rating ||
    activeFilters.priceRange.length > 0 ||
    activeFilters.openNow ||
    activeFilters.experiences.length > 0 ||
    activeFilters.amenities.length > 0 ||
    activeFilters.moods.length > 0;

  return (
    <View style={styles.root}>
      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        icon={customAlert.icon}
        iconColor={customAlert.iconColor}
        onClose={hideAlert}
        actions={customAlert.actions}
        okLabel={t("alerts.ok")}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: 120,
          paddingTop: insets.top + 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.olive}
            colors={[C.olive]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandText}>RESERVA</Text>
            <Text style={styles.greetingText}>
              {getTimeOfDay()},{"\n"}
              {user?.name?.split(" ")[0] || t("dashboard.guest")}
            </Text>
            {user?.reliability_score !== undefined && (
              <View style={styles.reliabilityRow}>
                <View style={styles.reliabilityBg}>
                  <View
                    style={[
                      styles.reliabilityFill,
                      {
                        width: `${user.reliability_score}%` as any,
                        backgroundColor:
                          user.reliability_score > 70
                            ? C.olive
                            : user.reliability_score > 40
                              ? "#f59e0b"
                              : "#ef4444",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.reliabilityLabel}>
                  {t("dashboard.reliability")}: {user.reliability_score}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setShowNotifications(!showNotifications)}
            style={styles.bellButton}
          >
            <Bell size={20} strokeWidth={1.5} color="white" />
            {unreadCount > 0 && (
              <View style={styles.bellDot}>
                <Text style={styles.bellDotText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Notifications ── */}
        {showNotifications && (
          <View style={styles.notifBox}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={styles.notifTitle}>
                {t("settings.notifications")}
              </Text>
              {notifications.some((n) => !n.read) && (
                <TouchableOpacity
                  onPress={async () => {
                    const token = await AsyncStorage.getItem("reserva_token");
                    await fetch(getApiUrl("/api/notifications/read-all"), {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    fetchNotifications();
                  }}
                >
                  <Text
                    style={{ fontSize: 11, color: C.olive, fontWeight: "700" }}
                  >
                    {t("dashboard.mark_all_read")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {notifications.length === 0 ? (
              <Text style={styles.notifEmpty}>
                {t("dashboard.no_notifications_yet")}
              </Text>
            ) : (
              notifications.map((notif) => (
                <TouchableOpacity
                  key={notif.id}
                  onPress={async () => {
                    if (!notif.read) {
                      const token = await AsyncStorage.getItem("reserva_token");
                      await fetch(
                        getApiUrl(`/api/notifications/${notif.id}/read`),
                        {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` },
                        },
                      );
                      fetchNotifications();
                    }
                  }}
                  style={[
                    styles.notifItem,
                    !notif.read && {
                      backgroundColor: "#f0f4ee",
                      borderRadius: 10,
                      padding: 8,
                    },
                  ]}
                >
                  <Text style={styles.notifName}>{notif.message}</Text>
                  <Text style={styles.notifSub}>
                    {new Date(notif.send_at).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ── Waitlist ── */}
        {waitlistStatus && waitlistStatus.length > 0 && (
          <View style={styles.section}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View style={styles.pulseDot} />
              <Text style={[styles.sectionLabel, { color: "#ef4444" }]}>
                {t("dashboard.active_waitlists")}
              </Text>
            </View>
            {waitlistStatus.map((entry: any) => (
              <View key={entry.id} style={styles.waitlistCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.waitlistName}>
                    {entry.restaurant_name}
                  </Text>
                  <Text style={styles.waitlistStatus}>
                    {entry.status === "offered"
                      ? `${t("dashboard.table_ready")} ${Math.max(0, Math.ceil((new Date(entry.expires_at).getTime() - Date.now()) / 60000))}m`
                      : `${t("dashboard.estimated_wait")}: ~${entry.estimated_wait} mins`}
                  </Text>
                </View>
                {entry.status === "offered" && (
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("ReservationPage", {
                        id: entry.restaurant_id,
                      })
                    }
                    style={styles.waitlistBtn}
                  >
                    <Text style={styles.waitlistBtnText}>
                      {t("dashboard.accept_now")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Upcoming Reservations ── */}
        {activeReservations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t("dashboard.upcoming")}</Text>
            {activeReservations.map((res) => (
              <ActiveReservationCard
                key={res.id}
                reservation={res}
                t={t}
                navigation={navigation}
                onCancel={handleCancel}
              />
            ))}
          </View>
        )}

        {/* ── Search + Filter Row ── */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={C.textSub} strokeWidth={1.5} />
            <TextInput
              placeholder={t("dashboard.search_placeholder")}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={C.textSub}
              style={styles.searchInput}
            />
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            style={[
              styles.filterBtn,
              showFilters && { backgroundColor: C.olive },
            ]}
          >
            <Filter
              size={18}
              strokeWidth={1.5}
              color={showFilters ? "white" : C.olive}
            />
          </TouchableOpacity>
        </View>

        {/* ── Active Filter Chips ── */}
        {(activeFilters.cuisines.length > 0 ||
          activeFilters.rating ||
          activeFilters.priceRange.length > 0 ||
          activeFilters.openNow ||
          activeFilters.experiences.length > 0 ||
          activeFilters.amenities.length > 0 ||
          activeFilters.moods.length > 0) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsRow}
          >
            {activeFilters.cuisines.map((c) => (
              <FilterChip
                key={c}
                label={c}
                onRemove={() =>
                  setActiveFilters((p) => ({
                    ...p,
                    cuisines: p.cuisines.filter((x) => x !== c),
                  }))
                }
              />
            ))}
            {activeFilters.rating && (
              <FilterChip
                label={`${activeFilters.rating}+★`}
                onRemove={() =>
                  setActiveFilters((p) => ({ ...p, rating: null }))
                }
              />
            )}
            {activeFilters.priceRange.map((p) => (
              <FilterChip
                key={p}
                label={p}
                onRemove={() =>
                  setActiveFilters((pv) => ({
                    ...pv,
                    priceRange: pv.priceRange.filter((x) => x !== p),
                  }))
                }
              />
            ))}
            {activeFilters.openNow && (
              <FilterChip
                label={t("filters.open_now")}
                onRemove={() =>
                  setActiveFilters((p) => ({ ...p, openNow: false }))
                }
              />
            )}
            {activeFilters.experiences.map((e) => (
              <FilterChip
                key={e}
                label={e}
                onRemove={() =>
                  setActiveFilters((p) => ({
                    ...p,
                    experiences: p.experiences.filter((x) => x !== e),
                  }))
                }
              />
            ))}
            {activeFilters.amenities.map((a) => (
              <FilterChip
                key={a}
                label={a}
                onRemove={() =>
                  setActiveFilters((p) => ({
                    ...p,
                    amenities: p.amenities.filter((x) => x !== a),
                  }))
                }
              />
            ))}
            {activeFilters.moods.map((m) => (
              <FilterChip
                key={m}
                label={m}
                onRemove={() =>
                  setActiveFilters((p) => ({
                    ...p,
                    moods: p.moods.filter((x) => x !== m),
                  }))
                }
              />
            ))}
          </ScrollView>
        )}

        {/* ── Nearest You — Compact Toggle ── */}
        {/* FIX: disabled state while loading to prevent double-tap lag */}
        <TouchableOpacity
          onPress={toggleNearest}
          disabled={nearestLoading}
          activeOpacity={0.75}
          style={[styles.nearestCompactRow, nearestLoading && { opacity: 0.6 }]}
        >
          <MapPin
            size={13}
            strokeWidth={1.5}
            color={nearestMode ? C.olive : C.textSub}
          />
          <Text
            style={[
              styles.nearestCompactText,
              nearestMode && { color: C.olive },
            ]}
          >
            {nearestLoading
              ? t("dashboard.locating")
              : nearestMode
                ? t("dashboard.nearest_you")
                : t("dashboard.nearest_you")}
          </Text>
          <Switch
            value={nearestMode}
            onValueChange={toggleNearest}
            disabled={nearestLoading}
            trackColor={{ false: "rgba(90,90,64,0.15)", true: `${C.olive}80` }}
            thumbColor={nearestMode ? C.olive : C.oliveLight}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </TouchableOpacity>

        {/* ── Recommended ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("dashboard.recommended")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 16, paddingRight: 4 }}
          >
            {recommended.length > 0 ? (
              recommended.map((r) => (
                <RecommendCard
                  key={r.id}
                  restaurant={r}
                  t={t}
                  navigation={navigation}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>
                {t("dashboard.checking_favorites")}
              </Text>
            )}
          </ScrollView>
        </View>

        {/* ── Category Chips ── */}
        {/* FIX: paddingVertical on container to prevent shadow clip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsContainer}
          style={styles.categoryChipsRow}
        >
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.id}
              label={t(cat.label)}
              active={activeCategory === cat.id}
              onPress={() => setActiveCategory(cat.id)}
            />
          ))}
        </ScrollView>

        {/* ── Discover (random 5) or filtered results ── */}
        {isFiltering
          ? displayRestaurants.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {nearestMode
                    ? t("dashboard.nearest_you")
                    : searchQuery
                      ? `${t("dashboard.searching")} "${searchQuery}"`
                      : activeCategory !== "all"
                        ? t(
                            CATEGORIES.find((c) => c.id === activeCategory)
                              ?.label || "categories.all",
                          )
                        : t("dashboard.discover")}
                </Text>
                {displayRestaurants.map((r) => (
                  <HistoryCard
                    key={r.id}
                    restaurant={{
                      ...r,
                      date: r.cuisine_type || t("dashboard.artisanal"),
                    }}
                    t={t}
                    navigation={navigation}
                  />
                ))}
              </View>
            )
          : filteredDiscover.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {t("dashboard.discover")}
                </Text>
                {filteredDiscover.map((r) => (
                  <HistoryCard
                    key={r.id}
                    restaurant={{
                      ...r,
                      date: r.cuisine_type || t("dashboard.artisanal"),
                    }}
                    t={t}
                    navigation={navigation}
                  />
                ))}
              </View>
            )}

        {/* ── History ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("dashboard.history")}</Text>
          {visitedRestaurants.length > 0 ? (
            visitedRestaurants.map((r) => (
              <HistoryCard
                key={r.id}
                restaurant={r}
                t={t}
                navigation={navigation}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>
              {t("dashboard.culinary_journey")}
            </Text>
          )}
        </View>
      </ScrollView>

      {showFilters && (
        <FilterModal
          onClose={() => setShowFilters(false)}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          cuisines={CUISINES}
          priceRanges={PRICE_RANGES}
          ratings={RATINGS}
          t={t}
        />
      )}
    </View>
  );
}

// ── CategoryChip ──────────────────────────────────────────────────────────────

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.93,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[styles.categoryChip, active && styles.categoryChipActive]}
      >
        <Text
          style={[
            styles.categoryChipText,
            active && styles.categoryChipTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ActiveFilters {
  cuisines: string[];
  rating: number | null;
  priceRange: string[];
  openNow: boolean;
  experiences: string[];
  amenities: string[];
  moods: string[];
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
      <TouchableOpacity onPress={onRemove}>
        <X size={10} strokeWidth={3} color="white" />
      </TouchableOpacity>
    </View>
  );
}

function ActiveReservationCard({ reservation, t, navigation, onCancel }: any) {
  const isPending = reservation.status === "pending";
  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("RestaurantDetail", {
          id: reservation.restaurant_id,
        })
      }
      style={styles.activeCard}
    >
      <Image
        source={{
          uri:
            reservation.logo_url ||
            `https://picsum.photos/seed/${reservation.restaurant_id}/200/200`,
        }}
        style={styles.activeCardImage}
      />
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={styles.activeCardName} numberOfLines={1}>
            {reservation.restaurant_name}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isPending ? "#fffbeb" : "#ecfdf5" },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: isPending ? "#d97706" : "#059669" },
              ]}
            >
              {isPending
                ? t("dashboard.pending_approval")
                : t("dashboard.confirmed")}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Calendar size={11} color={C.textSub} />
            <Text style={styles.activeCardMeta}>
              {new Date(reservation.date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Clock size={11} color={C.textSub} />
            <Text style={styles.activeCardMeta}>
              {reservation.time} · {reservation.people_count}{" "}
              {reservation.people_count === 1
                ? t("dashboard.person")
                : t("dashboard.people")}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onCancel(
              reservation.id,
              reservation.status,
              reservation.date,
              reservation.time,
            );
          }}
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function RecommendCard({ restaurant, t, navigation }: any) {
  const { distanceUnit } = useSettings();
  const distValue =
    distanceUnit === "mi"
      ? `${((restaurant.dist_km || 2.4) * 0.621371).toFixed(1)} mi`
      : `${restaurant.dist_km || 2.4} km`;

  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("RestaurantDetail", { id: restaurant.id })
      }
      style={styles.recommendCard}
      activeOpacity={0.9}
    >
      <Image
        source={{
          uri:
            restaurant.cover_image_url ||
            restaurant.logo_url ||
            `https://picsum.photos/seed/${restaurant.id}/600/400`,
        }}
        style={styles.recommendImage}
      />
      <View style={styles.recommendOverlay} />
      <View style={styles.recommendContent}>
        <View style={styles.recommendTag}>
          <Text style={styles.recommendTagText}>
            {t("dashboard.artisanal_cozy")}
          </Text>
        </View>
        <Text style={styles.recommendName}>{restaurant.name}</Text>
        <Text style={styles.recommendMeta}>
          {distValue} away · {restaurant.rating || 4.4} rating
        </Text>
      </View>
      <View style={styles.recommendFab}>
        <Diamond size={14} color="white" fill="white" />
      </View>
    </TouchableOpacity>
  );
}

function HistoryCard({ restaurant, t, navigation }: any) {
  const { distanceUnit } = useSettings();
  const distValue =
    distanceUnit === "mi"
      ? `${((restaurant.dist_km || 2.4) * 0.621371).toFixed(1)} mi`
      : `${restaurant.dist_km || 2.4} km`;

  const price = getPriceSymbol(restaurant.min_price, restaurant.max_price);

  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate("RestaurantDetail", { id: restaurant.id })
      }
      style={styles.histCard}
      activeOpacity={0.8}
    >
      <View style={styles.histImageBox}>
        <Image
          source={{
            uri:
              restaurant.cover_image_url ||
              restaurant.logo_url ||
              `https://picsum.photos/seed/${restaurant.id}/200/200`,
          }}
          style={styles.histImage}
        />
      </View>
      <View style={styles.histInfo}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={styles.histName} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text style={styles.histPrice}>{price}</Text>
        </View>
        <Text style={styles.histMeta} numberOfLines={1}>
          {distValue} away · {restaurant.rating || "4.4"} rating
        </Text>
        {restaurant.date && (
          <Text style={styles.histDate}>{restaurant.date}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── FilterModal ───────────────────────────────────────────────────────────────
// FIX: Modal now animates in on mount (slide up + backdrop fade) and animates
// out on every close path (backdrop tap, Apply, swipe-down) via a single
// `animateClose` helper, instead of appearing/disappearing instantly.

function FilterModal({
  onClose,
  activeFilters,
  setActiveFilters,
  cuisines,
  priceRanges,
  ratings,
  t,
}: any) {
  const [local, setLocal] = useState<ActiveFilters>({ ...activeFilters });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    cuisine: true,
    experience: false,
    amenities: false,
    mood: false,
  });

  // FIX: start off-screen (below the fold) and animate to 0 on mount
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX: single animated-close path shared by backdrop tap, Apply, and swipe
  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          animateClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 12,
          }).start();
        }
      },
    }),
  ).current;

  // FIX: LayoutAnimation gives the expand/collapse a smooth transition
  // instead of an instant snap
  const toggleSection = (key: string) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, "easeInEaseOut", "opacity"),
    );
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));
  };

  const toggleItem = (field: keyof ActiveFilters, value: string) =>
    setLocal((p: any) => ({
      ...p,
      [field]: p[field].includes(value)
        ? p[field].filter((x: string) => x !== value)
        : [...p[field], value],
    }));

  const reset = () =>
    setLocal({
      cuisines: [],
      rating: null,
      priceRange: [],
      openNow: false,
      experiences: [],
      amenities: [],
      moods: [],
    });

  const apply = () => {
    setActiveFilters(local);
    animateClose();
  };

  // FIX: Consolidated EXPERIENCES — removed duplicate logic entries, grouped cleanly
  const totalActive =
    local.cuisines.length +
    local.experiences.length +
    local.amenities.length +
    local.moods.length +
    local.priceRange.length +
    (local.rating ? 1 : 0) +
    (local.openNow ? 1 : 0);

  return (
    <View style={styles.modalOverlay}>
      <Pressable onPress={animateClose} style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[styles.modalBackdrop, { opacity: backdropOpacity }]}
        />
      </Pressable>
      <Animated.View
        style={[styles.modalSheet, { transform: [{ translateY }] }]}
      >
        <View {...panResponder.panHandlers} style={styles.modalDragArea}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{t("filters.modal_title")}</Text>
            {totalActive > 0 && (
              <View style={styles.activeCountBadge}>
                <Text style={styles.activeCountText}>{totalActive}</Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          // FIX: horizontal padding on ScrollView so pills don't touch walls
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Cuisine & Basics ── */}
          <CollapsibleSection
            label={t("filters.cuisine_basics")}
            isOpen={openSections.cuisine}
            onToggle={() => toggleSection("cuisine")}
            activeCount={
              local.cuisines.length +
              local.priceRange.length +
              (local.rating ? 1 : 0) +
              (local.openNow ? 1 : 0)
            }
          >
            <SectionSubLabel label={t("filters.cuisine")} />
            <View style={fStyles.pillGrid}>
              {cuisines.map((c: string) => (
                <PillButton
                  key={c}
                  label={c}
                  active={local.cuisines.includes(c)}
                  onPress={() => toggleItem("cuisines", c)}
                />
              ))}
            </View>

            <SectionSubLabel label={t("filters.price_range")} />
            <View style={fStyles.pillRow}>
              {priceRanges.map((p: string) => (
                <PillButton
                  key={p}
                  label={p}
                  active={local.priceRange.includes(p)}
                  onPress={() => toggleItem("priceRange", p)}
                  flex
                />
              ))}
            </View>

            <SectionSubLabel label={t("filters.rating")} />
            <View style={fStyles.pillRow}>
              {ratings.map((r: number) => (
                <TouchableOpacity
                  key={r}
                  onPress={() =>
                    setLocal((p: ActiveFilters) => ({
                      ...p,
                      rating: p.rating === r ? null : r,
                    }))
                  }
                  style={[
                    fStyles.pill,
                    {
                      flex: 1,
                      alignItems: "center",
                      flexDirection: "row",
                      gap: 4,
                      justifyContent: "center",
                    },
                    local.rating === r && fStyles.pillActive,
                  ]}
                >
                  <Star
                    size={12}
                    color={local.rating === r ? "white" : C.text}
                    fill={local.rating === r ? "white" : "none"}
                  />
                  <Text
                    style={[
                      fStyles.pillText,
                      local.rating === r && fStyles.pillTextActive,
                    ]}
                  >
                    {r}+
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={fStyles.toggleRow}>
              <View>
                <Text style={fStyles.toggleLabel}>{t("filters.open_now")}</Text>
                <Text style={fStyles.toggleSub}>{t("filters.only_open")}</Text>
              </View>
              <Switch
                value={local.openNow}
                onValueChange={(v) =>
                  setLocal((p: ActiveFilters) => ({ ...p, openNow: v }))
                }
                trackColor={{ false: "rgba(0,0,0,0.1)", true: C.olive }}
                thumbColor="white"
              />
            </View>
          </CollapsibleSection>

          {/* ── Experience ── */}
          <CollapsibleSection
            label={t("filters.experience")}
            isOpen={openSections.experience}
            onToggle={() => toggleSection("experience")}
            activeCount={local.experiences.length}
            highlight
          >
            {Object.entries(EXPERIENCE_GROUPS).map(([group, items]) => (
              <View key={group}>
                <SectionSubLabel label={group} />
                <View style={fStyles.pillGrid}>
                  {items.map((item) => (
                    <PillButton
                      key={item}
                      label={item}
                      active={local.experiences.includes(item)}
                      onPress={() => toggleItem("experiences", item)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </CollapsibleSection>

          {/* ── Amenities ── */}
          <CollapsibleSection
            label={t("filters.amenities")}
            isOpen={openSections.amenities}
            onToggle={() => toggleSection("amenities")}
            activeCount={local.amenities.length}
          >
            <View style={fStyles.pillGrid}>
              {AMENITIES.map((item) => (
                <PillButton
                  key={item}
                  label={item}
                  active={local.amenities.includes(item)}
                  onPress={() => toggleItem("amenities", item)}
                />
              ))}
            </View>
          </CollapsibleSection>

          {/* ── Mood ── */}
          <CollapsibleSection
            label={t("filters.mood_occasion")}
            isOpen={openSections.mood}
            onToggle={() => toggleSection("mood")}
            activeCount={local.moods.length}
          >
            <View style={fStyles.pillGrid}>
              {MOODS.map((item) => (
                <PillButton
                  key={item}
                  label={item}
                  active={local.moods.includes(item)}
                  onPress={() => toggleItem("moods", item)}
                />
              ))}
            </View>
          </CollapsibleSection>

          <View style={fStyles.footer}>
            <TouchableOpacity onPress={reset} style={fStyles.resetBtn}>
              <Text style={fStyles.resetBtnText}>
                {t("filters.modal_reset")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={apply} style={fStyles.applyBtn}>
              <Text style={fStyles.applyBtnText}>
                {t("filters.modal_apply")}
                {totalActive > 0 ? ` (${totalActive})` : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function SectionSubLabel({ label }: { label: string }) {
  return <Text style={fStyles.subLabel}>{label}</Text>;
}

// FIX: memoized so toggling a pill in one section doesn't re-render siblings
const CollapsibleSection = React.memo(function CollapsibleSection({
  label,
  isOpen,
  onToggle,
  activeCount,
  highlight,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  activeCount: number;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[fStyles.section, highlight && fStyles.sectionHighlight]}>
      <TouchableOpacity
        onPress={onToggle}
        style={fStyles.sectionHeader}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={[fStyles.sectionTitle, highlight && { color: C.oliveDeep }]}
          >
            {label}
          </Text>
          {activeCount > 0 && (
            <View style={fStyles.sectionBadge}>
              <Text style={fStyles.sectionBadgeText}>{activeCount}</Text>
            </View>
          )}
        </View>
        <Text style={fStyles.chevron}>{isOpen ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {isOpen && <View style={{ paddingBottom: 12 }}>{children}</View>}
    </View>
  );
});

// FIX: memoized so unrelated pill re-renders don't cascade through the grid
const PillButton = React.memo(function PillButton({
  label,
  active,
  onPress,
  flex,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  flex?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[fStyles.pill, active && fStyles.pillActive, flex && { flex: 1 }]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: flex ? "center" : "flex-start",
        }}
      >
        {active && (
          <Check
            size={11}
            color="white"
            strokeWidth={3}
            style={{ marginRight: 4 }}
          />
        )}
        <Text style={[fStyles.pillText, active && fStyles.pillTextActive]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ── Filter styles (consolidated, no duplication) ─────────────────────────────

const fStyles = StyleSheet.create({
  section: {
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  sectionHighlight: {
    borderColor: `${C.olive}40`,
    backgroundColor: `${C.olive}08`,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.text,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionBadge: {
    backgroundColor: C.olive,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  sectionBadgeText: { fontSize: 10, color: "white", fontWeight: "800" },
  chevron: { fontSize: 10, color: C.textSub },
  subLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSub,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  // FIX: pillGrid/pillRow include horizontal padding so pills don't touch walls
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillActive: { backgroundColor: C.olive, borderColor: C.olive },
  pillText: { fontSize: 12, fontWeight: "600", color: C.text },
  pillTextActive: { color: "white" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleLabel: { fontSize: 14, fontWeight: "700", color: C.text },
  toggleSub: { fontSize: 11, color: C.textSub, marginTop: 2 },
  footer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: C.textSub,
    textTransform: "uppercase",
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: C.text,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "white",
    textTransform: "uppercase",
  },
});

// ── Main styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 24,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.olive,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  greetingText: {
    fontSize: 34,
    fontStyle: "italic",
    fontWeight: "300",
    lineHeight: 40,
    color: C.text,
    fontFamily: "serif",
  },
  reliabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  reliabilityBg: {
    height: 5,
    width: 80,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  reliabilityFill: { height: "100%" },
  reliabilityLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: C.textSub,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  bellButton: {
    width: 52,
    height: 52,
    backgroundColor: C.olive,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.olive,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  bellDot: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f87171",
    alignItems: "center",
    justifyContent: "center",
  },
  bellDotText: { fontSize: 9, color: "white", fontWeight: "800" },

  notifBox: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  notifTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: C.olive,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  notifEmpty: { fontSize: 13, color: C.textSub, fontStyle: "italic" },
  notifItem: { marginBottom: 12 },
  notifName: { fontSize: 14, fontWeight: "600", color: C.text },
  notifSub: {
    fontSize: 10,
    color: "#ef4444",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },

  section: { paddingHorizontal: 24, marginBottom: 32 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  pulseDot: {
    width: 7,
    height: 7,
    backgroundColor: "#ef4444",
    borderRadius: 4,
    marginRight: 8,
  },
  emptyText: { fontSize: 13, color: C.textSub, fontStyle: "italic" },

  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 14,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text },
  filterBtn: {
    width: 52,
    height: 52,
    backgroundColor: C.white,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Category Chips ──
  // FIX: paddingVertical so shadow of bottom edge isn't clipped
  categoryChipsRow: { marginBottom: 20 },
  categoryChipsContainer: {
    paddingHorizontal: 24,
    paddingVertical: 6,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 100,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "rgba(90,90,64,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryChipActive: {
    backgroundColor: C.olive,
    borderColor: C.olive,
    shadowColor: C.olive,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textSub,
    letterSpacing: 0.2,
  },
  categoryChipTextActive: { color: "white", fontWeight: "700" },

  chipsRow: { paddingHorizontal: 24, marginBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.olive,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: { fontSize: 11, fontWeight: "700", color: "white" },

  // ── Nearest Toggle ──
  nearestCompactRow: {
    marginHorizontal: 24,
    marginBottom: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(90,90,64,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  nearestCompactText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textSub,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    flex: 1,
  },

  recommendCard: {
    width: width * 0.62,
    height: 220,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: C.cardBg,
  },
  recommendImage: { width: "100%", height: "100%", resizeMode: "cover" },
  recommendOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  recommendContent: { position: "absolute", bottom: 16, left: 16, right: 48 },
  recommendTag: {
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 6,
  },
  recommendTagText: { fontSize: 10, color: "white", fontWeight: "600" },
  recommendName: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
    fontFamily: "Georgia",
  },
  recommendMeta: { fontSize: 11, color: "rgba(255,255,255,0.75)" },
  recommendFab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.olive,
    alignItems: "center",
    justifyContent: "center",
  },

  histCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  histImageBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: C.cardBg,
  },
  histImage: { width: "100%", height: "100%", resizeMode: "cover" },
  histInfo: { flex: 1 },
  histName: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    flex: 1,
    fontFamily: "Georgia",
  },
  histPrice: { fontSize: 11, fontWeight: "700", color: C.olive },
  histMeta: { fontSize: 11, color: C.textSub, marginTop: 4 },
  histDot: { fontSize: 11, color: C.textSub },
  histDate: {
    fontSize: 11,
    color: C.textSub,
    marginTop: 4,
    fontStyle: "italic",
  },

  activeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeCardImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.cardBg,
  },
  activeCardName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    flex: 1,
    fontFamily: "Georgia",
  },
  activeCardMeta: { fontSize: 11, color: C.textSub },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusBadgeText: { fontSize: 10, fontWeight: "700" },
  cancelBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  cancelBtnText: { fontSize: 11, fontWeight: "700", color: "#ef4444" },

  waitlistCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  waitlistName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    fontFamily: "Georgia",
  },
  waitlistStatus: { fontSize: 12, color: C.textSub, marginTop: 2 },
  waitlistBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  waitlistBtnText: { fontSize: 11, fontWeight: "800", color: "white" },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    maxHeight: height * 0.85,
    paddingBottom: Platform.OS === "ios" ? 88 : 72,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
  },
  modalDragArea: { paddingTop: 12, paddingHorizontal: 24, paddingBottom: 16 },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  activeCountBadge: {
    backgroundColor: C.olive,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  activeCountText: { fontSize: 11, color: "white", fontWeight: "800" },
  modalTitle: { fontSize: 22, fontWeight: "800", color: C.text },
  filterSubLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textSub,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 14,
  },
});
