import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  TextInput,
  Switch,
  ActivityIndicator,
  Linking,
  Modal,
  PanResponder,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import { theme } from "../../theme";
import {
  Settings,
  Plus,
  Star,
  ThumbsUp,
  MessageSquare,
  ChevronRight,
  LogOut,
  MapPin,
  Trash2,
  History,
  Ruler,
  User,
  Search,
  Calendar,
  Clock,
  Globe,
  X,
  Send,
  Bug,
  UserCircle,
  Mail,
  MessageCircle,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Store,
  Smartphone,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useLanguage } from "../../lib/LanguageContext";
import LanguageSelector from "../../components/LanguageSelector";
import * as ImagePicker from "expo-image-picker";
import { getApiUrl } from "../../lib/api";
import { useSettings } from "../../lib/SettingsContext";
import { RefreshControl } from "react-native";

const { width } = Dimensions.get("window");

const API_BASE_URL = getApiUrl("/api");

export default function Profile() {
  const { distanceUnit, setDistanceUnit } = useSettings();
  const insets = useSafeAreaInsets();
  const { user, token, logout, login } = useAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation<any>();

  const [updating, setUpdating] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showReviewModal, setShowReviewModal] = React.useState(false);
  const [showSupportModal, setShowSupportModal] = React.useState(false);
  const [activeSubView, setActiveSubView] = React.useState<string | null>(null);
  const [isLangOpen, setIsLangOpen] = React.useState(false);

  // Settings State — removed locationServices & profilePublic & searchVisibility
  const [settings, setSettings] = React.useState({
    pushNotifications: true,
  });

  const [clearingHistory, setClearingHistory] = React.useState(false);
  const [stats, setStats] = React.useState({ reviewsCount: 0, totalLikes: 0 });
  const [reservations, setReservations] = React.useState<any[]>([]);

  const [refreshing, setRefreshing] = React.useState(false);

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = React.useState<{
    visible: boolean;
    type: "clearHistory" | "deleteAccount" | null;
  }>({ visible: false, type: null });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const [statsRes, reservationsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/user/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/my-reservations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const statsData = await statsRes.json();
      const reservationsData = await reservationsRes.json();
      if (statsData && typeof statsData.reviewsCount === "number") {
        setStats(statsData);
      }
      if (Array.isArray(reservationsData)) {
        setReservations(reservationsData);
      }
    } catch (err) {
      // Silently handle network errors on refresh
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  React.useEffect(() => {
    if (token && user) {
      fetch(`${API_BASE_URL}/user/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.reviewsCount === "number") {
            setStats(data);
          }
        })
        .catch(() => {});

      fetch(`${API_BASE_URL}/my-reservations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setReservations(data);
        })
        .catch(() => {});
    }
  }, [token, user]);

  const activeReservations = reservations.filter((r) => {
    if (r.status !== "pending" && r.status !== "confirmed") return false;
    const visitDateTime = new Date(r.date + "T" + r.time);
    const oneHourAfterVisit = new Date(
      visitDateTime.getTime() + 60 * 60 * 1000,
    );
    return new Date() < oneHourAfterVisit;
  });

  // Visited restaurants (completed reservations) for review modal
  const visitedRestaurants = React.useMemo(() => {
    const seen = new Set<number>();
    return reservations
      .filter((r) => r.status === "confirmed" || r.status === "completed")
      .filter((r) => {
        if (seen.has(r.restaurant_id)) return false;
        seen.add(r.restaurant_id);
        return true;
      });
  }, [reservations]);

  const handlePhotoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setUpdating(true);
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      try {
        const res = await fetch(`${API_BASE_URL}/user/update-photo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ photo_url: base64 }),
        });
        if (res.ok) {
          const data = await res.json();
          login(token || "", { ...user, photo_url: data.photo_url });
        }
      } catch (err) {
        // Silently handle
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleClearHistory = async () => {
    setClearingHistory(true);
    try {
      await fetch(`${API_BASE_URL}/user/clear-history`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      // Silently handle
    } finally {
      setClearingHistory(false);
      setConfirmModal({ visible: false, type: null });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) logout();
    } catch (err) {
      // Silently handle
    } finally {
      setConfirmModal({ visible: false, type: null });
    }
  };

  if (!user) {
    return (
      <View style={styles.guestContainer}>
        <View style={styles.guestIconBox}>
          <UserIcon size={40} color="#9CA3AF" />
        </View>
        <View style={styles.centeredText}>
          <Text style={styles.guestTitle}>{t("common.sign_up_reserva")}</Text>
          <Text style={styles.guestSubtitle}>
            {t("profile.guest_subtitle")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate("Auth")}
          style={styles.signInButton}
        >
          <Text style={styles.signInButtonText}>
            {t("common.sign_in_or_register")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const shortSurname = user.surname ? `${user.surname[0]}.` : "";

  if (showSettings) {
    return (
      <View style={styles.container}>
        <View style={[styles.settingsHeader, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity
            onPress={() => setShowSettings(false)}
            style={styles.backButton}
          >
            <ChevronRight
              size={20}
              color="#2D2D2D"
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("settings.title")}</Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top },
          ]}
        >
          <View style={styles.menuList}>
            <Text style={styles.menuSectionLabel}>{t("settings.general")}</Text>

            {/* Language */}
            <MenuButton
              icon={<Globe size={18} color="#666" />}
              label={t("settings.language")}
              value={
                language === "en"
                  ? "English"
                  : language === "am"
                    ? "Հայերեն"
                    : "Русский"
              }
              onClick={() => setIsLangOpen(true)}
            />

            {/* Push Notifications — isolated toggle, no language side effects */}
            <MenuButton
              icon={<MessageSquare size={18} color="#666" />}
              label={t("settings.push_notifications")}
              value={
                settings.pushNotifications
                  ? t("settings.on")
                  : t("settings.off")
              }
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  pushNotifications: !prev.pushNotifications,
                }))
              }
            />

            {/* Clear History */}
            <MenuButton
              icon={<History size={18} color="#666" />}
              label={t("settings.clear_history")}
              onClick={() =>
                setConfirmModal({ visible: true, type: "clearHistory" })
              }
              value={clearingHistory ? t("settings.clearing") : ""}
            />

            {/* Distance Units */}
            <MenuButton
              icon={<Ruler size={18} color="#666" />}
              label={t("settings.distance_units")}
              onClick={() =>
                setDistanceUnit(distanceUnit === "km" ? "mi" : "km")
              }
              value={
                distanceUnit === "km"
                  ? t("settings.kilometers")
                  : t("settings.miles")
              }
            />

            {/* Logout */}
            <MenuButton
              icon={<LogOut size={18} color="#ef4444" />}
              label={t("common.logout")}
              onClick={logout}
              danger
            />

            {/* Delete Account */}
            <MenuButton
              icon={<Trash2 size={18} color="#ef4444" />}
              label={t("settings.delete_account")}
              danger
              onClick={() =>
                setConfirmModal({ visible: true, type: "deleteAccount" })
              }
            />
          </View>

          <View style={styles.legalFooter}>
            <View style={styles.legalLinks}>
              <TouchableOpacity>
                <Text style={styles.legalLink}>
                  {t("profile.terms_of_service")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.legalLink}>
                  {t("profile.privacy_policy")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.versionText}>Reserva v1.0.0 (2026)</Text>
          </View>
        </ScrollView>

        <LanguageSelector
          isOpen={isLangOpen}
          onClose={() => setIsLangOpen(false)}
        />

        {/* Custom Confirm Modal */}
        <ConfirmModal
          visible={confirmModal.visible}
          type={confirmModal.type}
          onCancel={() => setConfirmModal({ visible: false, type: null })}
          onConfirm={
            confirmModal.type === "clearHistory"
              ? handleClearHistory
              : handleDeleteAccount
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C8B6D"
            colors={["#7C8B6D"]}
          />
        }
      >
        {/* Top Header — Bell removed, only Settings */}
        <View style={styles.topActions}>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={styles.iconAction}
          >
            <Settings size={20} color="#2D2D2D" />
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <View style={styles.profileHero}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarMain}>
              {updating && (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator color="#2D2D2D" />
                </View>
              )}
              <Image
                source={{
                  uri:
                    user.photo_url ||
                    "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                }}
                style={[styles.avatarImage, updating && { opacity: 0.3 }]}
              />
            </View>
            <TouchableOpacity
              onPress={handlePhotoUpload}
              style={styles.addPhotoButton}
            >
              <Plus size={20} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.nameSection}>
            {/* Bold name */}
            <Text style={styles.userName}>
              {user.name}{" "}
              <Text style={styles.userNameBold}>{shortSurname}</Text>
            </Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => setShowReviewModal(true)}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>
                {t("profile.write_review")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSupportModal(true)}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>
                {t("profile.contact_support")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Influence Section */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTag}>{t("profile.your_influence")}</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <View style={styles.statIconCircle}>
                  <MessageSquare size={20} color="#666" />
                </View>
                <Text style={styles.statValue}>{stats.reviewsCount}</Text>
                <Text style={styles.statLabel}>
                  {t("profile.reviews_last_90")}
                </Text>
              </View>
              <View style={styles.statBox}>
                <View style={styles.statIconCircle}>
                  <ThumbsUp size={20} color="#666" />
                </View>
                <Text style={styles.statValue}>{stats.totalLikes}</Text>
                <Text style={styles.statLabel}>
                  {t("profile.total_likes_last_90")}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Active Bookings */}
        {activeReservations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("profile.active_bookings")}
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {activeReservations.length}
                </Text>
              </View>
            </View>
            <View style={styles.bookingList}>
              {activeReservations.map((res) => (
                <View key={res.id} style={styles.bookingCard}>
                  <View style={styles.bookingCardTop}>
                    <View style={styles.bookingShopInfo}>
                      <View style={styles.bookingLogoBox}>
                        <Image
                          source={{ uri: res.logo_url }}
                          style={styles.fullImage}
                        />
                      </View>
                      <Text style={styles.bookingShopName}>
                        {res.restaurant_name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        res.status === "pending"
                          ? styles.statusPending
                          : styles.statusConfirmed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusTabText,
                          res.status === "pending"
                            ? styles.statusTabPendingText
                            : styles.statusTabConfirmedText,
                        ]}
                      >
                        {res.status === "pending"
                          ? t("profile.pending")
                          : t("profile.confirmed")}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.bookingCardBottom}>
                    <View style={styles.row}>
                      <View style={styles.bookingDetail}>
                        <Calendar size={12} color="rgba(124, 139, 109, 0.6)" />
                        <Text style={styles.bookingDetailText}>
                          {new Date(res.date).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.bookingDetail}>
                        <Clock size={12} color="rgba(124, 139, 109, 0.6)" />
                        <Text style={styles.bookingDetailText}>{res.time}</Text>
                      </View>
                    </View>
                    <Text style={styles.peopleCountText}>
                      {res.people_count} {t("profile.people_suffix")}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Badges */}
        {(() => {
          const totalReservations = reservations.filter(
            (r) => r.status === "confirmed",
          ).length;
          const isExplorer = totalReservations >= 1;
          const isPopular = totalReservations >= 10;
          const isElite = totalReservations >= 15;
          return (
            <View style={styles.section}>
              <View style={styles.badgesCard}>
                <View style={styles.badgeItem}>
                  <View
                    style={[
                      styles.badgeCircle,
                      isExplorer && styles.badgeActive,
                    ]}
                  >
                    <MapPin
                      size={24}
                      color={isExplorer ? "#C5B9A0" : "rgba(0,0,0,0.1)"}
                      fill={isExplorer ? "#C5B9A0" : "none"}
                    />
                  </View>
                  <Text
                    style={
                      isExplorer ? styles.badgeLabel : styles.badgeLabelMuted
                    }
                  >
                    {t("profile.explorer")}
                  </Text>
                  <Text style={styles.badgeSubLabel}>
                    {t("profile.explorer_desc")}
                  </Text>
                </View>
                <View style={styles.badgeItem}>
                  <View
                    style={[
                      styles.badgeCircle,
                      isPopular && styles.badgeActive,
                    ]}
                  >
                    <ThumbsUp
                      size={24}
                      color={isPopular ? "#C5B9A0" : "rgba(0,0,0,0.1)"}
                      fill={isPopular ? "#C5B9A0" : "none"}
                    />
                  </View>
                  <Text
                    style={
                      isPopular ? styles.badgeLabel : styles.badgeLabelMuted
                    }
                  >
                    {t("profile.popular")}
                  </Text>
                  <Text style={styles.badgeSubLabel}>
                    {t("profile.popular_desc")}
                  </Text>
                </View>
                <View style={styles.badgeItem}>
                  <View
                    style={[styles.badgeCircle, isElite && styles.badgeActive]}
                  >
                    <Star
                      size={24}
                      color={isElite ? "#C5B9A0" : "rgba(0,0,0,0.1)"}
                      fill={isElite ? "#C5B9A0" : "none"}
                    />
                  </View>
                  <Text
                    style={isElite ? styles.badgeLabel : styles.badgeLabelMuted}
                  >
                    {t("profile.elite_guide")}
                  </Text>
                  <Text style={styles.badgeSubLabel}>
                    {t("profile.elite_guide_desc")}
                  </Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Legal Links — no loading dot */}
        <View style={styles.legalFooterExtended}>
          <View style={styles.legalLinksGrid}>
            <TouchableOpacity>
              <Text style={styles.legalLinkSmall}>
                {t("profile.terms_of_service")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.legalLinkSmall}>
                {t("profile.privacy_policy")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.legalLinkSmall}>
                {t("profile.ad_choices")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.legalLinkSmall}>
                {t("profile.content_guidelines")}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.versionColumn}>
            <Text style={styles.versionTextMuted}>Reserva v1.0.0 (2026)</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      {showReviewModal && (
        <ReviewModal
          onClose={() => setShowReviewModal(false)}
          visitedRestaurants={visitedRestaurants}
          token={token}
        />
      )}
      {showSupportModal && (
        <SupportModal
          onClose={() => setShowSupportModal(false)}
          token={token}
          userId={user?.id}
          reservations={reservations}
        />
      )}

      <LanguageSelector
        isOpen={isLangOpen}
        onClose={() => setIsLangOpen(false)}
      />
    </View>
  );
}

// ─── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({
  onClose,
  visitedRestaurants,
  token,
}: {
  onClose: () => void;
  visitedRestaurants: any[];
  token: string | null;
}) {
  const { t } = useLanguage();
  const [step, setStep] = React.useState<"pick" | "write" | "done">(
    visitedRestaurants.length === 0 ? "pick" : "pick",
  );
  const [selectedRestaurant, setSelectedRestaurant] = React.useState<any>(null);
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");

  const handleSubmit = async () => {
    if (!selectedRestaurant || rating === 0) return;
    try {
      await fetch(`${getApiUrl("/api")}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurant_id: selectedRestaurant.restaurant_id,
          rating,
          comment,
        }),
      });
    } catch (e) {}
    setStep("done");
    setTimeout(onClose, 2000);
  };

  if (step === "done") {
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContentSmall}>
          <View style={styles.successIconCircle}>
            <ThumbsUp size={32} color="#5FB26B" />
          </View>
          <Text style={styles.modalTitle}>{t("profile.review_submitted")}</Text>
          <Text style={styles.modalSubtitle}>
            {t("profile.thank_you_feedback")}
          </Text>
        </View>
      </View>
    );
  }

  // No visited restaurants
  if (visitedRestaurants.length === 0) {
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color="#666" />
          </TouchableOpacity>
          <View style={styles.emptyReviewContainer}>
            <View style={styles.emptyReviewIcon}>
              <Store size={36} color="#C5B9A0" />
            </View>
            <Text style={styles.emptyReviewTitle}>
              {t("profile.no_visits_yet")}
            </Text>
            <Text style={styles.emptyReviewSubtitle}>
              {t("profile.no_visits_desc")}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (step === "pick") {
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color="#666" />
          </TouchableOpacity>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("profile.write_review")}</Text>
            <Text style={styles.modalTagLine}>
              {t("profile.choose_restaurant")}
            </Text>
          </View>
          <ScrollView
            style={{ maxHeight: 320 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: 10 }}>
              {visitedRestaurants.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.restaurantPickRow,
                    selectedRestaurant?.id === r.id &&
                      styles.restaurantPickRowActive,
                  ]}
                  onPress={() => setSelectedRestaurant(r)}
                >
                  <View style={styles.restaurantPickLogo}>
                    {r.logo_url ? (
                      <Image
                        source={{ uri: r.logo_url }}
                        style={styles.restaurantPickLogoImg}
                      />
                    ) : (
                      <Store size={18} color="#9CA3AF" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.restaurantPickName}>
                      {r.restaurant_name}
                    </Text>
                    <Text style={styles.restaurantPickDate}>
                      {t("profile.visited_on")}{" "}
                      {new Date(r.date).toLocaleDateString()}
                    </Text>
                  </View>
                  {selectedRestaurant?.id === r.id && (
                    <CheckCircle2 size={18} color="#7C8B6D" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity
            onPress={() => selectedRestaurant && setStep("write")}
            disabled={!selectedRestaurant}
            style={[
              styles.submitBtn,
              !selectedRestaurant && styles.disabledBtn,
            ]}
          >
            <Text style={styles.submitBtnText}>{t("common.continue")}</Text>
            <ChevronRight size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <TouchableOpacity
          onPress={() => setStep("pick")}
          style={styles.closeBtn}
        >
          <ChevronRight
            size={20}
            color="#666"
            style={{ transform: [{ rotate: "180deg" }] }}
          />
        </TouchableOpacity>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {selectedRestaurant?.restaurant_name}
          </Text>
          <Text style={styles.modalTagLine}>
            {t("profile.how_was_experience")}
          </Text>
        </View>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              style={styles.starBtn}
            >
              <Star
                size={32}
                fill={star <= rating ? "#C5B9A0" : "none"}
                color={star <= rating ? "#C5B9A0" : "#E5E7EB"}
              />
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={t("restaurant_detail.share_thoughts")}
          multiline
          style={styles.modalInput}
        />
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={rating === 0}
          style={[styles.submitBtn, rating === 0 && styles.disabledBtn]}
        >
          <Text style={styles.submitBtnText}>
            {t("restaurant_detail.submit")}
          </Text>
          <Send size={18} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Support Modal ─────────────────────────────────────────────────────────────
function SupportModal({
  onClose,
  token,
  userId,
  reservations
}: {
  onClose: () => void;
  token: string | null;
  userId?: number;
  reservations: any[];
}) {
  const { t } = useLanguage();
  const [step, setStep] = React.useState<"main" | "bugOptions" | "bugDetails" | "sent">("main",);
  const [category, setCategory] = React.useState("");
  const [details, setDetails] = React.useState("");
  const [selectedRestaurant, setSelectedRestaurant] = React.useState<any>(null);

  // restaurants the user has actually interacted with, for the picker
  const knownRestaurants = React.useMemo(() => {
    const seen = new Set<number>();
    return reservations.filter((r) => {
      if (seen.has(r.restaurant_id)) return false;
      seen.add(r.restaurant_id);
      return true;
    });
  }, [reservations]);

  const openDetails = (cat: string) => {
    setCategory(cat);
    setSelectedRestaurant(null);
    setDetails("");
    setStep("bugDetails");
  };

  const submit = async () => {
    try {
      await fetch(`${getApiUrl("/api")}/admin/bug-reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          details: details.trim() || null,
          restaurant_id: selectedRestaurant?.restaurant_id || null,
        }),
      });
    } catch (e) {}
    setStep("sent");
    setTimeout(onClose, 2000);
  };

  const isRestaurantCategory = category === "Restaurant info incorrect";
  const canSubmit = isRestaurantCategory
    ? !!selectedRestaurant && details.trim().length > 0
    : details.trim().length > 0;



  const handleGeneralFeedback = () => {
    // Opens Play Store / App Store
    const url = "https://play.google.com/store/apps/details?id=com.reserva.app";
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
    });
    onClose();
  };

  if (step === "sent") {
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContentSmall}>
          <View style={styles.successIconCircle}>
            <Send size={32} color="#5FB26B" />
          </View>
          <Text style={styles.modalTitle}>
            {t("profile.support_request_sent")}
          </Text>
          <Text style={styles.modalSubtitle}>
            {t("profile.we_will_get_back")}
          </Text>
        </View>
      </View>
    );
  }

  if (step === "bugOptions") {
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            onPress={() => setStep("main")}
            style={styles.closeBtn}
          >
            <ChevronRight
              size={20}
              color="#666"
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </TouchableOpacity>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t("profile.report_bug_title")}
            </Text>
            <Text style={styles.modalTagLine}>
              {t("profile.report_bug_subtitle")}
            </Text>
          </View>
          <View style={{ gap: 12 }}>
            <BugOptionButton
              icon={<Smartphone size={20} color="#C5B9A0" />}
              label={t("profile.bug_crashing")}
              description={t("profile.bug_crashing_desc")}
              onPress={() => openDetails("App is crashing")}
            />
            <BugOptionButton
              icon={<MapPin size={20} color="#C5B9A0" />}
              label={t("profile.bug_location")}
              description={t("profile.bug_location_desc")}
              onPress={() => openDetails("Location not working")}
            />
            <BugOptionButton
              icon={<Store size={20} color="#C5B9A0" />}
              label={t("profile.bug_restaurant_info")}
              description={t("profile.bug_restaurant_info_desc")}
              onPress={() => openDetails("Restaurant info incorrect")}
            />
          </View>
        </View>
      </View>
    );
  }

  if (step === "bugDetails") {
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity
            onPress={() => setStep("bugOptions")}
            style={styles.closeBtn}
          >
            <ChevronRight
              size={20}
              color="#666"
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </TouchableOpacity>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{category}</Text>
            <Text style={styles.modalTagLine}>
              {isRestaurantCategory
                ? "Which restaurant, and what's wrong?"
                : "Tell us what happened"}
            </Text>
          </View>

          {isRestaurantCategory && (
            <ScrollView
              style={{ maxHeight: 220 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ gap: 10 }}>
                {knownRestaurants.map((r) => (
                  <TouchableOpacity
                    key={r.restaurant_id}
                    style={[
                      styles.restaurantPickRow,
                      selectedRestaurant?.restaurant_id === r.restaurant_id &&
                        styles.restaurantPickRowActive,
                    ]}
                    onPress={() => setSelectedRestaurant(r)}
                  >
                    <View style={styles.restaurantPickLogo}>
                      {r.logo_url ? (
                        <Image
                          source={{ uri: r.logo_url }}
                          style={styles.restaurantPickLogoImg}
                        />
                      ) : (
                        <Store size={18} color="#9CA3AF" />
                      )}
                    </View>
                    <Text style={styles.restaurantPickName}>
                      {r.restaurant_name}
                    </Text>
                    {selectedRestaurant?.restaurant_id === r.restaurant_id && (
                      <CheckCircle2 size={18} color="#7C8B6D" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder={
              isRestaurantCategory
                ? "e.g. 'Wrong phone number' or 'Opening hours are wrong'"
                : "Describe the issue in a few words"
            }
            multiline
            style={styles.modalInput}
          />

          <TouchableOpacity
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.submitBtn, !canSubmit && styles.disabledBtn]}
          >
            <Text style={styles.submitBtnText}>
              {t("restaurant_detail.submit")}
            </Text>
            <Send size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <X size={20} color="#666" />
        </TouchableOpacity>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t("profile.contact_support")}</Text>
          <Text style={styles.modalTagLine}>
            {t("profile.how_can_we_help")}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {/* Report a Bug */}
          <TouchableOpacity
            style={styles.contactOptionRow}
            onPress={() => setStep("bugOptions")}
          >
            <View style={styles.contactOptionLeft}>
              <View style={styles.contactOptionIcon}>
                <Bug size={20} color="#C5B9A0" />
              </View>
              <View>
                <Text style={styles.contactOptionLabel}>
                  {t("profile.report_bug_title")}
                </Text>
                <Text style={styles.contactOptionDesc}>
                  {t("profile.tell_us_whats_broken")}
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color="rgba(0,0,0,0.2)" />
          </TouchableOpacity>

          {/* General Feedback → opens store */}
          <TouchableOpacity
            style={styles.contactOptionRow}
            onPress={handleGeneralFeedback}
          >
            <View style={styles.contactOptionLeft}>
              <View style={styles.contactOptionIcon}>
                <MessageSquare size={20} color="#C5B9A0" />
              </View>
              <View>
                <Text style={styles.contactOptionLabel}>
                  {t("profile.support_categories.feedback")}
                </Text>
                <Text style={styles.contactOptionDesc}>
                  {t("profile.rate_us_on_store")}
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color="rgba(0,0,0,0.2)" />
          </TouchableOpacity>
        </View>

        {/* Direct Contact */}
        <View style={styles.directContactSection}>
          <Text style={styles.contactLabel}>{t("profile.direct_contact")}</Text>
          <View style={styles.contactList}>
            <DirectContactButton
              icon={<Mail size={16} color="rgba(124, 139, 109, 0.6)" />}
              label={t("profile.contact_methods.email")}
              value="support@reserva.com"
            />
            <View style={styles.row}>
              <DirectContactButton
                icon={
                  <MessageCircle size={16} color="rgba(124, 139, 109, 0.6)" />
                }
                label={t("profile.contact_methods.telegram")}
                style={{ flex: 1 }}
              />
              <DirectContactButton
                icon={
                  <MessageCircle size={16} color="rgba(124, 139, 109, 0.6)" />
                }
                label={t("profile.contact_methods.whatsapp")}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Bug Option Button ─────────────────────────────────────────────────────────
function BugOptionButton({
  icon,
  label,
  description,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.bugOptionRow} onPress={onPress}>
      <View style={styles.bugOptionIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bugOptionLabel}>{label}</Text>
        <Text style={styles.bugOptionDesc}>{description}</Text>
      </View>
      <ChevronRight size={16} color="rgba(0,0,0,0.2)" />
    </TouchableOpacity>
  );
}

// ─── Custom Confirm Modal ──────────────────────────────────────────────────────
function ConfirmModal({
  visible,
  type,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  type: "clearHistory" | "deleteAccount" | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  if (!visible || !type) return null;

  const isDelete = type === "deleteAccount";

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmCard}>
          {/* Icon */}
          <View
            style={[
              styles.confirmIconCircle,
              isDelete ? styles.confirmIconDanger : styles.confirmIconWarning,
            ]}
          >
            {isDelete ? (
              <Trash2 size={28} color="#ef4444" />
            ) : (
              <AlertTriangle size={28} color="#d97706" />
            )}
          </View>

          <Text style={styles.confirmTitle}>
            {isDelete
              ? t("profile.delete_account_title")
              : t("profile.clear_history_title")}
          </Text>
          <Text style={styles.confirmBody}>
            {isDelete
              ? t("profile.delete_account_body")
              : t("profile.clear_history_body")}
          </Text>

          <View style={styles.confirmActions}>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.confirmCancelBtn}
            >
              <Text style={styles.confirmCancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[
                styles.confirmProceedBtn,
                isDelete && styles.confirmProceedDanger,
              ]}
            >
              <Text style={styles.confirmProceedText}>
                {isDelete ? t("common.delete") : t("profile.clear")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Direct Contact Button ─────────────────────────────────────────────────────
function DirectContactButton({
  icon,
  label,
  value,
  style,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  style?: any;
}) {
  const handlePress = () => {
    if (label === "Telegram") Linking.openURL("https://t.me/reservasupport");
    else if (label === "WhatsApp") Linking.openURL("https://wa.me/1234567890");
    else if (value?.includes("@")) Linking.openURL(`mailto:${value}`);
  };
  return (
    <TouchableOpacity
      style={[styles.directContactBtn, style]}
      onPress={handlePress}
    >
      <View style={styles.directContactLeft}>
        <View style={styles.contactIconBox}>{icon}</View>
        <View>
          <Text style={styles.contactBtnLabel}>{label}</Text>
          {value && <Text style={styles.contactBtnValue}>{value}</Text>}
        </View>
      </View>
      <ChevronRight size={14} color="rgba(0,0,0,0.2)" />
    </TouchableOpacity>
  );
}

// ─── Menu Button ───────────────────────────────────────────────────────────────
function MenuButton({
  icon,
  label,
  onClick,
  danger,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  value?: string;
}) {
  return (
    <TouchableOpacity onPress={onClick} style={styles.menuItem}>
      <View style={styles.menuItemLeft}>
        <View style={[styles.menuIconBox, danger && styles.menuIconBoxDanger]}>
          {icon}
        </View>
        <View>
          <Text style={[styles.menuLabel, danger && styles.dangerText]}>
            {label}
          </Text>
          {value ? <Text style={styles.menuValue}>{value}</Text> : null}
        </View>
      </View>
      <ChevronRight
        size={18}
        color={danger ? "rgba(239, 68, 68, 0.3)" : "rgba(45, 45, 45, 0.2)"}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFCFB" },
  scrollContent: { padding: 24, paddingBottom: 100 },
  guestContainer: {
    flex: 1,
    padding: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  guestIconBox: {
    width: 96,
    height: 96,
    backgroundColor: "#F3F4F6",
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  centeredText: { alignItems: "center", gap: 8 },
  guestTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2D2D2D",
    textAlign: "center",
  },
  guestSubtitle: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  signInButton: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#2D2D2D",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  signInButtonText: { color: "white", fontWeight: "bold" },

  // Top actions — only settings icon now
  topActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  iconAction: {
    width: 48,
    height: 48,
    backgroundColor: "white",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },

  profileHero: {
    alignItems: "center",
    gap: 16,
    marginTop: 20,
    marginBottom: 32,
  },
  avatarWrapper: { position: "relative" },
  avatarMain: {
    width: 128,
    height: 128,
    backgroundColor: "white",
    borderRadius: 40,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 36 },
  loadingWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 40,
    height: 40,
    backgroundColor: "#C5B9A0",
    borderRadius: 20,
    borderWidth: 4,
    borderColor: "#FDFCFB",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  nameSection: { alignItems: "center", gap: 4 },
  userName: {
    fontSize: 28,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
    fontWeight: "bold",
  },
  userNameBold: {
    fontWeight: "900",
  },
  userEmail: { fontSize: 14, color: "#666", fontWeight: "500" },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 16,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  secondaryActionText: {
    fontSize: 10,
    fontWeight: "900", // Bold
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#2D2D2D",
  },

  section: { marginBottom: 24 },
  infoCard: {
    backgroundColor: theme.colors.white,
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 24,
    ...theme.shadows.soft,
  },
  sectionTag: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.oliveAccent,
    textTransform: "uppercase",
    letterSpacing: 4,
    textAlign: "center",
  },
  statsGrid: { flexDirection: "row", gap: 16 },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(197, 185, 160, 0.08)",
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    gap: 8,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    backgroundColor: "white",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statValue: { fontSize: 24, fontWeight: "900", color: "#2D2D2D" },
  statLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.oliveAccent,
    textTransform: "uppercase",
    letterSpacing: 4,
  },
  countBadge: {
    width: 20,
    height: 20,
    backgroundColor: "#C5B9A0",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { color: "white", fontSize: 10, fontWeight: "bold" },
  bookingList: { gap: 16 },
  bookingCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  bookingCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bookingShopInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  bookingLogoBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },
  fullImage: { width: "100%", height: "100%", resizeMode: "cover" },
  bookingShopName: { fontWeight: "bold", color: "#2D2D2D" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusPending: { backgroundColor: "#FFFBEB" },
  statusConfirmed: { backgroundColor: "#ECFDF5" },
  statusTabText: {
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statusTabPendingText: { color: "#B45309" },
  statusTabConfirmedText: { color: "#059669" },
  bookingCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.02)",
  },
  row: { flexDirection: "row", gap: 16 },
  bookingDetail: { flexDirection: "row", alignItems: "center", gap: 4 },
  bookingDetailText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
  },
  peopleCountText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#2D2D2D",
    textTransform: "uppercase",
  },
  badgesCard: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    flexDirection: "row",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  badgeItem: { alignItems: "center", gap: 8 },
  badgeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeActive: { backgroundColor: "rgba(197, 185, 160, 0.1)" },
  badgeLabel: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#666",
  },
  badgeLabelMuted: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "rgba(0,0,0,0.1)",
  },
  badgeSubLabel: {
    fontSize: 7,
    color: "rgba(0,0,0,0.2)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  legalFooterExtended: { paddingVertical: 32, gap: 24 },
  legalLinksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  legalLinkSmall: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  versionColumn: { alignItems: "center", gap: 4 },
  versionTextMuted: { fontSize: 10, fontWeight: "500", color: "#D1D5DB" },

  // Settings
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: "white",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
  },
  menuList: { gap: 12 },
  menuSectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginLeft: 16,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 20 },
  menuIconBox: {
    width: 42,
    height: 42,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconBoxDanger: { backgroundColor: "rgba(239, 68, 68, 0.1)" },
  menuLabel: { fontSize: 14, fontWeight: "bold", color: "#2D2D2D" },
  dangerText: { color: "#ef4444" },
  menuValue: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#5FB26B",
    marginTop: 2,
  },
  legalFooter: { marginTop: 32, alignItems: "center", gap: 16 },
  legalLinks: { flexDirection: "row", gap: 24 },
  legalLink: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#9CA3AF",
    textTransform: "uppercase",
  },
  versionText: { fontSize: 10, color: "#D1D5DB" },

  // Modals
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 100,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "white",
    borderRadius: 40,
    padding: 32,
    gap: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  modalContentSmall: {
    width: width * 0.8,
    backgroundColor: "white",
    borderRadius: 40,
    padding: 32,
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  closeBtn: { position: "absolute", top: 24, right: 24, zIndex: 10 },
  modalHeader: { gap: 4 },
  modalTitle: {
    fontSize: 28,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
    textAlign: "center",
  },
  modalSubtitle: { fontSize: 14, color: "#666", textAlign: "center" },
  modalTagLine: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  starBtn: { padding: 4 },
  modalInput: {
    backgroundColor: "rgba(197, 185, 160, 0.08)",
    borderRadius: 24,
    padding: 16,
    height: 120,
    fontSize: 14,
    color: "#2D2D2D",
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: theme.colors.charcoal,
    paddingVertical: 18,
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    ...theme.shadows.premium,
  },
  submitBtnText: { color: "white", fontWeight: "bold" },
  disabledBtn: { opacity: 0.5 },
  successIconCircle: {
    width: 64,
    height: 64,
    backgroundColor: "rgba(95, 178, 107, 0.1)",
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty review state
  emptyReviewContainer: { alignItems: "center", gap: 16, paddingVertical: 16 },
  emptyReviewIcon: {
    width: 72,
    height: 72,
    backgroundColor: "rgba(197, 185, 160, 0.1)",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyReviewTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  emptyReviewSubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },

  // Restaurant picker rows
  restaurantPickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.02)",
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  restaurantPickRowActive: {
    backgroundColor: "rgba(124, 139, 109, 0.08)",
    borderColor: "rgba(124, 139, 109, 0.25)",
  },
  restaurantPickLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  restaurantPickLogoImg: { width: "100%", height: "100%", resizeMode: "cover" },
  restaurantPickName: { fontSize: 14, fontWeight: "700", color: "#2D2D2D" },
  restaurantPickDate: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  // Contact option rows
  contactOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(197, 185, 160, 0.06)",
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(197, 185, 160, 0.15)",
  },
  contactOptionLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  contactOptionIcon: {
    width: 40,
    height: 40,
    backgroundColor: "white",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  contactOptionLabel: { fontSize: 14, fontWeight: "700", color: "#2D2D2D" },
  contactOptionDesc: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  // Bug option rows
  bugOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(197, 185, 160, 0.06)",
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(197, 185, 160, 0.15)",
  },
  bugOptionIcon: {
    width: 40,
    height: 40,
    backgroundColor: "white",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  bugOptionLabel: { fontSize: 14, fontWeight: "700", color: "#2D2D2D" },
  bugOptionDesc: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  // Direct contact
  directContactSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.03)",
    gap: 12,
  },
  contactLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  contactList: { gap: 12 },
  directContactBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  directContactLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  contactIconBox: {},
  contactBtnLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
  },
  contactBtnValue: { fontSize: 9, color: "#666", marginTop: 2 },

  // Custom confirm modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "white",
    borderRadius: 36,
    padding: 32,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
  },
  confirmIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  confirmIconDanger: { backgroundColor: "rgba(239, 68, 68, 0.1)" },
  confirmIconWarning: { backgroundColor: "rgba(217, 119, 6, 0.1)" },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  confirmBody: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
  },
  confirmCancelText: { fontSize: 14, fontWeight: "700", color: "#6B7280" },
  confirmProceedBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: "#d97706",
    alignItems: "center",
  },
  confirmProceedDanger: { backgroundColor: "#ef4444" },
  confirmProceedText: { fontSize: 14, fontWeight: "900", color: "white" },
});
