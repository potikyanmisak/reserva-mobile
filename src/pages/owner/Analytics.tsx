import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Svg,
  Path,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Circle as SvgCircle,
} from "react-native-svg";
import { useAuth } from "../../lib/AuthContext";
import {
  TrendingUp,
  Users,
  Star,
  ThumbsUp,
  AlertCircle,
} from "lucide-react-native";
import { format, subMonths, startOfMonth } from "date-fns";
import { useLanguage } from "../../lib/LanguageContext";
import { theme } from "../../theme";
import { getApiUrl } from "../../lib/api";

const { width } = Dimensions.get("window");

const CATEGORY_COLORS: Record<string, string> = {
  "Food Quality": "#00A3FF",
  Service: "#2ecc71",
  "Waiting Time": "#e74c3c",
  Cleanliness: "#f1c40f",
  Atmosphere: "#9b59b6",
  Others: "#95a5a6",
};

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
    case "Others":
      return t("owner_analytics.category_others");
    default:
      return name;
  }
}

export default function OwnerAnalytics() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const TAB_BAR_HEIGHT = 60; // adjust to match your actual tab bar height

  useEffect(() => {
    fetch(getApiUrl("/api/owner/analytics"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setReviews(data.reviews || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [user]);

  const lineData = [2, 1, 0].map((m) => {
    const monthStart = startOfMonth(subMonths(new Date(), m));
    const monthName = format(monthStart, "MMM");
    const monthReviews = reviews.filter((r) => {
      const d = new Date(r.created_at);
      return (
        d.getMonth() === monthStart.getMonth() &&
        d.getFullYear() === monthStart.getFullYear()
      );
    });
    const avg = monthReviews.length
      ? monthReviews.reduce((acc, r) => acc + r.rating, 0) / monthReviews.length
      : 0;
    return { name: monthName, rating: parseFloat(avg.toFixed(1)) };
  });

  const categoryCounts: Record<string, number> = {};
  reviews.forEach((r) => {
    if (r.categories) {
      try {
        const cats =
          typeof r.categories === "string"
            ? JSON.parse(r.categories)
            : r.categories;
        if (Array.isArray(cats)) {
          cats.forEach((c) => {
            categoryCounts[c] = (categoryCounts[c] || 0) + 1;
          });
        }
      } catch (e) {}
    }
  });

  const totalIssuePoints = Object.values(categoryCounts).reduce(
    (a, b) => a + b,
    0,
  );
  const pieData = Object.entries(categoryCounts)
    .map(([name, count]) => ({
      name,
      value: Math.round((count / (totalIssuePoints || 1)) * 100),
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS["Others"],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const avgRating = reviews.length
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(
        1,
      )
    : "0";

  if (loading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.oliveMuted} />
      </View>
    );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {t("owner_analytics.dashboard_label")}
        </Text>
        <Text style={styles.title}>{t("owner_analytics.title")}</Text>
      </View>

      <View style={styles.heroStats}>
        <View style={styles.statCard}>
          <View style={styles.statTop}>
            <View style={styles.statIconBox}>
              <Star size={18} color="#eab308" fill="#eab308" />
            </View>
            <Text style={styles.trendUp}>+0.3</Text>
          </View>
          <Text style={styles.statValue}>{avgRating}</Text>
          <Text style={styles.statLabel}>
            {t("owner_analytics.avg_reputation")}
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statTop}>
            <View style={styles.statIconBox}>
              <ThumbsUp size={18} color={theme.colors.textDim} />
            </View>
            <Text style={styles.trendUp}>+12%</Text>
          </View>
          <Text style={styles.statValue}>{reviews.length}</Text>
          <Text style={styles.statLabel}>
            {t("owner_analytics.total_reviews")}
          </Text>
        </View>
      </View>

      <View style={styles.chartSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t("owner_analytics.reputation_90d")}
          </Text>
          <TrendingUp size={16} color={theme.colors.textDim} />
        </View>
        <View style={styles.lineChartPlaceholder}>
          <Text style={styles.chartLegend}>
            {t("owner_analytics.trending_quarter")}
          </Text>
          <View style={styles.miniBars}>
            {lineData.map((d, i) => (
              <View key={i} style={styles.barItem}>
                <View
                  style={[styles.barValue, { height: (d.rating / 5) * 60 }]}
                />
                <Text style={styles.barLabel}>{d.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.chartSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.row}>
            <AlertCircle size={18} color={theme.colors.red} />
            <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>
              {t("owner_analytics.issues_breakdown")}
            </Text>
          </View>
        </View>
        <View style={styles.distributionRow}>
          <View style={styles.piePlaceholder}>
            <Svg width="100" height="100" viewBox="0 0 100 100">
              <SvgCircle
                cx="50"
                cy="50"
                r="40"
                stroke="#f1f1f1"
                strokeWidth="10"
                fill="none"
              />
              <SvgCircle
                cx="50"
                cy="50"
                r="40"
                stroke={theme.colors.oliveMuted}
                strokeWidth="10"
                fill="none"
                strokeDasharray={`${251 * 0.7} 251`}
                strokeDashoffset="0"
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <View style={styles.legendColumn}>
            {pieData.map((item, idx) => (
              <View key={idx} style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: item.color }]}
                />
                <Text style={styles.legendText}>
                  {getCategoryLabel(item.name, t)}
                </Text>
                <Text style={styles.legendVal}>{item.value}%</Text>
              </View>
            ))}
            {pieData.length === 0 && (
              <Text style={styles.noDataText}>
                {t("owner_analytics.no_issues_detected")}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.feedbackSection}>
        <Text style={styles.sectionTitle}>
          {t("owner_analytics.detailed_feedback")}
        </Text>
        <View style={styles.feedbackList}>
          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.customerName}>{review.customer_name}</Text>
                <View style={styles.ratingBadge}>
                  <Star size={10} color="#eab308" fill="#eab308" />
                  <Text style={styles.ratingNumber}>{review.rating}</Text>
                </View>
              </View>
              <Text style={styles.comment}>"{review.comment}"</Text>

              <View style={styles.reviewFooter}>
                <Text style={styles.dateText}>
                  {format(new Date(review.created_at), "MMM dd, yyyy")}
                </Text>
                <Text
                  style={[
                    styles.sentimentText,
                    {
                      color: review.rating >= 4 ? "#10b981" : theme.colors.red,
                    },
                  ]}
                >
                  {review.rating >= 4
                    ? t("owner_analytics.positive")
                    : t("owner_analytics.negative")}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgBase,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.textDim,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 32,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
    marginTop: 4,
  },
  heroStats: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  statTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statIconBox: {
    width: 32,
    height: 32,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trendUp: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#10b981",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.charcoal,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: theme.colors.textDim,
    textTransform: "uppercase",
    marginTop: 4,
  },
  chartSection: {
    backgroundColor: "white",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.oliveAccent,
    textTransform: "uppercase",
    letterSpacing: 4,
  },
  lineChartPlaceholder: {
    alignItems: "center",
  },
  chartLegend: {
    fontSize: 10,
    color: theme.colors.textDim,
    marginBottom: 20,
  },
  miniBars: {
    flexDirection: "row",
    gap: 32,
    alignItems: "flex-end",
    height: 80,
  },
  barItem: {
    alignItems: "center",
    gap: 8,
  },
  barValue: {
    width: 24,
    backgroundColor: theme.colors.oliveMuted,
    borderRadius: 12,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.textDim,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  piePlaceholder: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  legendColumn: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    flex: 1,
    fontSize: 10,
    fontWeight: "bold",
    color: theme.colors.textDim,
  },
  legendVal: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.charcoal,
  },
  noDataText: {
    fontSize: 10,
    color: theme.colors.textDim,
    fontStyle: "italic",
  },
  feedbackSection: {
    marginTop: 12,
    gap: 16,
  },
  feedbackList: {
    gap: 16,
  },
  reviewCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(234, 179, 8, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingNumber: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.charcoal,
  },
  comment: {
    fontSize: 13,
    color: theme.colors.textDim,
    lineHeight: 18,
    fontStyle: "italic",
  },
  reviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  dateText: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(0,0,0,0.2)",
    textTransform: "uppercase",
  },
  sentimentText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
