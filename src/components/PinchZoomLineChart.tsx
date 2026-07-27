import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { PinchGestureHandler, State } from "react-native-gesture-handler";
import Svg, {
  Path,
  Circle as SvgCircle,
  Line as SvgLine,
} from "react-native-svg";
import { format, subDays, subMonths, startOfMonth, startOfDay } from "date-fns";

type Review = { rating: number; created_at: string };
type Granularity = "daily" | "monthly";
type Point = { label: string; fullLabel: string; value: number | null };

const CHART_WIDTH = 300;
const CHART_HEIGHT = 140;

function buildDailySeries(reviews: Review[], days = 30): Point[] {
  const points: Point[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(subDays(new Date(), i));
    const dayReviews = reviews.filter(
      (r) => startOfDay(new Date(r.created_at)).getTime() === day.getTime(),
    );
    const avg = dayReviews.length
      ? dayReviews.reduce((a, r) => a + r.rating, 0) / dayReviews.length
      : null; // null = no reviews that day -> gap in the line, not a fake 0
    points.push({
      label: format(day, "d"),
      fullLabel: format(day, "MMM d"),
      value: avg,
    });
  }
  return points;
}

function buildMonthlySeries(reviews: Review[], months = 6): Point[] {
  const points: Point[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = startOfMonth(subMonths(new Date(), i));
    const monthReviews = reviews.filter((r) => {
      const d = new Date(r.created_at);
      return (
        d.getMonth() === month.getMonth() &&
        d.getFullYear() === month.getFullYear()
      );
    });
    const avg = monthReviews.length
      ? monthReviews.reduce((a, r) => a + r.rating, 0) / monthReviews.length
      : null;
    points.push({
      label: format(month, "MMM"),
      fullLabel: format(month, "MMM yyyy"),
      value: avg,
    });
  }
  return points;
}

function buildPath(points: Point[], width: number, height: number) {
  const stepX = width / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: p.value === null ? null : height - (p.value / 5) * height, // ratings are 0-5
    value: p.value,
  }));

  let path = "";
  let started = false;
  coords.forEach((c) => {
    if (c.y === null) {
      started = false; // breaks the line so no-data stretches show as a gap, not a drop to 0
      return;
    }
    path += started ? ` L ${c.x} ${c.y}` : `M ${c.x} ${c.y}`;
    started = true;
  });

  return { path, coords };
}

export default function PinchZoomLineChart({ reviews }: { reviews: Review[] }) {
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const gestureScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);

  const dailyPoints = useMemo(() => buildDailySeries(reviews), [reviews]);
  const monthlyPoints = useMemo(() => buildMonthlySeries(reviews), [reviews]);
  const points = granularity === "daily" ? dailyPoints : monthlyPoints;
  const { path, coords } = useMemo(
    () => buildPath(points, CHART_WIDTH, CHART_HEIGHT),
    [points],
  );

  const switchGranularity = (next: Granularity) => {
    if (next === granularity) return;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setGranularity(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: gestureScale } }],
    { useNativeDriver: true },
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const finalScale = event.nativeEvent.scale * lastScale.current;

      // spread fingers apart (zoom in) on the monthly view -> drill into days
      if (finalScale > 1.3 && granularity === "monthly") {
        switchGranularity("daily");
      }
      // pinch fingers together (zoom out) on the daily view -> pull back to months
      else if (finalScale < 0.75 && granularity === "daily") {
        switchGranularity("monthly");
      }

      gestureScale.setValue(1);
      lastScale.current = 1;
    }
  };

  return (
    <PinchGestureHandler
      onGestureEvent={onPinchGestureEvent}
      onHandlerStateChange={onPinchStateChange}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={styles.header}>
          <Text style={styles.rangeLabel}>
            {granularity === "daily" ? "Last 30 days" : "Last 6 months"}
          </Text>
          <Text style={styles.hint}>Pinch to zoom</Text>
        </View>

        <Svg
          width="100%"
          height={CHART_HEIGHT + 24}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 24}`}
        >
          {[0, 1, 2, 3, 4].map((g) => (
            <SvgLine
              key={g}
              x1={0}
              x2={CHART_WIDTH}
              y1={(g / 4) * CHART_HEIGHT}
              y2={(g / 4) * CHART_HEIGHT}
              stroke="#f1f1f1"
              strokeWidth={1}
            />
          ))}

          {path !== "" && (
            <Path
              d={path}
              stroke="#6b7c4f"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {coords.map((c, i) =>
            c.y !== null ? (
              <SvgCircle key={i} cx={c.x} cy={c.y} r={3} fill="#6b7c4f" />
            ) : null,
          )}
        </Svg>

        <View style={styles.labelsRow}>
          {points
            .filter((_, i) => i % Math.ceil(points.length / 6) === 0)
            .map((p, i) => (
              <Text key={i} style={styles.axisLabel}>
                {p.label}
              </Text>
            ))}
        </View>
      </Animated.View>
    </PinchGestureHandler>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  rangeLabel: { fontSize: 10, fontWeight: "900", color: "#999" },
  hint: { fontSize: 9, color: "#bbb", fontStyle: "italic" },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  axisLabel: { fontSize: 9, color: "#999" },
});
