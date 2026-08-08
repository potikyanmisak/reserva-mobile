import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft, Star, Heart } from "lucide-react-native";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";
import { getApiUrl } from "../lib/api";

type SortMode = "recent" | "rating" | "liked";

export default function AllReviews() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const {
    id,
    restaurantName,
    reviews: initialReviews,
  } = route.params as {
    id: string;
    restaurantName?: string;
    reviews?: any[];
  };

  const [reviews, setReviews] = useState<any[]>(initialReviews || []);
  const [loading, setLoading] = useState(!initialReviews);
  const [sort, setSort] = useState<SortMode>("recent");

  useEffect(() => {
    if (initialReviews) return;
    (async () => {
      const token = await AsyncStorage.getItem("reserva_token");
      try {
        const res = await fetch(getApiUrl(`/api/restaurants/${id}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        setReviews(data.reviews || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleLikeReview = async (reviewId: number) => {
    if (!user) {
      navigation.navigate("Auth");
      return;
    }
    const token = await AsyncStorage.getItem("reserva_token");
    try {
      const res = await fetch(getApiUrl(`/api/reviews/${reviewId}/like`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { liked } = await res.json();
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? {
                  ...r,
                  is_liked: liked,
                  likes: (r.likes || 0) + (liked ? 1 : -1),
                }
              : r,
          ),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sortedReviews = useMemo(() => {
    const arr = [...reviews];
    if (sort === "rating") {
      arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === "liked") {
      arr.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    // "recent" keeps the backend's created_at DESC order as-is
    return arr;
  }, [reviews, sort]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    return (
      reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
    );
  }, [reviews]);

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: "recent", label: t("all_reviews.sort_recent") },
    { key: "rating", label: t("all_reviews.sort_rating") },
    { key: "liked", label: t("all_reviews.sort_liked") },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={20} color="#1A1A1A" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t("all_reviews.title")}</Text>
          {!!restaurantName && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {restaurantName}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#5C6B4A" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {reviews.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryAvg}>{avgRating.toFixed(1)}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.summaryStars}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={14}
                      color={
                        s <= Math.round(avgRating)
                          ? "#eab308"
                          : "rgba(0,0,0,0.12)"
                      }
                      fill={s <= Math.round(avgRating) ? "#eab308" : "none"}
                    />
                  ))}
                </View>
                <Text style={styles.summaryCount}>
                  {t("all_reviews.based_on")} {reviews.length}{" "}
                  {t("all_reviews.reviews_word")}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.sortRow}>
            {sortOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSort(opt.key)}
                style={[
                  styles.sortChip,
                  sort === opt.key && styles.sortChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    sort === opt.key && styles.sortChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {sortedReviews.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {t("all_reviews.no_reviews")}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {sortedReviews.map((review: any) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewTop}>
                    <View style={styles.reviewUser}>
                      <View style={styles.avatar}>
                        {review.photo_url ? (
                          <Image
                            source={{ uri: review.photo_url }}
                            style={styles.avatarImage}
                          />
                        ) : (
                          <Text style={styles.avatarText}>
                            {review.name?.[0]?.toUpperCase() || "?"}
                          </Text>
                        )}
                      </View>
                      <View>
                        <Text style={styles.reviewName}>{review.name}</Text>
                        <View style={styles.reviewStars}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={10}
                              color={
                                s <= (review.rating || 5)
                                  ? "#eab308"
                                  : "rgba(0,0,0,0.1)"
                              }
                              fill={
                                s <= (review.rating || 5) ? "#eab308" : "none"
                              }
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleLikeReview(review.id)}
                      style={styles.likeBtn}
                    >
                      <Heart
                        size={13}
                        color={review.is_liked ? "#ef4444" : "rgba(0,0,0,0.25)"}
                        fill={review.is_liked ? "#ef4444" : "none"}
                      />
                      <Text
                        style={[
                          styles.likeCount,
                          review.is_liked && { color: "#ef4444" },
                        ]}
                      >
                        {review.likes || 0}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#F7F7F5",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(0,0,0,0.45)",
    marginTop: 1,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  summaryAvg: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  summaryStars: {
    flexDirection: "row",
    gap: 3,
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 12,
    color: "rgba(0,0,0,0.45)",
    fontWeight: "500",
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  sortChipActive: {
    backgroundColor: "#5C6B4A",
    borderColor: "#5C6B4A",
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(0,0,0,0.5)",
  },
  sortChipTextActive: {
    color: "white",
  },
  emptyBox: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "rgba(0,0,0,0.4)",
  },
  reviewCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(92,107,74,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#5C6B4A",
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  reviewName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  likeCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(0,0,0,0.3)",
  },
  reviewComment: {
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
  },
});
