import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  User,
  Plus,
  Minus,
  Clock,
  Calendar,
  CheckCircle2,
  Users,
  Diamond,
  Layout,
  Circle,
  Square,
  RectangleHorizontal,
  ArrowRight,
} from "lucide-react-native";
import { format, addDays, startOfToday } from "date-fns";
import { useLanguage } from "../lib/LanguageContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "../lib/api";

const { width } = Dimensions.get("window");

function getResourceTypeLabel(
  resourceType: string,
  t: (key: string) => string,
): string {
  switch (resourceType) {
    case "room":
      return t("owner_dashboard.resource_type_room");
    case "booth":
      return t("owner_dashboard.resource_type_booth");
    case "station":
      return t("owner_dashboard.resource_type_station");
    case "zone":
      return t("owner_dashboard.resource_type_zone");
    default:
      return resourceType;
  }
}

export default function ReservationPage() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { id } = route.params as { id: string };
  const { t } = useLanguage();
  const [restaurant, setRestaurant] = useState<any>(null);

  const [selectedDate, setSelectedDate] = useState<string>(
    format(startOfToday(), "yyyy-MM-dd"),
  );
  const [peopleCount, setPeopleCount] = useState(2);

  // NEW: start + end time instead of single selectedTime
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  const [seatingPreference, setSeatingPreference] = useState<string | null>(
    null,
  );

  // Resource selection (replaces table type)
  const [resourceTypes, setResourceTypes] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [showResourceSelector, setShowResourceSelector] = useState(false);

  // Blocked ranges for selected resource on selected date
  const [blockedRanges, setBlockedRanges] = useState<
    { start_time: string; end_time: string }[]
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showWaitlistOption, setShowWaitlistOption] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [isWaitlistSuccess, setIsWaitlistSuccess] = useState(false);
  const [waitlistTime, setWaitlistTime] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resRes = await fetch(getApiUrl(`/api/restaurants/${id}`));
        const restaurantData = await resRes.json();
        setRestaurant(restaurantData);

        const token = await AsyncStorage.getItem("reserva_token");

        // Try new resource-types endpoint; fall back to table-types
        let rtData: any[] = [];
        try {
          const rtRes = await fetch(
            getApiUrl(`/api/restaurants/${id}/resource-types`),
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (rtRes.ok) {
            rtData = await rtRes.json();
          } else {
            throw new Error("resource-types not found");
          }
        } catch {
          const ttRes = await fetch(
            getApiUrl(`/api/restaurants/${id}/table-types`),
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (ttRes.ok) {
            const ttData = await ttRes.json();
            rtData = ttData.map((t: any) => ({ ...t, resource_type: "table" }));
          }
        }
        setResourceTypes(rtData);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [id]);

  // Fetch blocked ranges when resource + date changes
  useEffect(() => {
    if (!selectedResource?.id || !selectedDate) {
      setBlockedRanges([]);
      return;
    }
    const fetchAvailability = async () => {
      try {
        const token = await AsyncStorage.getItem("reserva_token");
        const res = await fetch(
          getApiUrl(
            `/api/resources/${selectedResource.id}/availability?date=${selectedDate}`,
          ),
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setBlockedRanges(data.blocked || []);
        } else {
          // availability endpoint not yet live — no blocked ranges
          setBlockedRanges([]);
        }
      } catch {
        setBlockedRanges([]);
      }
    };
    fetchAvailability();
  }, [selectedResource, selectedDate]);

  // Reset end time when start time changes
  useEffect(() => {
    setEndTime(null);
  }, [startTime, selectedDate]);

  const dates = [...Array(8)].map((_, i) => addDays(startOfToday(), i));

  const getDaySchedule = () => {
    if (!restaurant || !restaurant.schedules) return null;
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    return restaurant.schedules.find((s: any) => s.day_of_week === dayOfWeek);
  };

  const schedule = getDaySchedule();
  const isOpen = schedule ? !schedule.is_closed : true;
  const openTime = schedule ? schedule.open_time : restaurant?.open_time;
  const closeTime = schedule ? schedule.close_time : restaurant?.close_time;

  // All start-time slots
  const startTimeSlots =
    restaurant && isOpen ? generateTimeSlots(openTime, closeTime) : [];

  // End-time slots: only slots after startTime, filtered against blocked ranges
  const endTimeSlots: string[] = startTime
    ? generateTimeSlots(openTime, closeTime)
        .filter((t) => t > startTime!)
        .filter((proposedEnd) => !isSlotBlocked(proposedEnd))
    : [];

  function isSlotBlocked(proposedEnd: string): boolean {
    if (!startTime) return false;
    return blockedRanges.some(
      (range) => startTime < range.end_time && proposedEnd > range.start_time,
    );
  }

  // Is a start-time slot itself already within a blocked window?
  function isStartSlotUnavailable(slot: string): boolean {
    return blockedRanges.some(
      (range) => slot >= range.start_time && slot < range.end_time,
    );
  }

  const handleBook = async () => {
    if (!startTime || !endTime) return;
    setIsSubmitting(true);

    const token = await AsyncStorage.getItem("reserva_token");
    try {
      const res = await fetch(getApiUrl("/api/reservations"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurant_id: Number(id),
          // NEW: resource_id + start_time + end_time
          resource_id: selectedResource?.id ?? null,
          people_count: Number(peopleCount),
          date: selectedDate,
          time: startTime, // kept for backward compat
          start_time: startTime,
          end_time: endTime,
          seating_preference: seatingPreference,
          // Legacy fallbacks
          table_capacity: selectedResource?.capacity ?? null,
          table_shape: selectedResource?.shape ?? null,
        }),
      });
      if (res.ok) {
        setIsSuccess(true);
      } else {
        const err = await res.json();
        if (res.status === 409 && err.allowWaitlist) {
          setWaitlistError(err.error);
          setShowWaitlistOption(true);
        } else {
          Alert.alert(
            t("reservation.error_title"),
            err.error || t("reservation.failed_to_book"),
          );
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert(
        t("reservation.error_title"),
        t("reservation.error_connecting_server"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinWaitlist = async () => {
    setIsSubmitting(true);
    const token = await AsyncStorage.getItem("reserva_token");
    try {
      const res = await fetch(getApiUrl("/api/waitlist"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          restaurant_id: Number(id),
          people_count: Number(peopleCount),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWaitlistTime(data.estimatedWait);
        setIsWaitlistSuccess(true);
        setShowWaitlistOption(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screens ───────────────────────────────────────────────────────

  if (isWaitlistSuccess) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.waitlistSuccessIcon}>
          <Clock size={48} color="#000" />
        </View>
        <View style={styles.stateInfo}>
          <Text style={styles.stateTitle}>{t("reservation.on_waitlist")}</Text>
          <Text style={styles.stateDescription}>
            {t("reservation.waitlist_description")}{" "}
            {t("dashboard.estimated_wait")}:{" "}
            <Text style={styles.boldText}>
              {waitlistTime} {t("reservation.mins_suffix")}
            </Text>
          </Text>
          <Text style={styles.stateSubinfo}>
            {t("reservation.notify_ready")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate("CustomerMain")}
          style={styles.stateButton}
        >
          <Text style={styles.stateButtonText}>
            {t("reservation.back_home")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isSuccess) {
    return (
      <View style={styles.stateContainer}>
        <View style={styles.successIcon}>
          <CheckCircle2 size={48} color="#10b981" />
        </View>
        <View style={styles.stateInfo}>
          <Text style={styles.stateTitle}>
            {t("reservation.reservation_sent")}
          </Text>
          <Text style={styles.stateDescription}>
            {t("reservation.please_wait_confirmation")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate("CustomerMain")}
          style={styles.successStateButton}
        >
          <Text style={styles.stateButtonText}>
            {t("reservation.back_home")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16 },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft size={24} color="#2D2D2D" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{t("reservation.title")}</Text>
            <Text style={styles.headerSubtitle}>
              {restaurant?.name || t("common.loading")}
            </Text>
          </View>
        </View>

        <View style={styles.contentLayout}>
          {/* Party Size */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users size={18} color="#7C8B6D" />
              <Text style={styles.sectionTitleText}>
                {t("reservation.party_size")}
              </Text>
            </View>
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                onPress={() => setPeopleCount(Math.max(1, peopleCount - 1))}
                style={styles.pickerButton}
              >
                <Minus size={24} color="#2D2D2D" />
              </TouchableOpacity>
              <View style={styles.pickerValue}>
                <Text style={styles.pickerNumberText}>{peopleCount}</Text>
                <Text style={styles.pickerLabelText}>
                  {peopleCount === 1
                    ? t("dashboard.person")
                    : t("dashboard.people")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPeopleCount(peopleCount + 1)}
                style={styles.pickerButton}
              >
                <Plus size={24} color="#2D2D2D" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Picker */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={18} color="#7C8B6D" />
              <Text style={styles.sectionTitleText}>
                {t("reservation.select_date")}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateScroll}
            >
              {dates.map((date, idx) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const isActive = selectedDate === dateStr;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setSelectedDate(dateStr);
                      setStartTime(null);
                      setEndTime(null);
                    }}
                    style={[
                      styles.dateButton,
                      isActive && styles.dateButtonActive,
                    ]}
                  >
                    <Text
                      style={[styles.dateMonth, isActive && styles.textWhite]}
                    >
                      {format(date, "MMM")}
                    </Text>
                    <Text
                      style={[styles.dateDay, isActive && styles.textWhite]}
                    >
                      {format(date, "dd")}
                    </Text>
                    <Text
                      style={[styles.dateWeekday, isActive && styles.textWhite]}
                    >
                      {format(date, "eee")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Start Time Picker */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock size={18} color="#7C8B6D" />
              <Text style={styles.sectionTitleText}>
                {startTime
                  ? `${t("reservation.from_label")} ${startTime}`
                  : t("reservation.pick_time")}
              </Text>
            </View>
            {!isOpen ? (
              <View style={styles.closedContainer}>
                <Text style={styles.closedText}>
                  {t("reservation.closed_today")}
                </Text>
              </View>
            ) : (
              <View style={styles.timeGrid}>
                {startTimeSlots.map((time, idx) => {
                  const isActive = startTime === time;
                  const unavailable = isStartSlotUnavailable(time);
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => !unavailable && setStartTime(time)}
                      disabled={unavailable}
                      style={[
                        styles.timeButton,
                        isActive && styles.timeButtonActive,
                        unavailable && styles.timeButtonUnavailable,
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeButtonText,
                          isActive && styles.textWhite,
                          unavailable && styles.timeButtonTextUnavailable,
                        ]}
                      >
                        {time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {startTimeSlots.length === 0 && isOpen && (
                  <Text style={styles.noSlotsText}>
                    {t("reservation.no_slots")}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* End Time Picker — shown only after start time is selected */}
          {startTime && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ArrowRight size={18} color="#7C8B6D" />
                <Text style={styles.sectionTitleText}>
                  {endTime
                    ? `${t("reservation.until_label")} ${endTime}`
                    : t("reservation.pick_end_time")}
                </Text>
              </View>
              {/* Duration preview */}
              {endTime && (
                <View style={styles.durationBadge}>
                  <Clock size={12} color="#7C8B6D" />
                  <Text style={styles.durationText}>
                    {durationLabel(startTime, endTime, t)}
                  </Text>
                </View>
              )}
              <View style={styles.timeGrid}>
                {endTimeSlots.length === 0 ? (
                  <View style={styles.closedContainer}>
                    <Text style={styles.closedText}>
                      {t("reservation.no_available_end_times")}
                    </Text>
                  </View>
                ) : (
                  endTimeSlots.map((time, idx) => {
                    const isActive = endTime === time;
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setEndTime(time)}
                        style={[
                          styles.timeButton,
                          isActive && styles.timeButtonActiveEnd,
                        ]}
                      >
                        <Text
                          style={[
                            styles.timeButtonText,
                            isActive && styles.textWhite,
                          ]}
                        >
                          {time}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* Resource / Seating Preference */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderLine}>
              <Layout size={18} color="#7C8B6D" />
              <Text style={styles.sectionTitleText}>
                {t("reservation.seating_preference")}
                <Text style={styles.optionalText}>
                  {" "}
                  ({t("reservation.optional")})
                </Text>
              </Text>
            </View>

            {resourceTypes.length > 0 ? (
              <View style={styles.tableConfigBox}>
                <View style={styles.tableConfigHeader}>
                  <View style={styles.tableConfigIconRow}>
                    <Layout size={14} color="#7C8B6D" />
                    <Text style={styles.tableConfigLabel}>
                      {selectedResource
                        ? `${
                            selectedResource.resource_type !== "table"
                              ? getResourceTypeLabel(
                                  selectedResource.resource_type,
                                  t,
                                )
                              : t("reservation.table_fallback")
                          } · ${selectedResource.capacity} ${t(
                            "reservation.seats_suffix",
                          )}`
                        : t("reservation.recommended_table")}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setShowResourceSelector(!showResourceSelector)
                    }
                  >
                    <Text style={styles.chooseTableLabel}>
                      {showResourceSelector
                        ? t("reservation.close")
                        : t("reservation.choose_table_type")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showResourceSelector && (
                  <View style={styles.tableSelectorContainer}>
                    <View style={styles.tableTypeGrid}>
                      {resourceTypes.map((rt, idx) => {
                        const ShapeIcon =
                          rt.shape === "round"
                            ? Circle
                            : rt.shape === "rectangular"
                              ? RectangleHorizontal
                              : Square;
                        const isSelected =
                          selectedResource?.capacity === rt.capacity &&
                          selectedResource?.shape === rt.shape &&
                          selectedResource?.resource_type === rt.resource_type;
                        return (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => {
                              if (isSelected) setSelectedResource(null);
                              else setSelectedResource(rt);
                            }}
                            style={[
                              styles.tableTypeButton,
                              isSelected && styles.tableTypeButtonActive,
                            ]}
                          >
                            <View
                              style={[
                                styles.shapeIconCircle,
                                isSelected && styles.whiteBg,
                              ]}
                            >
                              <ShapeIcon
                                size={20}
                                color={isSelected ? "#2D2D2D" : "#7C8B6D"}
                              />
                            </View>
                            <View style={styles.tableTypeInfo}>
                              <Text
                                style={[
                                  styles.seatsCountText,
                                  isSelected && styles.textWhite,
                                ]}
                              >
                                {rt.resource_type !== "table"
                                  ? getResourceTypeLabel(rt.resource_type, t)
                                  : `${t("reservation.seats")} ${rt.capacity}`}
                              </Text>
                              <Text
                                style={[
                                  styles.tableSubText,
                                  isSelected && styles.textWhiteSoft,
                                ]}
                              >
                                {rt.capacity} {t("reservation.seats_suffix")} ·{" "}
                                {rt.location === "indoor"
                                  ? t("owner_dashboard.indoor")
                                  : rt.location === "outdoor"
                                    ? t("owner_dashboard.outdoor")
                                    : rt.location}
                              </Text>
                              {rt.price_per_hour > 0 && (
                                <Text
                                  style={[
                                    styles.resourcePriceTag,
                                    isSelected && styles.textWhiteSoft,
                                  ]}
                                >
                                  ${rt.price_per_hour}
                                  {t("owner_dashboard.per_hour_suffix")}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={styles.manualSelectionNotice}>
                      {t("reservation.manual_selection_notice")}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.noTableConfigBox}>
                <Text style={styles.noTableConfigText}>
                  {t("reservation.no_resource_configs")}
                </Text>
              </View>
            )}

            <View style={styles.preferenceRow}>
              {["indoor", "outdoor"].map((loc) => (
                <TouchableOpacity
                  key={loc}
                  onPress={() =>
                    setSeatingPreference(seatingPreference === loc ? null : loc)
                  }
                  style={[
                    styles.preferenceButton,
                    seatingPreference === loc && styles.preferenceButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.preferenceButtonText,
                      seatingPreference === loc && styles.textWhite,
                    ]}
                  >
                    {loc === "indoor"
                      ? t("reservation.indoor_seating")
                      : t("reservation.outdoor_seating")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
      >
        {/* Summary strip */}
        {startTime && endTime && (
          <View style={styles.summaryStrip}>
            <Text style={styles.summaryText}>{startTime}</Text>
            <ArrowRight size={14} color="rgba(45,45,45,0.4)" />
            <Text style={styles.summaryText}>{endTime}</Text>
            <Text style={styles.summaryDot}>·</Text>
            <Text style={styles.summaryText}>
              {durationLabel(startTime, endTime, t)}
            </Text>
            <Text style={styles.summaryDot}>·</Text>
            <Text style={styles.summaryText}>
              {peopleCount}{" "}
              {peopleCount === 1
                ? t("dashboard.person")
                : t("dashboard.people")}
            </Text>
          </View>
        )}
        <TouchableOpacity
          onPress={handleBook}
          disabled={!startTime || !endTime || isSubmitting}
          style={[
            styles.bookButton,
            (!startTime || !endTime) && styles.bookButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.bookButtonContent}>
              <Text style={styles.bookButtonText}>
                {t("reservation.book_now")}
              </Text>
              <CheckCircle2 size={24} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {showWaitlistOption && (
        <View style={styles.waitlistModalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowWaitlistOption(false)}
            style={styles.waitlistModalBackdrop}
          />
          <View style={styles.waitlistModalContent}>
            <View style={styles.waitlistIconBox}>
              <Users size={32} color="#7C8B6D" />
            </View>
            <View style={styles.waitlistModalTextContainer}>
              <Text style={styles.waitlistModalTitle}>
                {t("reservation.availability_issue")}
              </Text>
              <Text style={styles.waitlistModalDesc}>
                {waitlistError || t("reservation.no_slots")}
              </Text>
            </View>
            <View style={styles.waitlistModalActions}>
              <TouchableOpacity
                onPress={() => {
                  if (waitlistError?.includes("Alternatives available")) {
                    setSeatingPreference(null);
                    setShowWaitlistOption(false);
                  } else {
                    handleJoinWaitlist();
                  }
                }}
                style={styles.waitlistConfirmButton}
              >
                <Text style={styles.waitlistConfirmButtonText}>
                  {waitlistError?.includes("Alternatives available")
                    ? t("reservation.check_alternatives")
                    : t("reservation.join_waitlist")}
                </Text>
              </TouchableOpacity>
              {!waitlistError?.includes("Alternatives available") && (
                <TouchableOpacity onPress={() => setShowWaitlistOption(false)}>
                  <Text style={styles.waitlistNevermindText}>
                    {t("reservation.nevermind")}
                  </Text>
                </TouchableOpacity>
              )}
              {waitlistError?.includes("Alternatives available") && (
                <TouchableOpacity onPress={handleJoinWaitlist}>
                  <Text style={styles.waitlistJoinButtonText}>
                    {t("reservation.join_waitlist")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateTimeSlots(openStr: string, closeStr: string) {
  if (!openStr || !closeStr) return [];
  const [openH, openM] = openStr.split(":").map(Number);
  const [closeH, closeM] = closeStr.split(":").map(Number);
  const openTotal = openH * 60 + openM;
  const closeTotal = closeH * 60 + closeM;
  const endTotal = closeTotal - 60; // last slot 1hr before closing

  const slots: string[] = [];
  let curr = openTotal;
  while (curr <= endTotal) {
    const h = Math.floor(curr / 60);
    const m = curr % 60;
    slots.push(
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
    );
    curr += 30;
  }
  return slots;
}

function durationLabel(
  start: string,
  end: string,
  t: (key: string) => string,
): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  const hourAbbrev = t("reservation.hour_abbrev");
  const minuteAbbrev = t("reservation.minute_abbrev");
  if (mins < 60) return `${mins}${minuteAbbrev}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0
    ? `${h}${hourAbbrev}`
    : `${h}${hourAbbrev} ${m}${minuteAbbrev}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFCFB" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 180 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 32,
  },
  backButton: {
    padding: 12,
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  headerTextContainer: { flex: 1 },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#7C8B6D",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  contentLayout: { gap: 40 },
  section: { gap: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
  },
  sectionHeaderLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  sectionTitleText: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.6)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  pickerContainer: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  pickerButton: {
    width: 48,
    height: 48,
    backgroundColor: "#F5EEE7",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerValue: { alignItems: "center" },
  pickerNumberText: {
    fontSize: 48,
    fontWeight: "900",
    color: "#2D2D2D",
    lineHeight: 56,
  },
  pickerLabelText: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  dateScroll: { gap: 12, paddingHorizontal: 8, paddingBottom: 8 },
  dateButton: {
    width: 80,
    height: 100,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dateButtonActive: { backgroundColor: "#7C8B6D", borderColor: "#7C8B6D" },
  dateMonth: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
  },
  dateDay: { fontSize: 24, fontWeight: "900", color: "#2D2D2D" },
  dateWeekday: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "capitalize",
  },
  textWhite: { color: "white" },
  textWhiteSoft: { color: "rgba(255,255,255,0.7)" },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 8,
  },
  timeButton: {
    width: (width - 64) / 4,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  timeButtonActive: { backgroundColor: "#7C8B6D", borderColor: "#7C8B6D" },
  timeButtonActiveEnd: { backgroundColor: "#2D2D2D", borderColor: "#2D2D2D" },
  timeButtonUnavailable: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderColor: "rgba(0,0,0,0.05)",
    opacity: 0.4,
  },
  timeButtonText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "rgba(45, 45, 45, 0.6)",
  },
  timeButtonTextUnavailable: {
    color: "rgba(45,45,45,0.3)",
    textDecorationLine: "line-through",
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(124,139,109,0.08)",
    borderRadius: 12,
    alignSelf: "flex-start",
    marginHorizontal: 8,
  },
  durationText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#7C8B6D",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  closedContainer: {
    padding: 24,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
  },
  closedText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ef4444",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  noSlotsText: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    color: "rgba(45, 45, 45, 0.4)",
    paddingVertical: 16,
  },
  optionalText: { fontWeight: "normal", opacity: 0.4, fontStyle: "italic" },
  tableConfigBox: {
    marginHorizontal: 8,
    padding: 16,
    backgroundColor: "rgba(124, 139, 109, 0.05)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(124, 139, 109, 0.1)",
  },
  tableConfigHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tableConfigIconRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tableConfigLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.6)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chooseTableLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#7C8B6D",
    textTransform: "uppercase",
    textDecorationLine: "underline",
  },
  tableSelectorContainer: { marginTop: 16, gap: 16 },
  tableTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tableTypeButton: {
    width: (width - 80) / 2,
    padding: 16,
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    gap: 12,
  },
  tableTypeButtonActive: { backgroundColor: "#2D2D2D", borderColor: "#2D2D2D" },
  shapeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(45, 45, 45, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  whiteBg: { backgroundColor: "rgba(255,255,255,0.1)" },
  tableTypeInfo: { alignItems: "center" },
  seatsCountText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
  },
  tableSubText: {
    fontSize: 8,
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "capitalize",
  },
  resourcePriceTag: {
    fontSize: 8,
    fontWeight: "900",
    color: "#7C8B6D",
    marginTop: 2,
  },
  manualSelectionNotice: {
    fontSize: 8,
    color: "rgba(45, 45, 45, 0.4)",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  noTableConfigBox: {
    marginHorizontal: 8,
    padding: 12,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.1)",
  },
  noTableConfigText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#ef4444",
    textTransform: "uppercase",
    textAlign: "center",
  },
  preferenceRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 8,
    marginTop: 12,
  },
  preferenceButton: {
    flex: 1,
    height: 48,
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  preferenceButtonActive: {
    backgroundColor: "#2D2D2D",
    borderColor: "#2D2D2D",
  },
  preferenceButtonText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "rgba(45, 45, 45, 0.6)",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    gap: 12,
  },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 4,
  },
  summaryText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryDot: { color: "rgba(45,45,45,0.3)", fontSize: 14 },
  bookButton: {
    height: 60,
    backgroundColor: "#7C8B6D",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C8B6D",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  bookButtonDisabled: {
    backgroundColor: "rgba(0,0,0,0.05)",
    shadowOpacity: 0,
    elevation: 0,
  },
  bookButtonContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  bookButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: "#FDFCFB",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  waitlistSuccessIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
    marginBottom: 24,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    marginBottom: 24,
  },
  stateInfo: { alignItems: "center", gap: 8, marginBottom: 32 },
  stateTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    textAlign: "center",
  },
  stateDescription: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(45, 45, 45, 0.6)",
    textAlign: "center",
    maxWidth: 240,
  },
  stateSubinfo: {
    fontSize: 10,
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginTop: 16,
  },
  boldText: { fontWeight: "900", color: "#2D2D2D" },
  stateButton: {
    width: "100%",
    height: 56,
    backgroundColor: "#2D2D2D",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  successStateButton: {
    width: "100%",
    height: 56,
    backgroundColor: "#7C8B6D",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stateButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  waitlistModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  waitlistModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(45, 45, 45, 0.6)",
  },
  waitlistModalContent: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 40,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
  },
  waitlistIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(124, 139, 109, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  waitlistModalTextContainer: {
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  waitlistModalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    textAlign: "center",
  },
  waitlistModalDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(45, 45, 45, 0.6)",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  waitlistModalActions: { width: "100%", gap: 12, alignItems: "center" },
  waitlistConfirmButton: {
    width: "100%",
    height: 56,
    backgroundColor: "#3b82f6",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  waitlistConfirmButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  waitlistNevermindText: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 2,
    paddingVertical: 12,
  },
  waitlistJoinButtonText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#3b82f6",
    textTransform: "uppercase",
    letterSpacing: 2,
    paddingVertical: 12,
  },
});
