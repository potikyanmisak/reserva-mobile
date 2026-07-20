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
  EyeOff,
  Eye,
  Calendar,
  UserPlus,
  AlertTriangle,
  Info,
  Mail,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "../../lib/api";

type Tab =
  "users" | "requests" | "payments" | "featured" | "bugs" | "restaurants";

const MAX_FEATURED = 10;

// ── Toast (replaces bare Alert.alert for lightweight feedback) ────────────────

type ToastState = {
  visible: boolean;
  message: string;
  type: "success" | "error" | "info";
};

function Toast({ state }: { state: ToastState }) {
  if (!state.visible) return null;
  const palette =
    state.type === "success"
      ? { bg: "#ECFDF5", border: "#A7F3D0", icon: "#10B981", text: "#065F46" }
      : state.type === "error"
        ? {
            bg: "#FEF2F2",
            border: "#FECACA",
            icon: "#EF4444",
            text: "#991B1B",
          }
        : {
            bg: "#EFF6FF",
            border: "#BFDBFE",
            icon: "#3B82F6",
            text: "#1E3A8A",
          };
  return (
    <View style={styles.toastWrap} pointerEvents="none">
      <View
        style={[
          styles.toastCard,
          { backgroundColor: palette.bg, borderColor: palette.border },
        ]}
      >
        {state.type === "success" ? (
          <CheckCircle size={18} color={palette.icon} />
        ) : state.type === "error" ? (
          <XCircle size={18} color={palette.icon} />
        ) : (
          <Info size={18} color={palette.icon} />
        )}
        <Text style={[styles.toastText, { color: palette.text }]}>
          {state.message}
        </Text>
      </View>
    </View>
  );
}

// ── Confirm modal (replaces native Alert.alert confirmations) ─────────────────

type ConfirmState = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
};

const DEFAULT_CONFIRM: ConfirmState = {
  visible: false,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  destructive: false,
  onConfirm: () => {},
};

function ConfirmModal({
  state,
  onCancel,
}: {
  state: ConfirmState;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmCard}>
          <View
            style={[
              styles.confirmIconCircle,
              state.destructive
                ? { backgroundColor: "rgba(239, 68, 68, 0.1)" }
                : { backgroundColor: "rgba(124, 139, 109, 0.12)" },
            ]}
          >
            <AlertTriangle
              size={22}
              color={state.destructive ? "#EF4444" : "#7C8B6D"}
            />
          </View>
          <Text style={styles.confirmTitle}>{state.title}</Text>
          <Text style={styles.confirmMessage}>{state.message}</Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.confirmCancelBtn}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={state.onConfirm}
              style={[
                styles.confirmActionBtn,
                state.destructive
                  ? { backgroundColor: "#EF4444" }
                  : { backgroundColor: "#7C8B6D" },
              ]}
            >
              <Text style={styles.confirmActionText}>{state.confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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

  // ── New: toast + confirm modal state ──────────────────────────────────────
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "info",
  });
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string, type: ToastState["type"] = "info") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, type });
    toastTimer.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      2600,
    );
  };

  const [confirmState, setConfirmState] =
    useState<ConfirmState>(DEFAULT_CONFIRM);
  const showConfirm = (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmState({
      visible: true,
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel || "Confirm",
      destructive: !!opts.destructive,
      onConfirm: () => {
        setConfirmState(DEFAULT_CONFIRM);
        opts.onConfirm();
      },
    });
  };
  const dismissConfirm = () => setConfirmState(DEFAULT_CONFIRM);

  // ── New: pending application detail modal ─────────────────────────────────
  const [selectedApplication, setSelectedApplication] = useState<any | null>(
    null,
  );

  // ── New: restaurants management (approved list) ───────────────────────────
  const [selectedRestaurant, setSelectedRestaurant] = useState<any | null>(
    null,
  );
  const [restaurantEditMode, setRestaurantEditMode] = useState(false);
  const [restaurantEditForm, setRestaurantEditForm] = useState<any>({});
  const [restaurantReservations, setRestaurantReservations] = useState<any[]>(
    [],
  );
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [showAddReservationModal, setShowAddReservationModal] = useState(false);
  const [newReservation, setNewReservation] = useState({
    customer_email: "",
    guest_name: "",
    guest_phone: "",
    people_count: "2",
    date: "",
    time: "",
    notes: "",
  });
  const [savingRestaurant, setSavingRestaurant] = useState(false);

  // ── New: user edit modal ───────────────────────────────────────────────────
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userEditForm, setUserEditForm] = useState<any>({});
  const [savingUser, setSavingUser] = useState(false);

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
    showConfirm({
      title: `${actionLabel} Restaurant`,
      message: `Are you sure you want to ${action} "${restaurantName}"?`,
      confirmLabel: actionLabel,
      destructive: action === "decline",
      onConfirm: async () => {
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
          setSelectedApplication(null);
          // Refresh approved list after approving
          if (action === "approve") fetchAllApprovedRestaurants();
          showToast(
            action === "approve"
              ? `"${restaurantName}" has been approved.`
              : `"${restaurantName}" application has been declined.`,
            "success",
          );
        } catch (err) {
          console.error(`Admin ${action} error:`, err);
          showToast(`Failed to ${action} restaurant.`, "error");
        } finally {
          setProcessingId(null);
        }
      },
    });
  };

  // ── Add restaurant to featured ─────────────────────────────────────────────

  const handleAddFeatured = async (restaurant: any) => {
    if (featuredRestaurants.length >= MAX_FEATURED) {
      showToast(
        `You can feature at most ${MAX_FEATURED} restaurants at a time.`,
        "error",
      );
      return;
    }
    if (featuredRestaurants.some((r) => r.id === restaurant.id)) {
      showToast(`"${restaurant.name}" is already featured.`, "info");
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
      showToast(`"${restaurant.name}" added to featured.`, "success");
    } catch (err) {
      console.error("Add featured error:", err);
      showToast("Failed to add restaurant to featured.", "error");
    }
  };

  // ── Remove restaurant from featured ───────────────────────────────────────

  const handleRemoveFeatured = (restaurant: any) => {
    showConfirm({
      title: "Remove from Featured",
      message: `Remove "${restaurant.name}" from the recommended list?`,
      confirmLabel: "Remove",
      destructive: true,
      onConfirm: async () => {
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
          showToast(`"${restaurant.name}" removed from featured.`, "success");
        } catch (err) {
          console.error("Remove featured error:", err);
          showToast("Failed to remove restaurant from featured.", "error");
        }
      },
    });
  };

  // ── New: hide / unhide / delete restaurant ─────────────────────────────────

  const handleToggleHideRestaurant = (restaurant: any) => {
    const willHide = !restaurant.is_hidden;
    showConfirm({
      title: willHide ? "Hide Restaurant" : "Unhide Restaurant",
      message: willHide
        ? `"${restaurant.name}" will be hidden from customers immediately.`
        : `"${restaurant.name}" will be visible to customers again.`,
      confirmLabel: willHide ? "Hide" : "Unhide",
      destructive: willHide,
      onConfirm: async () => {
        try {
          const token = await AsyncStorage.getItem("reserva_token");
          const res = await fetch(
            getApiUrl(
              `/api/admin/restaurants/${restaurant.id}/${willHide ? "hide" : "unhide"}`,
            ),
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (!res.ok) throw new Error("Failed to update visibility");
          const updater = (list: any[]) =>
            list.map((r) =>
              r.id === restaurant.id ? { ...r, is_hidden: willHide } : r,
            );
          setAllApprovedRestaurants(updater);
          setSelectedRestaurant((prev: any) =>
            prev && prev.id === restaurant.id
              ? { ...prev, is_hidden: willHide }
              : prev,
          );
          showToast(
            willHide
              ? `"${restaurant.name}" is now hidden.`
              : `"${restaurant.name}" is visible again.`,
            "success",
          );
        } catch (err) {
          console.error("Toggle hide restaurant error:", err);
          showToast("Failed to update restaurant visibility.", "error");
        }
      },
    });
  };

  const handleDeleteRestaurant = (restaurant: any) => {
    showConfirm({
      title: "Delete Restaurant",
      message: `This permanently deletes "${restaurant.name}" along with its reservations, reviews, and tables. This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          const token = await AsyncStorage.getItem("reserva_token");
          const res = await fetch(
            getApiUrl(`/api/admin/restaurants/${restaurant.id}`),
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (!res.ok) throw new Error("Failed to delete restaurant");
          setAllApprovedRestaurants((prev) =>
            prev.filter((r) => r.id !== restaurant.id),
          );
          setFeaturedRestaurants((prev) =>
            prev.filter((r) => r.id !== restaurant.id),
          );
          setSelectedRestaurant(null);
          showToast(`"${restaurant.name}" has been deleted.`, "success");
        } catch (err) {
          console.error("Delete restaurant error:", err);
          showToast("Failed to delete restaurant.", "error");
        }
      },
    });
  };

  // ── New: fetch reservations for a restaurant (admin view) ─────────────────

  const fetchRestaurantReservations = async (restaurantId: number) => {
    setLoadingReservations(true);
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(
        getApiUrl(`/api/admin/restaurants/${restaurantId}/reservations`),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to fetch reservations");
      const data = await res.json();
      setRestaurantReservations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch restaurant reservations error:", err);
      setRestaurantReservations([]);
    } finally {
      setLoadingReservations(false);
    }
  };

  const openRestaurantDetail = (restaurant: any) => {
    setSelectedRestaurant(restaurant);
    setRestaurantEditMode(false);
    setRestaurantEditForm({
      name: restaurant.name || "",
      description: restaurant.description || "",
      cuisine_type: restaurant.cuisine_type || "",
      open_time: restaurant.open_time || "",
      close_time: restaurant.close_time || "",
      deposit_amount: String(restaurant.deposit_amount ?? 0),
      min_price: String(restaurant.min_price ?? 0),
      max_price: String(restaurant.max_price ?? 0),
      phone_number: restaurant.phone_number || "",
      location: restaurant.location || "",
    });
    fetchRestaurantReservations(restaurant.id);
  };

  const handleSaveRestaurantEdit = async () => {
    if (!selectedRestaurant) return;
    setSavingRestaurant(true);
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(
        getApiUrl(`/api/restaurants/${selectedRestaurant.id}`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...restaurantEditForm,
            deposit_amount: Number(restaurantEditForm.deposit_amount) || 0,
            min_price: Number(restaurantEditForm.min_price) || 0,
            max_price: Number(restaurantEditForm.max_price) || 0,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to update restaurant");
      const updated = { ...selectedRestaurant, ...restaurantEditForm };
      setAllApprovedRestaurants((prev) =>
        prev.map((r) => (r.id === selectedRestaurant.id ? updated : r)),
      );
      setSelectedRestaurant(updated);
      setRestaurantEditMode(false);
      showToast("Restaurant updated.", "success");
    } catch (err) {
      console.error("Save restaurant edit error:", err);
      showToast("Failed to save changes.", "error");
    } finally {
      setSavingRestaurant(false);
    }
  };

  const handleAddReservation = async () => {
    if (!selectedRestaurant) return;
    if (!newReservation.date || !newReservation.time) {
      showToast("Date and time are required.", "error");
      return;
    }
    if (!newReservation.customer_email && !newReservation.guest_name) {
      showToast("Add a customer email or a guest name.", "error");
      return;
    }
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(
        getApiUrl(
          `/api/admin/restaurants/${selectedRestaurant.id}/reservations`,
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...newReservation,
            people_count: Number(newReservation.people_count) || 1,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to add reservation");
      setShowAddReservationModal(false);
      setNewReservation({
        customer_email: "",
        guest_name: "",
        guest_phone: "",
        people_count: "2",
        date: "",
        time: "",
        notes: "",
      });
      fetchRestaurantReservations(selectedRestaurant.id);
      showToast("Reservation added.", "success");
    } catch (err) {
      console.error("Add reservation error:", err);
      showToast("Failed to add reservation.", "error");
    }
  };

  // ── New: user edit / delete ────────────────────────────────────────────────

  const openEditUser = (user: any) => {
    setEditingUser(user);
    setUserEditForm({
      name: user.name || "",
      surname: user.surname || "",
      email: user.email || "",
      role: user.role || "customer",
    });
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const token = await AsyncStorage.getItem("reserva_token");
      const res = await fetch(getApiUrl(`/api/admin/users/${editingUser.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userEditForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update user");
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...data.user } : u)),
      );
      setEditingUser(null);
      showToast("User updated.", "success");
    } catch (err: any) {
      console.error("Save user edit error:", err);
      showToast(err?.message || "Failed to update user.", "error");
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = (user: any) => {
    showConfirm({
      title: "Delete User",
      message: `This permanently deletes ${user.name} ${user.surname || ""} and all of their reservations and reviews.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          const token = await AsyncStorage.getItem("reserva_token");
          const res = await fetch(getApiUrl(`/api/admin/users/${user.id}`), {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Failed to delete user");
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
          showToast("User deleted.", "success");
        } catch (err: any) {
          console.error("Delete user error:", err);
          showToast(err?.message || "Failed to delete user.", "error");
        }
      },
    });
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

  const filteredAllRestaurants = allApprovedRestaurants.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cuisine_type?.toLowerCase().includes(searchQuery.toLowerCase()),
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
              <Clock
                size={18}
                color={activeTab === "requests" ? "white" : "#9CA3AF"}
              />
            }
            label="Approvals"
            badge={pendingRestaurants.length}
          />
          <AdminTabButton
            active={activeTab === "restaurants"}
            onClick={() => {
              setActiveTab("restaurants");
              fetchAllApprovedRestaurants();
            }}
            icon={
              <Store
                size={18}
                color={activeTab === "restaurants" ? "white" : "#9CA3AF"}
              />
            }
            label="Restaurants"
            badge={allApprovedRestaurants.length}
            badgeColor="#7C8B6D"
          />
          <AdminTabButton
            active={activeTab === "bugs"}
            onClick={() => {
              setActiveTab("bugs");
              fetchBugReports();
            }}
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
                : activeTab === "restaurants"
                  ? `Restaurants${allApprovedRestaurants.length > 0 ? ` (${allApprovedRestaurants.length})` : ""}`
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
                onPress={() => setSelectedApplication(item)}
                onApprove={() =>
                  handleRestaurantAction(item.id, "approve", item.name)
                }
                onDecline={() =>
                  handleRestaurantAction(item.id, "decline", item.name)
                }
              />
            )}
          />
        ) : activeTab === "restaurants" ? (
          // ── All restaurants management ──────────────────────────────────────
          <FlatList
            data={filteredAllRestaurants}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Store size={32} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>No Restaurants Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Approved restaurants will appear here for management.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <RestaurantManageCard
                restaurant={item}
                onPress={() => openRestaurantDetail(item)}
                onToggleHide={() => handleToggleHideRestaurant(item)}
                onDelete={() => handleDeleteRestaurant(item)}
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
                  <TouchableOpacity
                    style={styles.actionIconButton}
                    onPress={() => openEditUser(item)}
                  >
                    <Edit size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIconButton}
                    onPress={() => handleDeleteUser(item)}
                  >
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

      {/* ── Application Detail Modal ───────────────────────────────────────── */}
      <Modal
        visible={!!selectedApplication}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedApplication(null)}
      >
        {selectedApplication ? (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {selectedApplication.name}
                </Text>
                <Text style={styles.modalSubtitle}>Full Application</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedApplication(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#2D2D2D" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            >
              <View style={styles.detailHeaderRow}>
                {selectedApplication.logo_url ? (
                  <Image
                    source={{ uri: selectedApplication.logo_url }}
                    style={styles.detailLogo}
                  />
                ) : (
                  <View style={styles.appLogoPlaceholder}>
                    <ChefHat size={24} color="#9CA3AF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailName}>
                    {selectedApplication.name}
                  </Text>
                  <Text style={styles.appCuisine}>
                    {selectedApplication.cuisine_type}
                  </Text>
                </View>
                <View style={styles.pendingChip}>
                  <Clock size={10} color="#d97706" />
                  <Text style={styles.pendingChipText}>Pending</Text>
                </View>
              </View>

              {/* Owner contact */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Submitted By</Text>
                <View style={styles.appInfoRow}>
                  <Users size={12} color="#9CA3AF" />
                  <Text style={styles.appInfoText}>
                    {selectedApplication.owner_name}{" "}
                    {selectedApplication.owner_surname}
                  </Text>
                </View>
                {selectedApplication.owner_email ? (
                  <View style={styles.appInfoRow}>
                    <Mail size={12} color="#9CA3AF" />
                    <Text style={styles.appInfoText}>
                      {selectedApplication.owner_email}
                    </Text>
                  </View>
                ) : null}
                {selectedApplication.owner_phone ? (
                  <View style={styles.appInfoRow}>
                    <Phone size={12} color="#9CA3AF" />
                    <Text style={styles.appInfoText}>
                      {selectedApplication.owner_phone}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Location & contact */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>
                  Location & Contact
                </Text>
                <View style={styles.appInfoRow}>
                  <MapPin size={12} color="#9CA3AF" />
                  <Text style={styles.appInfoText}>
                    {selectedApplication.location || "No location provided"}
                  </Text>
                </View>
                {selectedApplication.phone_number ? (
                  <View style={styles.appInfoRow}>
                    <Phone size={12} color="#9CA3AF" />
                    <Text style={styles.appInfoText}>
                      {selectedApplication.phone_number}
                      {selectedApplication.secondary_phone
                        ? `  ·  ${selectedApplication.secondary_phone}`
                        : ""}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Operations */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Operations</Text>
                <View style={styles.appMetaRow}>
                  <View style={styles.appMetaItem}>
                    <Text style={styles.appMetaLabel}>Hours</Text>
                    <Text style={styles.appMetaValue}>
                      {selectedApplication.open_time} –{" "}
                      {selectedApplication.close_time}
                    </Text>
                  </View>
                  <View style={styles.appMetaItem}>
                    <Text style={styles.appMetaLabel}>Deposit</Text>
                    <Text style={styles.appMetaValue}>
                      ${selectedApplication.deposit_amount || 0}
                    </Text>
                  </View>
                  <View style={styles.appMetaItem}>
                    <Text style={styles.appMetaLabel}>Price Range</Text>
                    <Text style={styles.appMetaValue}>
                      {selectedApplication.min_price || 0}–
                      {selectedApplication.max_price || 0} ֏
                    </Text>
                  </View>
                </View>
                <View style={styles.appMetaRow}>
                  <View style={styles.appMetaItem}>
                    <Text style={styles.appMetaLabel}>Cancellation</Text>
                    <Text style={styles.appMetaValue}>
                      {selectedApplication.cancellation_policy_hours || 24}h
                      notice
                    </Text>
                  </View>
                  <View style={styles.appMetaItem}>
                    <Text style={styles.appMetaLabel}>Outdoor Seating</Text>
                    <Text style={styles.appMetaValue}>
                      {selectedApplication.outdoor_seating ? "Yes" : "No"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Description */}
              {selectedApplication.description ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Description</Text>
                  <Text style={styles.appDescription}>
                    {selectedApplication.description}
                  </Text>
                </View>
              ) : null}

              {/* Tags */}
              {(selectedApplication.experience_types?.length > 0 ||
                selectedApplication.amenities?.length > 0 ||
                selectedApplication.moods?.length > 0) && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Details</Text>
                  {selectedApplication.experience_types?.length > 0 && (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={styles.detailLabel}>Experience Types</Text>
                      <TagList
                        items={selectedApplication.experience_types}
                        color="#7C8B6D"
                      />
                    </View>
                  )}
                  {selectedApplication.amenities?.length > 0 && (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={styles.detailLabel}>Amenities</Text>
                      <TagList
                        items={selectedApplication.amenities}
                        color="#3B82F6"
                      />
                    </View>
                  )}
                  {selectedApplication.moods?.length > 0 && (
                    <View>
                      <Text style={styles.detailLabel}>Best For</Text>
                      <TagList
                        items={selectedApplication.moods}
                        color="#8B5CF6"
                      />
                    </View>
                  )}
                </View>
              )}

              {/* Photos */}
              {selectedApplication.images?.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Photos</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {selectedApplication.images.map((img: any) => (
                        <Image
                          key={img.id}
                          source={{ uri: img.url }}
                          style={styles.galleryThumb}
                        />
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              <View style={[styles.appActions, { marginTop: 8 }]}>
                <TouchableOpacity
                  onPress={() =>
                    handleRestaurantAction(
                      selectedApplication.id,
                      "decline",
                      selectedApplication.name,
                    )
                  }
                  disabled={processingId === selectedApplication.id}
                  style={styles.declineBtn}
                >
                  <X size={16} color="#EF4444" />
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    handleRestaurantAction(
                      selectedApplication.id,
                      "approve",
                      selectedApplication.name,
                    )
                  }
                  disabled={processingId === selectedApplication.id}
                  style={styles.approveBtn}
                >
                  <Check size={16} color="white" />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Modal>

      {/* ── Restaurant Detail / Manage Modal ───────────────────────────────── */}
      <Modal
        visible={!!selectedRestaurant}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedRestaurant(null)}
      >
        {selectedRestaurant ? (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedRestaurant.name}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedRestaurant.is_hidden
                    ? "Hidden from customers"
                    : "Live"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedRestaurant(null);
                  setRestaurantEditMode(false);
                }}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#2D2D2D" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            >
              {/* Top actions */}
              <View style={styles.appActions}>
                <TouchableOpacity
                  onPress={() => handleToggleHideRestaurant(selectedRestaurant)}
                  style={styles.manageSecondaryBtn}
                >
                  {selectedRestaurant.is_hidden ? (
                    <Eye size={15} color="#6B7280" />
                  ) : (
                    <EyeOff size={15} color="#6B7280" />
                  )}
                  <Text style={styles.manageSecondaryBtnText}>
                    {selectedRestaurant.is_hidden ? "Unhide" : "Hide"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRestaurantEditMode((v) => !v)}
                  style={[styles.manageSecondaryBtn, { flex: 1 }]}
                >
                  <Edit size={15} color="#6B7280" />
                  <Text style={styles.manageSecondaryBtnText}>
                    {restaurantEditMode ? "Cancel Edit" : "Edit Details"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteRestaurant(selectedRestaurant)}
                  style={styles.manageDeleteBtn}
                >
                  <Trash2 size={15} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {restaurantEditMode ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Edit Details</Text>
                  {[
                    { key: "name", label: "Name" },
                    { key: "cuisine_type", label: "Cuisine" },
                    { key: "location", label: "Location" },
                    { key: "phone_number", label: "Phone" },
                    { key: "open_time", label: "Open Time" },
                    { key: "close_time", label: "Close Time" },
                    { key: "deposit_amount", label: "Deposit ($)" },
                    { key: "min_price", label: "Min Price (֏)" },
                    { key: "max_price", label: "Max Price (֏)" },
                  ].map((f) => (
                    <View key={f.key} style={{ marginBottom: 12 }}>
                      <Text style={styles.detailLabel}>{f.label}</Text>
                      <TextInput
                        value={String(restaurantEditForm[f.key] ?? "")}
                        onChangeText={(t) =>
                          setRestaurantEditForm((prev: any) => ({
                            ...prev,
                            [f.key]: t,
                          }))
                        }
                        style={styles.formInput}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  ))}
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <TextInput
                      value={restaurantEditForm.description ?? ""}
                      onChangeText={(t) =>
                        setRestaurantEditForm((prev: any) => ({
                          ...prev,
                          description: t,
                        }))
                      }
                      style={[styles.formInput, { height: 90 }]}
                      multiline
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleSaveRestaurantEdit}
                    disabled={savingRestaurant}
                    style={styles.approveBtn}
                  >
                    {savingRestaurant ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Check size={16} color="white" />
                        <Text style={styles.approveBtnText}>Save Changes</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Overview</Text>
                  <View style={styles.appInfoRow}>
                    <MapPin size={12} color="#9CA3AF" />
                    <Text style={styles.appInfoText}>
                      {selectedRestaurant.location || "No location"}
                    </Text>
                  </View>
                  {selectedRestaurant.phone_number ? (
                    <View style={styles.appInfoRow}>
                      <Phone size={12} color="#9CA3AF" />
                      <Text style={styles.appInfoText}>
                        {selectedRestaurant.phone_number}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.appInfoRow}>
                    <Users size={12} color="#9CA3AF" />
                    <Text style={styles.appInfoText}>
                      Owner: {selectedRestaurant.owner_name}{" "}
                      {selectedRestaurant.owner_surname} ·{" "}
                      {selectedRestaurant.owner_email}
                    </Text>
                  </View>
                </View>
              )}

              {/* Reservations / customers */}
              <View style={styles.detailSection}>
                <View style={styles.reservationsHeaderRow}>
                  <Text style={styles.detailSectionTitle}>
                    Customers & Reservations
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAddReservationModal(true)}
                    style={styles.addReservationBtn}
                  >
                    <UserPlus size={14} color="white" />
                    <Text style={styles.addReservationBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {loadingReservations ? (
                  <ActivityIndicator
                    size="small"
                    color="#2D2D2D"
                    style={{ marginVertical: 16 }}
                  />
                ) : restaurantReservations.length === 0 ? (
                  <Text style={styles.emptySubtitle}>
                    No reservations yet for this restaurant.
                  </Text>
                ) : (
                  restaurantReservations.map((rv: any) => (
                    <View key={rv.id} style={styles.reservationRow}>
                      <View style={styles.reservationDateBox}>
                        <Calendar size={12} color="#7C8B6D" />
                        <Text style={styles.reservationDateText}>
                          {rv.date}
                        </Text>
                        <Text style={styles.reservationTimeText}>
                          {rv.time}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reservationName}>
                          {rv.customer_name
                            ? `${rv.customer_name} ${rv.customer_surname || ""}`
                            : rv.guest_name || "Guest"}
                        </Text>
                        <Text style={styles.reservationMeta}>
                          {rv.people_count} guests
                          {rv.customer_phone || rv.guest_phone
                            ? ` · ${rv.customer_phone || rv.guest_phone}`
                            : ""}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.reservationStatusChip,
                          rv.status === "confirmed"
                            ? { backgroundColor: "rgba(16,185,129,0.1)" }
                            : rv.status === "cancelled" ||
                                rv.status === "declined"
                              ? { backgroundColor: "rgba(239,68,68,0.1)" }
                              : { backgroundColor: "rgba(217,119,6,0.1)" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.reservationStatusText,
                            rv.status === "confirmed"
                              ? { color: "#10B981" }
                              : rv.status === "cancelled" ||
                                  rv.status === "declined"
                                ? { color: "#EF4444" }
                                : { color: "#d97706" },
                          ]}
                        >
                          {rv.status}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Modal>

      {/* ── Add Reservation Modal ──────────────────────────────────────────── */}
      <Modal
        visible={showAddReservationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddReservationModal(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.formCard}>
            <Text style={styles.confirmTitle}>Add Reservation</Text>
            <Text style={[styles.confirmMessage, { marginBottom: 12 }]}>
              Link to an existing customer by email, or add a guest.
            </Text>

            <Text style={styles.detailLabel}>Customer Email (optional)</Text>
            <TextInput
              value={newReservation.customer_email}
              onChangeText={(t) =>
                setNewReservation((prev) => ({ ...prev, customer_email: t }))
              }
              style={styles.formInput}
              placeholder="customer@email.com"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={[styles.detailLabel, { marginTop: 10 }]}>
              Guest Name (if no account)
            </Text>
            <TextInput
              value={newReservation.guest_name}
              onChangeText={(t) =>
                setNewReservation((prev) => ({ ...prev, guest_name: t }))
              }
              style={styles.formInput}
              placeholder="Guest full name"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={[styles.detailLabel, { marginTop: 10 }]}>
              Guest Phone
            </Text>
            <TextInput
              value={newReservation.guest_phone}
              onChangeText={(t) =>
                setNewReservation((prev) => ({ ...prev, guest_phone: t }))
              }
              style={styles.formInput}
              placeholder="+1 555 0100"
              placeholderTextColor="#9CA3AF"
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Date</Text>
                <TextInput
                  value={newReservation.date}
                  onChangeText={(t) =>
                    setNewReservation((prev) => ({ ...prev, date: t }))
                  }
                  style={styles.formInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Time</Text>
                <TextInput
                  value={newReservation.time}
                  onChangeText={(t) =>
                    setNewReservation((prev) => ({ ...prev, time: t }))
                  }
                  style={styles.formInput}
                  placeholder="HH:MM"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={{ width: 90 }}>
                <Text style={styles.detailLabel}>Guests</Text>
                <TextInput
                  value={newReservation.people_count}
                  onChangeText={(t) =>
                    setNewReservation((prev) => ({
                      ...prev,
                      people_count: t,
                    }))
                  }
                  style={styles.formInput}
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <Text style={[styles.detailLabel, { marginTop: 10 }]}>
              Notes (optional)
            </Text>
            <TextInput
              value={newReservation.notes}
              onChangeText={(t) =>
                setNewReservation((prev) => ({ ...prev, notes: t }))
              }
              style={styles.formInput}
              placeholder="Anniversary, allergy, etc."
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.confirmActions}>
              <TouchableOpacity
                onPress={() => setShowAddReservationModal(false)}
                style={styles.confirmCancelBtn}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddReservation}
                style={[
                  styles.confirmActionBtn,
                  { backgroundColor: "#7C8B6D" },
                ]}
              >
                <Text style={styles.confirmActionText}>Add Reservation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit User Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={!!editingUser}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingUser(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.formCard}>
            <Text style={styles.confirmTitle}>Edit User</Text>

            <Text style={styles.detailLabel}>First Name</Text>
            <TextInput
              value={userEditForm.name ?? ""}
              onChangeText={(t) =>
                setUserEditForm((prev: any) => ({ ...prev, name: t }))
              }
              style={styles.formInput}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={[styles.detailLabel, { marginTop: 10 }]}>
              Last Name
            </Text>
            <TextInput
              value={userEditForm.surname ?? ""}
              onChangeText={(t) =>
                setUserEditForm((prev: any) => ({ ...prev, surname: t }))
              }
              style={styles.formInput}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={[styles.detailLabel, { marginTop: 10 }]}>Email</Text>
            <TextInput
              value={userEditForm.email ?? ""}
              onChangeText={(t) =>
                setUserEditForm((prev: any) => ({ ...prev, email: t }))
              }
              style={styles.formInput}
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={[styles.detailLabel, { marginTop: 10 }]}>Role</Text>
            <View style={styles.roleSelectRow}>
              {["customer", "owner", "admin"].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() =>
                    setUserEditForm((prev: any) => ({ ...prev, role: r }))
                  }
                  style={[
                    styles.roleSelectChip,
                    userEditForm.role === r && styles.roleSelectChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleSelectChipText,
                      userEditForm.role === r &&
                        styles.roleSelectChipTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                onPress={() => setEditingUser(null)}
                style={styles.confirmCancelBtn}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveUserEdit}
                disabled={savingUser}
                style={[
                  styles.confirmActionBtn,
                  { backgroundColor: "#7C8B6D" },
                ]}
              >
                {savingUser ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmActionText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal state={confirmState} onCancel={dismissConfirm} />
      <Toast state={toast} />
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
  onPress,
  onApprove,
  onDecline,
}: {
  restaurant: any;
  processing: boolean;
  onPress?: () => void;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.appCard}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
    >
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
    </TouchableOpacity>
  );
}

// ── Restaurant management card (approved restaurants tab) ────────────────────

function RestaurantManageCard({
  restaurant,
  onPress,
  onToggleHide,
  onDelete,
}: {
  restaurant: any;
  onPress: () => void;
  onToggleHide: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.manageCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
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
        {restaurant.is_hidden ? (
          <View style={styles.hiddenChip}>
            <EyeOff size={10} color="#6B7280" />
            <Text style={styles.hiddenChipText}>Hidden</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.appInfoRow}>
        <MapPin size={12} color="#9CA3AF" />
        <Text style={styles.appInfoText} numberOfLines={1}>
          {restaurant.location || "No location"}
        </Text>
      </View>

      <View style={styles.appMetaRow}>
        <View style={styles.appMetaItem}>
          <Text style={styles.appMetaLabel}>Reservations</Text>
          <Text style={styles.appMetaValue}>
            {restaurant.reservation_count ?? 0}
          </Text>
        </View>
        <View style={styles.appMetaItem}>
          <Text style={styles.appMetaLabel}>Owner</Text>
          <Text style={styles.appMetaValue} numberOfLines={1}>
            {restaurant.owner_name} {restaurant.owner_surname}
          </Text>
        </View>
        <View style={styles.appMetaItem}>
          <Text style={styles.appMetaLabel}>Status</Text>
          <Text
            style={[
              styles.appMetaValue,
              { color: restaurant.is_hidden ? "#9CA3AF" : "#10B981" },
            ]}
          >
            {restaurant.is_hidden ? "Hidden" : "Live"}
          </Text>
        </View>
      </View>

      <View style={styles.appActions}>
        <TouchableOpacity
          onPress={(e: any) => {
            e?.stopPropagation?.();
            onToggleHide();
          }}
          style={styles.manageSecondaryBtn}
        >
          {restaurant.is_hidden ? (
            <Eye size={15} color="#6B7280" />
          ) : (
            <EyeOff size={15} color="#6B7280" />
          )}
          <Text style={styles.manageSecondaryBtnText}>
            {restaurant.is_hidden ? "Unhide" : "Hide"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(e: any) => {
            e?.stopPropagation?.();
            onPress();
          }}
          style={[styles.manageSecondaryBtn, { flex: 1 }]}
        >
          <Edit size={15} color="#6B7280" />
          <Text style={styles.manageSecondaryBtnText}>Manage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(e: any) => {
            e?.stopPropagation?.();
            onDelete();
          }}
          style={styles.manageDeleteBtn}
        >
          <Trash2 size={15} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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

  // ── Toast ──────────────────────────────────────────────────────────────────
  toastWrap: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  toastText: { fontSize: 13, fontWeight: "700", flexShrink: 1 },

  // ── Confirm modal ────────────────────────────────────────────────────────────
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  confirmIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#2D2D2D",
    textAlign: "center",
    marginBottom: 6,
  },
  confirmMessage: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    width: "100%",
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  confirmCancelText: { fontSize: 13, fontWeight: "800", color: "#6B7280" },
  confirmActionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
  },
  confirmActionText: { fontSize: 13, fontWeight: "800", color: "white" },

  // ── Generic form card (used by add-reservation / edit-user modals) ──────────
  formCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 22,
    width: "100%",
    maxWidth: 420,
  },
  formInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: "#2D2D2D",
    marginTop: 4,
  },
  roleSelectRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  roleSelectChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  roleSelectChipActive: { backgroundColor: "#2D2D2D" },
  roleSelectChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  roleSelectChipTextActive: { color: "white" },

  // ── Restaurant management card ────────────────────────────────────────────
  manageCard: {
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
  hiddenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  hiddenChipText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  manageSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  manageSecondaryBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  manageDeleteBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Detail modal sections (application + restaurant manage) ────────────────
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  detailLogo: {
    width: 60,
    height: 60,
    borderRadius: 18,
    resizeMode: "contain",
    backgroundColor: "#F5EEE7",
  },
  detailName: { fontSize: 19, fontWeight: "900", color: "#2D2D2D" },
  detailSection: {
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  galleryThumb: {
    width: 100,
    height: 100,
    borderRadius: 14,
    backgroundColor: "#F5EEE7",
  },

  // ── Reservations list (inside restaurant manage modal) ──────────────────────
  reservationsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  addReservationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#7C8B6D",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addReservationBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "white",
    textTransform: "uppercase",
  },
  reservationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  reservationDateBox: {
    alignItems: "center",
    width: 56,
  },
  reservationDateText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2D2D2D",
    marginTop: 2,
  },
  reservationTimeText: { fontSize: 9, color: "#9CA3AF" },
  reservationName: { fontSize: 13, fontWeight: "800", color: "#2D2D2D" },
  reservationMeta: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  reservationStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reservationStatusText: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
