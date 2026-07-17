import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import {
  Users,
  Store,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Search,
  Ban,
  Trash2,
  Edit,
  Clock,
  Check,
  X,
  MapPin,
  Phone,
  ChefHat,
  Star,
  Plus,
  Crown,
  Sparkles,
  Bug,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "../../lib/api";

type Tab = "users" | "requests" | "payments" | "featured" | "bugs";

const MAX_FEATURED = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function TagList({ items, color }: { items: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={tagStyles.row}>
      {items.slice(0, 4).map((item) => (
        <View
          key={item}
          style={[tagStyles.tag, { backgroundColor: `${color}18` }]}
        >
          <Text style={[tagStyles.tagText, { color }]}>{item}</Text>
        </View>
      ))}
      {items.length > 4 && (
        <View style={[tagStyles.tag, { backgroundColor: "rgba(0,0,0,0.04)" }]}>
          <Text style={[tagStyles.tagText, { color: "#9CA3AF" }]}>
            +{items.length - 4}
          </Text>
        </View>
      )}
    </View>
  );
}

const tagStyles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
});

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [pendingRestaurants, setPendingRestaurants] = useState<any[]>([]);
  const [allApprovedRestaurants, setAllApprovedRestaurants] = useState<any[]>(
    [],
  );
  const [featuredRestaurants, setFeaturedRestaurants] = useState<any[]>([]);
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("requests");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showAddFeaturedModal, setShowAddFeaturedModal] = useState(false);
  const [addFeaturedSearch, setAddFeaturedSearch] = useState("");

  // ── Fetch users ────────────────────────────────────────────────────────────

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(getApiUrl("/api/admin/users"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Admin Fetch Users Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch pending restaurant applications ──────────────────────────────────

  const fetchPendingRestaurants = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(getApiUrl("/api/admin/restaurants/pending"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch pending restaurants");
      const data = await res.json();
      setPendingRestaurants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Admin Fetch Pending Restaurants Error:", err);
      setPendingRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch all approved restaurants (for adding to featured) ───────────────

  const fetchAllApprovedRestaurants = async () => {
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(getApiUrl("/api/admin/restaurants/approved"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch approved restaurants");
      const data = await res.json();
      setAllApprovedRestaurants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Admin Fetch Approved Restaurants Error:", err);
      setAllApprovedRestaurants([]);
    }
  };

  // ── Fetch featured restaurants ─────────────────────────────────────────────

  const fetchFeaturedRestaurants = async () => {
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(getApiUrl("/api/admin/featured"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch featured restaurants");
      const data = await res.json();
      setFeaturedRestaurants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Admin Fetch Featured Restaurants Error:", err);
      setFeaturedRestaurants([]);
    }
  };

  // ── Fetch bug reports ───────────────────────────────────────────────────────

  const fetchBugReports = async () => {
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(getApiUrl("/api/admin/bug-reports"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch bug reports");
      const data = await res.json();
      setBugReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Admin Fetch Bug Reports Error:", err);
      setBugReports([]);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPendingRestaurants();
    fetchFeaturedRestaurants();
    fetchAllApprovedRestaurants();
    fetchBugReports();
  }, []);

  // ── Handle approval / decline ──────────────────────────────────────────────

  const handleRestaurantAction = async (
    restaurantId: number,
    action: "approve" | "decline",
    restaurantName: string,
  ) => {
    const actionLabel = action === "approve" ? "Approve" : "Decline";
    Alert.alert(
      `${actionLabel} Restaurant`,
      `Are you sure you want to ${action} "${restaurantName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: actionLabel,
          style: action === "decline" ? "destructive" : "default",
          onPress: async () => {
            setProcessingId(restaurantId);
            try {
              const token = await AsyncStorage.getItem("reserva_token");
              const res = await fetch(
                getApiUrl(`/api/admin/restaurants/${restaurantId}/${action}`),
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (!res.ok) throw new Error(`Failed to ${action}`);
              setPendingRestaurants((prev) =>
                prev.filter((r) => r.id !== restaurantId),
              );
              // Refresh approved list after approving
              if (action === "approve") fetchAllApprovedRestaurants();
              Alert.alert(
                "Done",
                action === "approve"
                  ? `"${restaurantName}" has been approved.`
                  : `"${restaurantName}" application has been declined.`,
              );
            } catch (err) {
              console.error(`Admin ${action} error:`, err);
              Alert.alert("Error", `Failed to ${action} restaurant.`);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  // ── Add restaurant to featured ─────────────────────────────────────────────

  const handleAddFeatured = async (restaurant: any) => {
    if (featuredRestaurants.length >= MAX_FEATURED) {
      Alert.alert(
        "Limit Reached",
        `You can feature at most ${MAX_FEATURED} restaurants at a time. Remove one to add another.`,
      );
      return;
    }
    if (featuredRestaurants.some((r) => r.id === restaurant.id)) {
      Alert.alert(
        "Already Featured",
        `"${restaurant.name}" is already in the featured list.`,
      );
      return;
    }
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(
        getApiUrl(`/api/admin/featured/${restaurant.id}`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to add featured");
      setFeaturedRestaurants((prev) => [...prev, restaurant]);
      setShowAddFeaturedModal(false);
      setAddFeaturedSearch("");
    } catch (err) {
      console.error("Add featured error:", err);
      Alert.alert("Error", "Failed to add restaurant to featured.");
    }
  };

  // ── Remove restaurant from featured ───────────────────────────────────────

  const handleRemoveFeatured = (restaurant: any) => {
    Alert.alert(
      "Remove from Featured",
      `Remove "${restaurant.name}" from the recommended list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("reserva_token");
              const res = await fetch(
                getApiUrl(`/api/admin/featured/${restaurant.id}`),
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (!res.ok) throw new Error("Failed to remove featured");
              setFeaturedRestaurants((prev) =>
                prev.filter((r) => r.id !== restaurant.id),
              );
            } catch (err) {
              console.error("Remove featured error:", err);
              Alert.alert(
                "Error",
                "Failed to remove restaurant from featured.",
              );
            }
          },
        },
      ],
    );
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredRestaurants = pendingRestaurants.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.location?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredFeatured = featuredRestaurants.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.location?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredBugReports = bugReports.filter(
    (b) =>
      b.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.restaurant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.details?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Restaurants not already featured, filtered by add modal search
  const availableToFeature = allApprovedRestaurants.filter(
    (r) =>
      !featuredRestaurants.some((f) => f.id === r.id) &&
      (r.name?.toLowerCase().includes(addFeaturedSearch.toLowerCase()) ||
        r.location?.toLowerCase().includes(addFeaturedSearch.toLowerCase()) ||
        r.cuisine_type
          ?.toLowerCase()
          .includes(addFeaturedSearch.toLowerCase())),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.headerTitle}>Control Panel</Text>
          <Text style={styles.headerSubtitle}>System Management</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Ban size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.main}>
        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          <AdminTabButton
            active={activeTab === "requests"}
            onClick={() => setActiveTab("requests")}
            icon={
              <Store
                size={18}
                color={activeTab === "requests" ? "white" : "#9CA3AF"}
              />
            }
            label="Approvals"
            badge={pendingRestaurants.length}
          />
          <AdminTabButton
            active={activeTab === "bugs"}
            onClick={() => setActiveTab("bugs")}
            icon={
              <Bug
                size={18}
                color={activeTab === "bugs" ? "white" : "#9CA3AF"}
              />
            }
            label="Bug Reports"
            badge={bugReports.length}
          />
          <AdminTabButton
            active={activeTab === "featured"}
            onClick={() => setActiveTab("featured")}
            icon={
              <Crown
                size={18}
                color={activeTab === "featured" ? "white" : "#9CA3AF"}
              />
            }
            label="Featured"
            badge={featuredRestaurants.length}
            badgeColor="#d97706"
          />
          <AdminTabButton
            active={activeTab === "users"}
            onClick={() => setActiveTab("users")}
            icon={
              <Users
                size={18}
                color={activeTab === "users" ? "white" : "#9CA3AF"}
              />
            }
            label="Users"
          />
          <AdminTabButton
            active={activeTab === "payments"}
            onClick={() => setActiveTab("payments")}
            icon={
              <ShieldAlert
                size={18}
                color={activeTab === "payments" ? "white" : "#9CA3AF"}
              />
            }
            label="Payments"
          />
        </ScrollView>

        <View style={styles.contentHeader}>
          {activeTab === "featured" ? (
            <View style={styles.featuredHeaderRow}>
              <View>
                <Text style={styles.tabTitle}>Featured Spots</Text>
                {/* Slot usage bar */}
                <View style={styles.slotRow}>
                  {Array.from({ length: MAX_FEATURED }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.slotDot,
                        i < featuredRestaurants.length
                          ? styles.slotDotFilled
                          : styles.slotDotEmpty,
                      ]}
                    />
                  ))}
                  <Text style={styles.slotLabel}>
                    {featuredRestaurants.length}/{MAX_FEATURED} slots
                  </Text>
                </View>
              </View>
              {featuredRestaurants.length < MAX_FEATURED && (
                <TouchableOpacity
                  onPress={() => setShowAddFeaturedModal(true)}
                  style={styles.addFeaturedBtn}
                >
                  <Plus size={16} color="white" />
                  <Text style={styles.addFeaturedBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.tabTitle}>
              {activeTab === "requests"
                ? `Pending Approvals${pendingRestaurants.length > 0 ? ` (${pendingRestaurants.length})` : ""}`
                : activeTab === "bugs"
                  ? `Bug Reports${bugReports.length > 0 ? ` (${bugReports.length})` : ""}`
                  : activeTab === "users"
                    ? "Users"
                    : "Payments"}
            </Text>
          )}

          <View style={styles.searchBar}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              placeholder="Search..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#2D2D2D" />
          </View>
        ) : activeTab === "requests" ? (
          // ── Pending restaurant applications ────────────────────────────────
          <FlatList
            data={filteredRestaurants}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <ChefHat size={32} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>No Pending Applications</Text>
                <Text style={styles.emptySubtitle}>
                  Restaurant applications will appear here for review.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <RestaurantApplicationCard
                restaurant={item}
                processing={processingId === item.id}
                onApprove={() =>
                  handleRestaurantAction(item.id, "approve", item.name)
                }
                onDecline={() =>
                  handleRestaurantAction(item.id, "decline", item.name)
                }
              />
            )}
          />
        ) : activeTab === "bugs" ? (
          // ── Bug reports ─────────────────────────────────────────────────────
          <FlatList
            data={filteredBugReports}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Bug size={32} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>No Bug Reports</Text>
                <Text style={styles.emptySubtitle}>
                  Reports submitted by users will appear here.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                <Text style={styles.userName}>{item.category}</Text>
                <Text style={styles.userEmail}>
                  {item.name
                    ? `${item.name} ${item.surname || ""}`
                    : "Unknown user"}
                  {item.email ? ` · ${item.email}` : ""}
                  {item.phone ? ` · ${item.phone}` : ""}
                </Text>
                {item.restaurant_name && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#d97706",
                      marginTop: 6,
                    }}
                  >
                    Restaurant: {item.restaurant_name}
                  </Text>
                )}
                {item.details && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#4B5563",
                      marginTop: 6,
                      lineHeight: 19,
                    }}
                  >
                    {item.details}
                  </Text>
                )}
                <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 8 }}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            )}
          />
        ) : activeTab === "featured" ? (
          // ── Featured restaurants ───────────────────────────────────────────
          <FlatList
            data={filteredFeatured}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View
                  style={[styles.emptyIcon, { backgroundColor: "#fffbeb" }]}
                >
                  <Crown size={32} color="#d97706" />
                </View>
                <Text style={styles.emptyTitle}>No Featured Spots</Text>
                <Text style={styles.emptySubtitle}>
                  Add approved restaurants to the featured list. They'll appear
                  in every customer's Recommended section.
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddFeaturedModal(true)}
                  style={[styles.addFeaturedBtn, { marginTop: 16 }]}
                >
                  <Plus size={16} color="white" />
                  <Text style={styles.addFeaturedBtnText}>
                    Add First Featured
                  </Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item, index }) => (
              <FeaturedRestaurantCard
                restaurant={item}
                rank={index + 1}
                onRemove={() => handleRemoveFeatured(item)}
              />
            )}
          />
        ) : activeTab === "users" ? (
          // ── Users ──────────────────────────────────────────────────────────
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                <View style={styles.userMain}>
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {item.name} {item.surname}
                    </Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                  </View>
                </View>
                <View style={styles.userMeta}>
                  <View
                    style={[
                      styles.roleBadge,
                      item.role === "admin"
                        ? styles.roleAdmin
                        : styles.roleUser,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleBadgeText,
                        item.role === "admin"
                          ? styles.textRed
                          : styles.textBlue,
                      ]}
                    >
                      {item.role}
                    </Text>
                  </View>
                  <View style={styles.statusRow}>
                    <CheckCircle size={12} color="#10B981" />
                    <Text style={styles.statusText}>Active</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionIconButton}>
                    <Edit size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIconButton}>
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          // ── Payments placeholder ───────────────────────────────────────────
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <ShieldAlert size={32} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>Payment Reports</Text>
            <Text style={styles.emptySubtitle}>
              Payment data will appear here.
            </Text>
          </View>
        )}
      </View>

      {/* ── Add Featured Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showAddFeaturedModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddFeaturedModal(false);
          setAddFeaturedSearch("");
        }}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Add to Featured</Text>
              <Text style={styles.modalSubtitle}>
                {featuredRestaurants.length}/{MAX_FEATURED} slots used
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowAddFeaturedModal(false);
                setAddFeaturedSearch("");
              }}
              style={styles.modalCloseBtn}
            >
              <X size={20} color="#2D2D2D" />
            </TouchableOpacity>
          </View>

          {/* Slots remaining banner */}
          <View style={styles.slotsRemainingBanner}>
            <Sparkles size={14} color="#d97706" />
            <Text style={styles.slotsRemainingText}>
              {MAX_FEATURED - featuredRestaurants.length} slot
              {MAX_FEATURED - featuredRestaurants.length !== 1 ? "s" : ""}{" "}
              remaining · Featured restaurants appear in all customers'
              Recommended section
            </Text>
          </View>

          {/* Search */}
          <View
            style={[
              styles.searchBar,
              { marginHorizontal: 16, marginBottom: 12 },
            ]}
          >
            <Search size={16} color="#9CA3AF" />
            <TextInput
              placeholder="Search restaurants..."
              value={addFeaturedSearch}
              onChangeText={setAddFeaturedSearch}
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoFocus
            />
          </View>

          {/* List */}
          <FlatList
            data={availableToFeature}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", padding: 40, gap: 8 }}>
                <ChefHat size={28} color="#9CA3AF" />
                <Text
                  style={{
                    fontSize: 14,
                    color: "#9CA3AF",
                    textAlign: "center",
                  }}
                >
                  {addFeaturedSearch
                    ? "No restaurants match your search"
                    : "All approved restaurants are already featured"}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleAddFeatured(item)}
                style={styles.addRestaurantRow}
                activeOpacity={0.75}
              >
                {item.logo_url ? (
                  <Image
                    source={{ uri: item.logo_url }}
                    style={styles.addRestaurantLogo}
                  />
                ) : (
                  <View style={styles.addRestaurantLogoPlaceholder}>
                    <ChefHat size={16} color="#9CA3AF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.addRestaurantName}>{item.name}</Text>
                  <Text style={styles.addRestaurantMeta} numberOfLines={1}>
                    {item.cuisine_type}
                    {item.location ? `  ·  ${item.location}` : ""}
                  </Text>
                </View>
                <View style={styles.addRestaurantCTA}>
                  <Plus size={14} color="#d97706" />
                  <Text style={styles.addRestaurantCTAText}>Feature</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// ── Featured restaurant card ──────────────────────────────────────────────────

function FeaturedRestaurantCard({
  restaurant,
  rank,
  onRemove,
}: {
  restaurant: any;
  rank: number;
  onRemove: () => void;
}) {
  return (
    <View style={styles.featuredCard}>
      {/* Rank badge */}
      <View style={styles.rankBadge}>
        <Text style={styles.rankBadgeText}>#{rank}</Text>
      </View>

      <View style={styles.featuredCardInner}>
        {/* Logo + info */}
        <View style={styles.featuredCardLeft}>
          {restaurant.logo_url ? (
            <Image
              source={{ uri: restaurant.logo_url }}
              style={styles.featuredLogo}
            />
          ) : (
            <View style={styles.featuredLogoPlaceholder}>
              <ChefHat size={20} color="#9CA3AF" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.featuredName}>{restaurant.name}</Text>
            <Text style={styles.featuredCuisine}>
              {restaurant.cuisine_type}
            </Text>
            {restaurant.location ? (
              <View style={styles.featuredLocationRow}>
                <MapPin size={10} color="#9CA3AF" />
                <Text style={styles.featuredLocationText} numberOfLines={1}>
                  {restaurant.location}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Status + remove */}
        <View style={styles.featuredCardRight}>
          <View style={styles.featuredActiveBadge}>
            <Crown size={10} color="#d97706" />
            <Text style={styles.featuredActiveBadgeText}>Featured</Text>
          </View>
          <TouchableOpacity onPress={onRemove} style={styles.removeFeaturedBtn}>
            <Trash2 size={15} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Restaurant application card ───────────────────────────────────────────────

function RestaurantApplicationCard({
  restaurant,
  processing,
  onApprove,
  onDecline,
}: {
  restaurant: any;
  processing: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.appCard}>
      <View style={styles.appCardHeader}>
        {restaurant.logo_url ? (
          <Image source={{ uri: restaurant.logo_url }} style={styles.appLogo} />
        ) : (
          <View style={styles.appLogoPlaceholder}>
            <ChefHat size={20} color="#9CA3AF" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.appName}>{restaurant.name}</Text>
          <Text style={styles.appCuisine}>{restaurant.cuisine_type}</Text>
        </View>
        <View style={styles.pendingChip}>
          <Clock size={10} color="#d97706" />
          <Text style={styles.pendingChipText}>Pending</Text>
        </View>
      </View>

      <View style={styles.appInfoRow}>
        <MapPin size={12} color="#9CA3AF" />
        <Text style={styles.appInfoText} numberOfLines={1}>
          {restaurant.location || "No location"}
        </Text>
      </View>
      {restaurant.phone_number ? (
        <View style={styles.appInfoRow}>
          <Phone size={12} color="#9CA3AF" />
          <Text style={styles.appInfoText}>{restaurant.phone_number}</Text>
        </View>
      ) : null}

      <View style={styles.appMetaRow}>
        <View style={styles.appMetaItem}>
          <Text style={styles.appMetaLabel}>Hours</Text>
          <Text style={styles.appMetaValue}>
            {restaurant.open_time} – {restaurant.close_time}
          </Text>
        </View>
        <View style={styles.appMetaItem}>
          <Text style={styles.appMetaLabel}>Deposit</Text>
          <Text style={styles.appMetaValue}>
            ${restaurant.deposit_amount || 0}
          </Text>
        </View>
        <View style={styles.appMetaItem}>
          <Text style={styles.appMetaLabel}>Price</Text>
          <Text style={styles.appMetaValue}>
            {restaurant.min_price || 0}–{restaurant.max_price || 0} ֏
          </Text>
        </View>
      </View>

      {restaurant.description ? (
        <Text
          style={styles.appDescription}
          numberOfLines={expanded ? undefined : 2}
        >
          {restaurant.description}
        </Text>
      ) : null}

      {(restaurant.experience_types?.length > 0 ||
        restaurant.amenities?.length > 0 ||
        restaurant.moods?.length > 0) && (
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          style={styles.expandToggle}
        >
          <Text style={styles.expandToggleText}>
            {expanded ? "Show less ▲" : "Show full details ▼"}
          </Text>
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={styles.expandedDetails}>
          {restaurant.experience_types?.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.detailLabel}>Experience Types</Text>
              <TagList items={restaurant.experience_types} color="#7C8B6D" />
            </View>
          )}
          {restaurant.amenities?.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.detailLabel}>Amenities</Text>
              <TagList items={restaurant.amenities} color="#3B82F6" />
            </View>
          )}
          {restaurant.moods?.length > 0 && (
            <View>
              <Text style={styles.detailLabel}>Best For</Text>
              <TagList items={restaurant.moods} color="#8B5CF6" />
            </View>
          )}
        </View>
      )}

      <View style={styles.appActions}>
        <TouchableOpacity
          onPress={onDecline}
          disabled={processing}
          style={styles.declineBtn}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <X size={16} color="#EF4444" />
              <Text style={styles.declineBtnText}>Decline</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onApprove}
          disabled={processing}
          style={styles.approveBtn}
        >
          {processing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Check size={16} color="white" />
              <Text style={styles.approveBtnText}>Approve</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function AdminTabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor = "#EF4444",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onClick}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      {icon}
      <Text style={[styles.tabButtonLabel, active && styles.textWhite]}>
        {label}
      </Text>
      {badge !== undefined && badge > 0 && (
        <View style={[styles.tabBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFCFB" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 2,
  },
  logoutButton: {
    padding: 12,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.1)",
  },
  main: { flex: 1 },
  tabsContainer: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    backgroundColor: "white",
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  tabButtonActive: { backgroundColor: "#2D2D2D" },
  tabButtonLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#6B7280",
  },
  tabBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 9, color: "white", fontWeight: "900" },

  contentHeader: { padding: 24, gap: 16 },
  featuredHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tabTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: 2,
  },

  // ── Slot indicator ──────────────────────────────────────────────────────────
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  slotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  slotDotFilled: { backgroundColor: "#d97706" },
  slotDotEmpty: { backgroundColor: "#E5E7EB" },
  slotLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 4,
  },

  addFeaturedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#d97706",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: "#d97706",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addFeaturedBtnText: {
    fontSize: 11,
    fontWeight: "900",
    color: "white",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    height: 48,
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 14, color: "#2D2D2D" },
  listContent: { padding: 16, paddingBottom: 100, gap: 16 },

  // ── Featured card ───────────────────────────────────────────────────────────
  featuredCard: {
    backgroundColor: "white",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.15)",
    padding: 16,
    shadowColor: "#d97706",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  rankBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#d97706",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomRightRadius: 14,
    borderTopLeftRadius: 22,
  },
  rankBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "white",
    letterSpacing: 0.5,
  },
  featuredCardInner: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 12,
  },
  featuredCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featuredLogo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    resizeMode: "contain",
    backgroundColor: "#F5EEE7",
  },
  featuredLogoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2D2D2D",
    marginBottom: 2,
  },
  featuredCuisine: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  featuredLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  featuredLocationText: { fontSize: 11, color: "#9CA3AF", flex: 1 },
  featuredCardRight: {
    alignItems: "flex-end",
    gap: 10,
  },
  featuredActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fffbeb",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  featuredActiveBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#d97706",
    textTransform: "uppercase",
  },
  removeFeaturedBtn: {
    padding: 8,
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.12)",
  },

  // ── Add Featured Modal ──────────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: "#FDFCFB",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 24,
    paddingTop: 28,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    marginTop: 3,
  },
  modalCloseBtn: {
    padding: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  slotsRemainingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  slotsRemainingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
    flex: 1,
    lineHeight: 17,
  },

  // ── Add restaurant row (inside modal) ────────────────────────────────────────
  addRestaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "white",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  addRestaurantLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    resizeMode: "contain",
    backgroundColor: "#F5EEE7",
  },
  addRestaurantLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  addRestaurantName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2D2D2D",
    marginBottom: 2,
  },
  addRestaurantMeta: { fontSize: 11, color: "#9CA3AF" },
  addRestaurantCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fffbeb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  addRestaurantCTAText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#d97706",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ── Restaurant application card ──────────────────────────────────────────
  appCard: {
    backgroundColor: "white",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  appCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  appLogo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    resizeMode: "contain",
    backgroundColor: "#F5EEE7",
  },
  appLogoPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#2D2D2D",
    marginBottom: 2,
  },
  appCuisine: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  pendingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fffbeb",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  pendingChipText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#d97706",
    textTransform: "uppercase",
  },
  appInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  appInfoText: { fontSize: 12, color: "#6B7280", flex: 1 },
  appMetaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  appMetaItem: { flex: 1 },
  appMetaLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  appMetaValue: { fontSize: 12, fontWeight: "700", color: "#2D2D2D" },
  appDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 8,
  },
  expandToggle: { marginTop: 4, marginBottom: 8 },
  expandToggleText: { fontSize: 11, fontWeight: "700", color: "#7C8B6D" },
  expandedDetails: {
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  appActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
  },
  declineBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#EF4444",
    textTransform: "uppercase",
  },
  approveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#7C8B6D",
    shadowColor: "#7C8B6D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "white",
    textTransform: "uppercase",
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  userCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2D2D2D",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "white", fontWeight: "bold", fontSize: 14 },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: "bold", color: "#2D2D2D" },
  userEmail: { fontSize: 10, color: "#9CA3AF" },
  userMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.02)",
  },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  roleAdmin: { backgroundColor: "rgba(239, 68, 68, 0.1)" },
  roleUser: { backgroundColor: "rgba(59, 130, 246, 0.1)" },
  roleBadgeText: { fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  textRed: { color: "#EF4444" },
  textBlue: { color: "#3B82F6" },
  textWhite: { color: "white" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#10B981",
    textTransform: "uppercase",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  actionIconButton: { padding: 8, backgroundColor: "#F9FAFB", borderRadius: 8 },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2D2D2D",
    textTransform: "uppercase",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },

  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
});
