import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import {
  Check,
  X,
  Clock,
  Calendar,
  Users,
  History,
  Bell,
  ChefHat,
  Phone,
} from "lucide-react-native";
import { format } from "date-fns";
import { useLanguage } from "../../lib/LanguageContext";
import { theme } from "../../theme";
import { getApiUrl } from "../../lib/api";

function getReservationDateTime(reservation: any) {
  const datePart = format(new Date(reservation.date), "yyyy-MM-dd");
  return new Date(`${datePart}T${reservation.time}`);
}

function isReservationTimeReached(reservation: any) {
  return new Date() >= getReservationDateTime(reservation);
}

export default function OwnerReservations() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"incoming" | "history">(
    "incoming",
  );
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const TAB_BAR_HEIGHT = 60; // adjust to match your actual tab bar height

  const fetchReservations = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/owner/reservations"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setReservations(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      setLoading(true);
      fetchReservations();
      const interval = setInterval(fetchReservations, 10000);
      return () => clearInterval(interval);
    }
  }, [user, token, fetchReservations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReservations();
  };

  const handleAction = async (
    id: number,
    action: "confirm" | "reject" | "complete" | "no-show",
  ) => {
    const res = await fetch(getApiUrl(`/api/reservations/${id}/${action}`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchReservations();
  };

  const incoming = reservations.filter(
    (r) => r.status === "pending" || r.status === "confirmed",
  );
  const history = reservations.filter(
    (r) =>
      r.status === "completed" ||
      r.status === "rejected" ||
      r.status === "no-show",
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.brand}>RESERVA</Text>
          <Text style={styles.title}>{t("owner_reservations.title")}</Text>
        </View>
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => setActiveTab("incoming")}
            style={[styles.tab, activeTab === "incoming" && styles.activeTab]}
          >
            <View style={styles.row}>
              <Bell
                size={14}
                color={
                  activeTab === "incoming" ? "white" : theme.colors.textDim
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "incoming" && styles.activeTabText,
                ]}
              >
                {t("owner_reservations.incoming")}
              </Text>
              {incoming.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{incoming.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("history")}
            style={[styles.tab, activeTab === "history" && styles.activeTab]}
          >
            <View style={styles.row}>
              <History
                size={14}
                color={activeTab === "history" ? "white" : theme.colors.textDim}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "history" && styles.activeTabText,
                ]}
              >
                {t("owner_reservations.history")}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.grid}>
          {loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={theme.colors.oliveMuted} />
              <Text style={styles.syncText}>
                {t("owner_reservations.syncing")}
              </Text>
            </View>
          ) : (activeTab === "incoming" ? incoming : history).length === 0 ? (
            <View style={styles.emptyContainer}>
              <ChefHat size={48} color="rgba(0,0,0,0.1)" />
              <Text style={styles.noRecordsText}>
                {t("owner_reservations.no_records")} in {activeTab}
              </Text>
            </View>
          ) : (
            (activeTab === "incoming" ? incoming : history).map((res) => (
              <ReservationItem
                key={res.id}
                reservation={res}
                showActions={activeTab === "incoming"}
                onAction={handleAction}
                t={t}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ReservationItem({ reservation, onAction, t }: any) {
  const isConfirmed = reservation.status === "confirmed";
  const isPending = reservation.status === "pending";
  const resStatus = reservation.status;
  const timeReached = isConfirmed
    ? isReservationTimeReached(reservation)
    : false;

  const getStatusColor = () => {
    switch (resStatus) {
      case "confirmed":
        return "#10b981";
      case "rejected":
        return theme.colors.red;
      case "completed":
        return theme.colors.oliveMuted;
      case "no-show":
        return "#7f1d1d";
      default:
        return theme.colors.accentBlue;
    }
  };

  return (
    <View
      style={[
        styles.card,
        isConfirmed && styles.confirmedCard,
        resStatus === "rejected" && styles.rejectedCard,
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[styles.iconBox, { backgroundColor: getStatusColor() + "10" }]}
        >
          <Users size={24} color={getStatusColor()} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.customerName} numberOfLines={1}>
              {reservation.customer_name} {reservation.customer_surname}
            </Text>
            {!isPending && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: getStatusColor() + "15",
                    borderColor: getStatusColor() + "30",
                  },
                ]}
              >
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {reservation.status}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.guestCount}>
            {reservation.people_count}{" "}
            {reservation.people_count === 1
              ? t("owner_reservations.guest")
              : t("owner_reservations.guests")}
          </Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Calendar size={14} color={theme.colors.textDim} />
          <Text style={styles.detailText}>
            {format(new Date(reservation.date), "EEE, MMM d")}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Clock size={14} color={theme.colors.textDim} />
          <Text style={styles.detailText}>{reservation.time}</Text>
        </View>
      </View>

      {reservation.customer_phone ? (
        <View style={styles.detailItem}>
          <Phone size={14} color={theme.colors.textDim} />
          <Text style={styles.detailText}>{reservation.customer_phone}</Text>
        </View>
      ) : null}

      {isPending && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => onAction(reservation.id, "reject")}
            style={styles.declineButton}
          >
            <X size={16} color={theme.colors.red} />
            <Text style={styles.declineText}>
              {t("owner_reservations.decline")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAction(reservation.id, "confirm")}
            style={styles.approveButton}
          >
            <Check size={16} color="white" />
            <Text style={styles.approveText}>
              {t("owner_reservations.approve")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isConfirmed && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => timeReached && onAction(reservation.id, "no-show")}
            style={[styles.noShowButton, !timeReached && styles.disabledButton]}
            disabled={!timeReached}
          >
            <Text
              style={[styles.noShowText, !timeReached && styles.disabledText]}
            >
              {t("owner_reservations.no_show")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => timeReached && onAction(reservation.id, "complete")}
            style={[
              styles.completeButton,
              !timeReached && styles.disabledButton,
            ]}
            disabled={!timeReached}
          >
            <Text
              style={[styles.completeText, !timeReached && styles.disabledText]}
            >
              {t("owner_reservations.mark_completed")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {isConfirmed && !timeReached && (
        <Text style={styles.pendingTimeText}>
          {t("owner_reservations.available_at")} {reservation.time}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgBase,
  },
  header: {
    padding: 24,
    backgroundColor: "white",
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  brand: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.oliveAccent,
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 42,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
    letterSpacing: -1,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.03)",
    padding: 4,
    borderRadius: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: theme.colors.charcoal,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tabText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.textDim,
    textTransform: "uppercase",
  },
  activeTabText: {
    color: "white",
  },
  badge: {
    backgroundColor: theme.colors.red,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 8,
    fontWeight: "bold",
  },
  scrollContent: {
    padding: 20,
  },
  grid: {
    gap: 16,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 32,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.05)",
  },
  syncText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.textDim,
    textTransform: "uppercase",
    marginTop: 12,
  },
  noRecordsText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.textDim,
    textTransform: "uppercase",
    marginTop: 16,
    opacity: 0.5,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  confirmedCard: {
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  rejectedCard: {
    borderColor: "rgba(239, 68, 68, 0.1)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerName: {
    fontSize: 18,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  guestCount: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.textDim,
    textTransform: "uppercase",
    marginTop: 2,
  },
  detailsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  detailItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.03)",
    padding: 12,
    borderRadius: 16,
  },
  detailText: {
    fontSize: 11,
    fontWeight: "bold",
    color: theme.colors.charcoal,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  declineButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: "#fff1f2",
  },
  declineText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.red,
    textTransform: "uppercase",
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: "#10b981",
  },
  approveText: {
    fontSize: 10,
    fontWeight: "900",
    color: "white",
    textTransform: "uppercase",
  },
  noShowButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "#fff1f2",
  },
  noShowText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.red,
    textTransform: "uppercase",
  },
  completeButton: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: theme.colors.oliveMuted,
  },
  completeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "white",
    textTransform: "uppercase",
  },
  disabledButton: {
    opacity: 0.4,
  },
  disabledText: {
    opacity: 0.6,
  },
  pendingTimeText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textDim,
    textAlign: "center",
    marginTop: 10,
    textTransform: "uppercase",
  },
});
