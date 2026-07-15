import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";
import { theme } from "../theme";
import {
  ChevronLeft,
  Star,
  Share2,
  Heart,
  Clock,
  Sparkles,
  Check,
  X,
  MapPin,
  Phone,
  UtensilsCrossed,
  CalendarDays,
  ChevronRight,
} from "lucide-react-native";
import { GoogleGenAI, Type } from "@google/genai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { getApiUrl } from "../lib/api";
import { Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

const { width, height } = Dimensions.get("window");

const ISSUE_CATEGORIES = [
  "Food Quality",
  "Service",
  "Waiting Time",
  "Cleanliness",
  "Atmosphere",
  "Pricing",
  "Staff Behavior",
  "Reservation Experience",
];

function getCategoryLabel(name: string, t: (key: string) => string): string {
  switch (name) {
    case "Food Quality":
      return t("owner_analytics.category_food_quality");
    case "Service":
      return t("owner_analytics.category_service");
    case "Waiting Time":
      return t("owner_analytics.category_waiting_time");
    case "Cleanliness":
      return t("owner_analytics.category_cleanliness");
    case "Atmosphere":
      return t("owner_analytics.category_atmosphere");
    case "Pricing":
      return t("restaurant_detail.category_pricing");
    case "Staff Behavior":
      return t("restaurant_detail.category_staff_behavior");
    case "Reservation Experience":
      return t("restaurant_detail.category_reservation_experience");
    default:
      return name;
  }
}

function getSentimentLabel(
  sentiment: string,
  t: (key: string) => string,
): string {
  switch (sentiment) {
    case "Positive":
      return t("restaurant_detail.sentiment_positive");
    case "Negative":
      return t("restaurant_detail.sentiment_negative");
    case "Neutral":
      return t("restaurant_detail.sentiment_neutral");
    default:
      return sentiment;
  }
}

export default function RestaurantDetail() {
  const [showMenu, setShowMenu] = useState(false);
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { id } = route.params as { id: string };
  const { user } = useAuth();
  const { t } = useLanguage();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [analyzingReview, setAnalyzingReview] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{
    sentiment: string;
    categories: string[];
  } | null>(null);
  const [userConfirmedAnalysis, setUserConfirmedAnalysis] = useState<
    boolean | null
  >(null);
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Haversine formula — returns km between two coords
  const haversineKm = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchRestaurant = async () => {
    const token = await AsyncStorage.getItem("reserva_token");
    try {
      let coords: { lat: number; lng: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setUserCoords(coords);
        }
      } catch (_) {}

      const coordsQuery = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
      const url = getApiUrl(`/api/restaurants/${id}${coordsQuery}`);
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const text = await res.text();
      const data = JSON.parse(text);

      // If API didn't return dist_km but we have coords + restaurant coords, compute it
      if (
        (!data.dist_km || data.dist_km === 0) &&
        coords &&
        data.latitude &&
        data.longitude
      ) {
        data.dist_km = haversineKm(
          coords.lat,
          coords.lng,
          data.latitude,
          data.longitude,
        );
      }

      setRestaurant(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRestaurant();
  }, [id]);

  const handleSave = async () => {
    if (!user) {
      navigation.navigate("Auth");
      return;
    }
    const token = await AsyncStorage.getItem("reserva_token");
    const res = await fetch(getApiUrl("/api/collections"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ restaurant_id: id }),
    });
    if (res.ok) setIsSaved(true);
  };

  const analyzeReview = async (text: string) => {
    if (!text.trim() || text.length < 5) return;
    setAnalyzingReview(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this restaurant review. Detect the overall sentiment (Positive, Negative, or Neutral) and identify which of these categories are mentioned: ${ISSUE_CATEGORIES.join(", ")}. Only return categories that are explicitly mentioned or strongly implied. Review: "${text}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sentiment: {
                type: Type.STRING,
                description: "Positive, Negative, or Neutral",
              },
              categories: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "List of detected categories from the provided list",
              },
            },
            required: ["sentiment", "categories"],
          },
        },
      });
      if (response.text) {
        const result = JSON.parse(response.text);
        if (result.sentiment !== "Positive" || result.categories.length > 0) {
          setAiAnalysis(result);
        } else {
          await performSubmitReview(text, reviewRating, "Positive", []);
        }
      }
    } catch (err) {
      console.error("AI Analysis failed:", err);
      await performSubmitReview(text, reviewRating);
    } finally {
      setAnalyzingReview(false);
    }
  };

  const performSubmitReview = async (
    comment: string,
    rating: number,
    sentiment?: string,
    categories?: string[],
    confirmed = false,
  ) => {
    setSubmittingReview(true);
    const token = await AsyncStorage.getItem("reserva_token");
    try {
      const res = await fetch(getApiUrl("/api/reviews"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurant_id: id,
          rating,
          comment,
          sentiment,
          categories,
          user_confirmed: confirmed,
        }),
      });
      if (res.ok) {
        setIsReviewing(false);
        setReviewComment("");
        setReviewRating(5);
        setAiAnalysis(null);
        setUserConfirmedAnalysis(null);
        fetchRestaurant();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      navigation.navigate("Auth");
      return;
    }
    if (!reviewComment.trim()) return;
    if (!aiAnalysis) {
      await analyzeReview(reviewComment);
    } else {
      await performSubmitReview(
        reviewComment,
        reviewRating,
        aiAnalysis.sentiment,
        aiAnalysis.categories,
        userConfirmedAnalysis === true,
      );
    }
  };

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
        setRestaurant((prev: any) => ({
          ...prev,
          reviews: prev.reviews.map((r: any) =>
            r.id === reviewId
              ? {
                  ...r,
                  is_liked: liked ? 1 : 0,
                  likes: liked ? r.likes + 1 : r.likes - 1,
                }
              : r,
          ),
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getPriceRange = (): string | null => {
    if (!restaurant) return null;
    const { min_price, max_price } = restaurant;
    if (!min_price && !max_price) return null;
    if (min_price && max_price)
      return `${min_price.toLocaleString()} – ${max_price.toLocaleString()} AMD`;
    if (min_price)
      return `${t("restaurant_detail.price_from")} ${min_price.toLocaleString()} AMD`;
    if (max_price)
      return `${t("restaurant_detail.price_up_to")} ${max_price.toLocaleString()} AMD`;
    return null;
  };

  const getSubtitle = () => {
    if (!restaurant) return "";
    const parts: string[] = [];
    if (restaurant.cuisine_type) parts.push(restaurant.cuisine_type);
    if (restaurant.category) parts.push(restaurant.category);
    const filters = [
      ...(restaurant.experience_types || []),
      ...(restaurant.amenities || []),
      ...(restaurant.moods || []),
    ];
    if (filters.length > 0) parts.push(...filters);
    return parts.join(" • ");
  };

  const getHeroImage = (): string => {
    if (!restaurant) return `https://picsum.photos/seed/${id}/1200/800`;
    if (restaurant.background_url) return restaurant.background_url;
    if (restaurant.images?.length) return restaurant.images[0].url;
    return `https://picsum.photos/seed/${id}/1200/800`;
  };

  const isOpen = (): boolean => {
    if (!restaurant?.open_time || !restaurant?.close_time) return true;
    const now = new Date();
    const [oh, om] = restaurant.open_time.split(":").map(Number);
    const [ch, cm] = restaurant.close_time.split(":").map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= oh * 60 + om && cur <= ch * 60 + cm;
  };

  if (!restaurant) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator color="#5C6B4A" size="large" />
      </View>
    );
  }

  const heroImage = getHeroImage();
  const subtitle = getSubtitle();
  const open = isOpen();
  const priceRange = getPriceRange();

  return (
    <View style={styles.container}>
      {/* ── Fullscreen Menu Modal ── */}
      <Modal
        visible={showMenu}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowMenu(false)}
      >
        <View style={styles.menuModal}>
          <TouchableOpacity
            onPress={() => setShowMenu(false)}
            style={[styles.menuCloseBtn, { top: insets.top + 16 }]}
          >
            <X size={18} color="white" strokeWidth={2.5} />
          </TouchableOpacity>
          <ScrollView
            contentContainerStyle={styles.menuModalContent}
            showsVerticalScrollIndicator={false}
          >
            {restaurant.menuImages?.map((img: any, i: number) => (
              <Image
                key={i}
                source={{ uri: img.url }}
                style={styles.menuFullImage}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
        </View>
      </Modal>

      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* ── Hero — fixed single image, no horizontal scroll ── */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} />

          {/* Gradient fade using exact page background color */}
          <LinearGradient
            colors={["transparent", "rgba(247,247,245,0.88)", "#F7F7F5"]}
            style={styles.heroGradient}
            pointerEvents="none"
          />

          {/* Top bar */}
          <View style={[styles.topBar, { top: insets.top + 12 }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.iconBtn}
            >
              <ChevronLeft size={18} color="white" strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.topBarRight}>
              <TouchableOpacity style={styles.iconBtn}>
                <Share2 size={15} color="white" strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.iconBtn}>
                <Heart
                  size={15}
                  color={isSaved ? "#ef4444" : "white"}
                  fill={isSaved ? "#ef4444" : "none"}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Name + subtitle */}
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{restaurant.name}</Text>
            {!!subtitle && <Text style={styles.heroSubtitle}>{subtitle}</Text>}
          </View>

          {/* Rating pill */}
          <View style={styles.ratingPill}>
            <Star size={12} color="#eab308" fill="#eab308" />
            <Text style={styles.ratingText}>
              {restaurant.rating > 0
                ? restaurant.rating.toFixed(1)
                : t("restaurant_detail.new_badge")}
            </Text>
            {restaurant.review_count > 0 && (
              <Text style={styles.ratingCount}>
                ({restaurant.review_count})
              </Text>
            )}
          </View>
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>
          {/* Info pills row */}
          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <Clock size={11} color="#5C6B4A" strokeWidth={2} />
              <Text
                style={[
                  styles.pillText,
                  open ? styles.openText : styles.closedText,
                ]}
              >
                {open
                  ? t("restaurant_detail.open")
                  : t("restaurant_detail.closed")}{" "}
                · {t("restaurant_detail.closes_label")}{" "}
                {restaurant.close_time || "23:00"}
              </Text>
            </View>

            {restaurant.dist_km > 0 && (
              <View style={styles.pill}>
                <MapPin size={11} color="#5C6B4A" strokeWidth={2} />
                <Text style={styles.pillText}>
                  {restaurant.dist_km < 1
                    ? `${Math.round(restaurant.dist_km * 1000)} ${t("restaurant_detail.away_meters")}`
                    : `${restaurant.dist_km.toFixed(1)} ${t("restaurant_detail.away_km")}`}
                </Text>
              </View>
            )}

            {priceRange && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{priceRange}</Text>
              </View>
            )}
          </View>

          {/* Reservations + Menu row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.reservationCard}
              onPress={() =>
                restaurant.phone_number &&
                Linking.openURL(`tel:${restaurant.phone_number}`)
              }
            >
              <Phone size={16} color="#5A5A40" strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>
                  {t("restaurant_detail.reservations_label")}
                </Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {restaurant.phone_number
                    ? restaurant.secondary_phone
                      ? `${restaurant.phone_number} • ${restaurant.secondary_phone}`
                      : restaurant.phone_number
                    : t("restaurant_detail.not_available")}
                </Text>
              </View>
            </TouchableOpacity>

            {restaurant.menuImages?.length > 0 && (
              <TouchableOpacity
                style={styles.menuCard}
                onPress={() => setShowMenu(true)}
              >
                <UtensilsCrossed size={16} color="#5A5A40" strokeWidth={2} />
                <Text style={styles.menuCardText}>
                  {t("restaurant_detail.menu_label")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Location section */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>
              {t("restaurant_detail.location_heading")}
            </Text>
            <View style={styles.locationCard}>
              <View style={styles.locationMap}>
                <WebView
                  style={{ width: "100%", height: "100%" }}
                  scrollEnabled={false}
                  source={{
                    html: `<iframe width="100%" height="100%" style="border:0;pointer-events:none;" src="https://maps.google.com/maps?q=${encodeURIComponent(restaurant.location || restaurant.name)}&t=&z=15&ie=UTF8&iwloc=&output=embed"></iframe>`,
                  }}
                />
                <View style={styles.mapDot} />
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationAddress}>
                  {restaurant.address ||
                    restaurant.location ||
                    t("restaurant_detail.address_not_available")}
                </Text>
                {restaurant.district && (
                  <Text style={styles.locationDistrict}>
                    {restaurant.district}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => {
                    const q = encodeURIComponent(
                      restaurant.address ||
                        restaurant.location ||
                        restaurant.name,
                    );
                    Linking.openURL(`https://maps.google.com/?q=${q}`);
                  }}
                >
                  <Text style={styles.directionsLink}>
                    {t("restaurant_detail.get_directions")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>
              {t("restaurant_detail.about_heading")}
            </Text>
            <Text style={styles.description}>
              {restaurant.description ||
                t("restaurant_detail.default_description")}
            </Text>
          </View>

          {/* Gallery */}
          {restaurant.images?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                {t("restaurant_detail.gallery_heading")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={width * 0.62 + 16}
                decelerationRate="fast"
                contentContainerStyle={{ gap: 12, paddingRight: 4 }}
                style={{ marginTop: 12 }}
              >
                {restaurant.images.map((img: any, i: number) => (
                  <View key={i} style={styles.galleryItem}>
                    <Image
                      source={{ uri: img.url }}
                      style={styles.galleryImage}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Reviews */}
          <View style={[styles.section, { paddingBottom: 120 }]}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.reviewsHeading}>
                {t("restaurant_detail.reviews")}
              </Text>
              <TouchableOpacity style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>
                  {t("restaurant_detail.see_all")}
                </Text>
                <ChevronRight size={14} color="#5C6B4A" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {user?.id !== restaurant.owner_id && (
              <TouchableOpacity
                onPress={() => setIsReviewing(!isReviewing)}
                style={styles.writeReviewBtn}
              >
                <Text style={styles.writeReviewText}>
                  {isReviewing ? t("common.cancel") : t("profile.write_review")}
                </Text>
              </TouchableOpacity>
            )}

            {isReviewing && (
              <View style={styles.reviewForm}>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setReviewRating(star)}
                    >
                      <Star
                        size={22}
                        color={
                          star <= reviewRating ? "#eab308" : "rgba(0,0,0,0.12)"
                        }
                        fill={star <= reviewRating ? "#eab308" : "none"}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={reviewComment}
                  onChangeText={(text) => {
                    setReviewComment(text);
                    if (aiAnalysis) setAiAnalysis(null);
                  }}
                  placeholder={t("restaurant_detail.share_thoughts")}
                  multiline
                  style={styles.reviewInput}
                  placeholderTextColor="rgba(0,0,0,0.3)"
                />
                {aiAnalysis && (
                  <View style={styles.aiBox}>
                    <View style={styles.aiHeader}>
                      <View style={styles.aiIcon}>
                        <Sparkles size={13} color="#5C6B4A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aiTitle}>
                          {t("restaurant_detail.ai_analysis_title")}
                        </Text>
                        <Text style={styles.aiText}>
                          {t("restaurant_detail.ai_detected_prefix")}{" "}
                          <Text style={{ fontWeight: "700" }}>
                            {getSentimentLabel(aiAnalysis.sentiment, t)}
                          </Text>{" "}
                          {t("restaurant_detail.ai_feedback_suffix")}{" "}
                          {aiAnalysis.categories.length > 0
                            ? aiAnalysis.categories
                                .map((c) => getCategoryLabel(c, t))
                                .join(", ")
                            : t("restaurant_detail.general_experience")}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.aiActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setUserConfirmedAnalysis(true);
                          handleSubmitReview();
                        }}
                        style={styles.confirmBtn}
                      >
                        <Check size={12} color="white" />
                        <Text style={styles.confirmBtnText}>
                          {t("common.confirm")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setUserConfirmedAnalysis(false);
                          handleSubmitReview();
                        }}
                        style={styles.ignoreBtn}
                      >
                        <X size={12} color="#2D2D2D" />
                        <Text style={styles.ignoreBtnText}>
                          {t("common.ignore")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {!aiAnalysis && (
                  <TouchableOpacity
                    onPress={handleSubmitReview}
                    disabled={submittingReview || analyzingReview}
                    style={[
                      styles.submitBtn,
                      (submittingReview || analyzingReview) && { opacity: 0.5 },
                    ]}
                  >
                    {analyzingReview ? (
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <Sparkles size={14} color="white" />
                        <Text style={styles.submitBtnText}>
                          {t("restaurant_detail.analyzing")}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {submittingReview
                          ? t("restaurant_detail.submitting")
                          : t("restaurant_detail.submit")}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={{ gap: 12, marginTop: 16 }}>
              {(restaurant.reviews || []).map((review: any) => (
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
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky Reserve Button ── */}
      {user?.id !== restaurant.owner_id && (
        <View
          style={[styles.stickyFooter, { paddingBottom: insets.bottom + 16 }]}
        >
          <TouchableOpacity
            onPress={() => navigation.navigate("ReservationPage", { id })}
            style={styles.reserveBtn}
            activeOpacity={0.88}
          >
            <CalendarDays size={18} color="white" strokeWidth={2} />
            <Text style={styles.reserveBtnText}>
              {t("restaurant_detail.reserve_table_button")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F5",
  },

  // ── Menu Modal ──
  menuModal: {
    flex: 1,
    backgroundColor: "#000",
  },
  menuCloseBtn: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuModalContent: {
    paddingTop: 80,
    paddingBottom: 40,
    gap: 16,
    alignItems: "center",
  },
  menuFullImage: {
    width: width,
    height: width * 1.35,
  },

  // ── Hero ──
  heroContainer: {
    height: 300,
    width: "100%",
    position: "relative",
  },
  heroImage: {
    width,
    height: 300,
    resizeMode: "cover",
  },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 1,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  topBarRight: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfo: {
    position: "absolute",
    bottom: 20,
    left: 18,
    zIndex: 10,
    right: 120,
  },
  heroName: {
    fontSize: 34,
    fontFamily: "InriaSerif-Regular",
    color: "#1A1A1A",
    fontStyle: "normal",
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#5A5A40",
    marginTop: 3,
    fontWeight: "600",
  },
  ratingPill: {
    position: "absolute",
    bottom: 22,
    right: 18,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  ratingCount: {
    fontSize: 11,
    color: "rgba(0,0,0,0.4)",
    fontWeight: "500",
  },

  // ── Content ──
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  pillsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EEEEE8",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(90,90,64,0.15)",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  openText: { color: "#3a6b35" },
  closedText: { color: "#b91c1c" },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  reservationCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EEEEE8",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(90,90,64,0.25)",
  },
  cardLabel: {
    fontSize: 11,
    color: "rgba(0,0,0,0.4)",
    fontWeight: "500",
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EEEEE8",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(90,90,64,0.25)",
  },
  menuCardText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5A5A40",
  },

  section: {
    marginTop: 28,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 14,
  },

  locationCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    gap: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  locationMap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    backgroundColor: "#ddd",
    position: "relative",
  },
  mapDot: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#5A5A40",
    marginTop: -7,
    marginLeft: -7,
    borderWidth: 2.5,
    borderColor: "white",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 20,
  },
  locationDistrict: {
    fontSize: 12,
    color: "rgba(0,0,0,0.45)",
    fontWeight: "400",
  },
  directionsLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5C6B4A",
    marginTop: 6,
    textDecorationLine: "underline",
  },

  description: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
    fontWeight: "400",
  },

  galleryItem: {
    width: width * 0.6,
    height: 140,
    borderRadius: 16,
    overflow: "hidden",
  },
  galleryImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  reviewsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  reviewsHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5C6B4A",
  },
  writeReviewBtn: {
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  writeReviewText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(0,0,0,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  reviewForm: {
    marginTop: 14,
    marginBottom: 8,
  },
  starRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  reviewInput: {
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 14,
    padding: 14,
    fontSize: 13,
    height: 110,
    textAlignVertical: "top",
    color: "#1A1A1A",
  },
  submitBtn: {
    backgroundColor: "#1A1A1A",
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  submitBtnText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2,
  },

  aiBox: {
    backgroundColor: "rgba(92,107,74,0.06)",
    borderWidth: 1,
    borderColor: "rgba(92,107,74,0.15)",
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  aiHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  aiIcon: {
    padding: 6,
    backgroundColor: "rgba(92,107,74,0.12)",
    borderRadius: 8,
  },
  aiTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  aiText: {
    fontSize: 11,
    color: "rgba(0,0,0,0.5)",
    marginTop: 2,
    lineHeight: 16,
  },
  aiActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
  },
  confirmBtnText: {
    color: "white",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  ignoreBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 10,
  },
  ignoreBtnText: {
    color: "#1A1A1A",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
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

  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: "rgba(247,247,245,0.96)",
  },
  reserveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#5C6B4A",
    height: 58,
    borderRadius: 18,
    shadowColor: "#5C6B4A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  reserveBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    fontStyle: "normal",
    fontFamily: "InriaSerif-Regular",
  },
});
