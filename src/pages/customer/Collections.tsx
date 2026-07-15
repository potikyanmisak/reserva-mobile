import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bookmark, MapPin, Star } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../lib/LanguageContext";
import { theme } from "../../theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "../../lib/api";

export default function Collections() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCollections = async () => {
      if (user) {
        setLoading(true);
        try {
          const token = await AsyncStorage.getItem("reserva_token");
          const res = await fetch(getApiUrl("/api/collections"), {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          setCollections(data);
        } catch (err) {
          console.error("Fetch Collections Error:", err);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchCollections();
  }, [user]);

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.iconCircle}>
          <Bookmark size={32} color="#9CA3AF" />
        </View>
        <Text style={styles.guestTitle}>
          {t("dashboard.signin_to_see_collections")}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Auth")}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{t("common.signin")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 16 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.brandTag}>Reserva</Text>
        <Text style={styles.title}>{t("dashboard.collections")}</Text>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#7C8B6D" />
        </View>
      ) : collections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {t("dashboard.no_saved_restaurants")}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Home")}>
            <Text style={styles.discoverLink}>
              {t("dashboard.discover_restaurants")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.grid}>
          {collections.map((restaurant, idx) => (
            <TouchableOpacity
              key={restaurant.id}
              onPress={() =>
                navigation.navigate("RestaurantDetail", { id: restaurant.id })
              }
              style={styles.card}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={{
                    uri:
                      restaurant.logo_url ||
                      `https://picsum.photos/seed/collection-${restaurant.id}/800/600`,
                  }}
                  style={styles.image}
                />
                <View style={styles.overlay} />
                <View style={styles.cardContent}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.ratingBadge}>
                      <Star size={12} color="#FACC15" fill="#FACC15" />
                      <Text style={styles.ratingText}>
                        {restaurant.rating || 4.5}
                      </Text>
                    </View>
                    <View style={styles.locationBadge}>
                      <MapPin size={12} color="white" />
                      <Text style={styles.locationText}>
                        {restaurant.location?.split(",")[0]}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFCFB",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
  },
  brandTag: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.oliveAccent,
    textTransform: "uppercase",
    letterSpacing: 4,
    marginBottom: 4,
  },
  title: {
    fontSize: 42,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
    letterSpacing: -1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    backgroundColor: "#FDFCFB",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2D2D2D",
    textAlign: "center",
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: theme.colors.charcoal,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 20,
    ...theme.shadows.soft,
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  loaderContainer: {
    paddingVertical: 100,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 100,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "500",
  },
  discoverLink: {
    color: "#7C8B6D",
    fontWeight: "bold",
    textDecorationLine: "underline",
    fontSize: 16,
  },
  grid: {
    gap: 24,
  },
  card: {
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.soft,
  },
  imageContainer: {
    height: 192,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  cardContent: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
  },
  restaurantName: {
    fontSize: 24,
    fontFamily: theme.fonts.inriaSerif,
    color: "white",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "500",
  },
});
