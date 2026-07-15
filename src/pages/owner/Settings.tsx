import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Platform,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/AuthContext";
import {
  ChevronLeft,
  Clock,
  Calendar,
  Bell,
  Globe,
  Check,
  AlertCircle,
  Save,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useLanguage } from "../../lib/LanguageContext";
import LanguageSelector from "../../components/LanguageSelector";
import { theme } from "../../theme";
import { getApiUrl } from "../../lib/api";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ---- time helpers ----
function timeStringToDate(timeStr: string): Date {
  const [h, m] = (timeStr || "09:00").split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDisplayTime(timeStr: string): string {
  const d = timeStringToDate(timeStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function OwnerSettings() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const TAB_BAR_HEIGHT = 60;

  // which day/field is currently being edited via the picker
  const [activePicker, setActivePicker] = useState<{
    dayIndex: number;
    field: "open_time" | "close_time";
  } | null>(null);
  // iOS uses a modal + spinner; Android shows its own dialog
  const [iosPickerValue, setIosPickerValue] = useState<Date>(new Date());

  const [settings, setSettings] = useState<any>({
    name: "",
    description: "",
    phone_number: "",
    max_reservation_duration: 90,
    advance_booking_days: 30,
    min_booking_notice_hours: 1,
    notify_new_reservation: 1,
    notify_cancellations: 1,
    notify_waitlist: 1,
    deposit_amount: 0,
    cancellation_policy_hours: 24,
    min_price: 0,
    max_price: 0,
    duration_mode: "manual", // "manual" | "auto"
  });

  const [schedule, setSchedule] = useState<any[]>(
    DAYS.map((_, i) => ({
      day_of_week: i,
      open_time: "09:00",
      close_time: "22:00",
      is_closed: 0,
    })),
  );

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(getApiUrl("/api/owner/restaurant/settings"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          duration_mode: "manual",
          ...data.settings,
        });
        if (data.schedule && data.schedule.length > 0) {
          const fullSchedule = DAYS.map((_, i) => {
            const existing = data.schedule.find(
              (s: any) => s.day_of_week === i,
            );
            return (
              existing || {
                day_of_week: i,
                open_time: "09:00",
                close_time: "22:00",
                is_closed: 1,
              }
            );
          });
          setSchedule(fullSchedule);
        }
      } else {
        setError("Failed to load settings");
      }
    } catch (err) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/owner/restaurant/settings"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const schedRes = await fetch(
          getApiUrl("/api/owner/restaurant/schedule"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ schedule }),
          },
        );

        if (schedRes.ok) {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        } else {
          setError("Failed to save schedule");
        }
      } else {
        setError("Failed to save settings");
      }
    } catch (err) {
      setError("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const updateSchedule = (dayIndex: number, fields: any) => {
    const newSchedule = [...schedule];
    newSchedule[dayIndex] = { ...newSchedule[dayIndex], ...fields };
    setSchedule(newSchedule);
  };

  // ---- picker handlers ----
  const openTimePicker = (
    dayIndex: number,
    field: "open_time" | "close_time",
  ) => {
    const currentValue = schedule[dayIndex][field];
    if (Platform.OS === "ios") {
      setIosPickerValue(timeStringToDate(currentValue));
      setActivePicker({ dayIndex, field });
    } else {
      // Android: setting activePicker renders <DateTimePicker> below,
      // which immediately opens the native dialog
      setActivePicker({ dayIndex, field });
    }
  };

  const onAndroidTimeChange = (event: any, selectedDate?: Date) => {
    const { dayIndex, field } = activePicker || {};
    setActivePicker(null); // Android dialog is a one-shot native dialog
    if (
      event.type === "set" &&
      selectedDate &&
      dayIndex !== undefined &&
      field
    ) {
      updateSchedule(dayIndex, { [field]: dateToTimeString(selectedDate) });
    }
  };

  const onIosTimeChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) setIosPickerValue(selectedDate);
  };

  const confirmIosTime = () => {
    if (activePicker) {
      updateSchedule(activePicker.dayIndex, {
        [activePicker.field]: dateToTimeString(iosPickerValue),
      });
    }
    setActivePicker(null);
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.oliveMuted} />
      </View>
    );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={theme.colors.oliveMuted} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("owner_settings.title")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBanner}>
            <AlertCircle size={20} color={theme.colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <SettingsSection
          title={t("settings.language")}
          icon={<Globe size={20} color={theme.colors.oliveMuted} />}
          description="Choose your preferred interface language."
        >
          <TouchableOpacity
            onPress={() => setIsLangOpen(true)}
            style={styles.languageToggle}
          >
            <View style={styles.languageInfo}>
              <Text style={styles.flagText}>
                {language === "en" ? "🇺🇸" : language === "am" ? "🇦🇲" : "🇷🇺"}
              </Text>
              <View>
                <Text style={styles.languageName}>
                  {language === "en"
                    ? "English"
                    : language === "am"
                      ? "Հայերեն"
                      : "Русский"}
                </Text>
                <Text style={styles.sublabel}>Selected Language</Text>
              </View>
            </View>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </SettingsSection>

        <SettingsSection
          title={t("owner_settings.opening_hours")}
          icon={<Clock size={20} color={theme.colors.oliveMuted} />}
          description="Manage your weekly operating schedule."
        >
          {schedule.map((day, idx) => (
            <View key={idx} style={styles.dayRow}>
              <View style={styles.dayInfo}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: day.is_closed
                        ? theme.colors.red
                        : "#10b981",
                    },
                  ]}
                />
                <Text style={styles.dayName}>{DAYS[day.day_of_week]}</Text>
              </View>

              {!day.is_closed ? (
                <View style={styles.timeInputs}>
                  <TouchableOpacity
                    onPress={() => openTimePicker(idx, "open_time")}
                    style={styles.timeInput}
                  >
                    <Text style={styles.timeInputText}>
                      {formatDisplayTime(day.open_time)}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.toText}>to</Text>
                  <TouchableOpacity
                    onPress={() => openTimePicker(idx, "close_time")}
                    style={styles.timeInput}
                  >
                    <Text style={styles.timeInputText}>
                      {formatDisplayTime(day.close_time)}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.closedText}>Closed for the day</Text>
              )}

              <TouchableOpacity
                onPress={() =>
                  updateSchedule(idx, { is_closed: day.is_closed ? 0 : 1 })
                }
                style={[
                  styles.dayToggleButton,
                  {
                    backgroundColor: day.is_closed
                      ? "rgba(90, 90, 64, 0.1)"
                      : "rgba(239, 68, 68, 0.05)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayToggleText,
                    {
                      color: day.is_closed
                        ? theme.colors.oliveMuted
                        : theme.colors.red,
                    },
                  ]}
                >
                  {day.is_closed ? "Open" : "Mark Closed"}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </SettingsSection>

        <SettingsSection
          title={t("owner_settings.reservation_rules")}
          icon={<Calendar size={20} color={theme.colors.accentBlue} />}
          description="Define how customers can book tables."
        >
          <View style={styles.durationModeBlock}>
            <Text style={styles.inputLabel}>Reservation Duration</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                onPress={() =>
                  setSettings({ ...settings, duration_mode: "manual" })
                }
                style={[
                  styles.segmentButton,
                  settings.duration_mode !== "auto" &&
                    styles.segmentButtonActive,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.duration_mode !== "auto" &&
                      styles.segmentTextActive,
                  ]}
                >
                  Manual
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setSettings({ ...settings, duration_mode: "auto" })
                }
                style={[
                  styles.segmentButton,
                  settings.duration_mode === "auto" &&
                    styles.segmentButtonActive,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.duration_mode === "auto" &&
                      styles.segmentTextActive,
                  ]}
                >
                  Automatic
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.inputSubtext}>
              {settings.duration_mode === "auto"
                ? "We'll calculate each booking's end time automatically based on party size."
                : "Customers choose their own start and end time for each booking."}
            </Text>
          </View>

          <View style={styles.grid}>
            <InputField
              label="Max Duration (mins)"
              keyboardType="numeric"
              value={String(settings.max_reservation_duration)}
              onChange={(val: string) =>
                setSettings({
                  ...settings,
                  max_reservation_duration: parseInt(val) || 0,
                })
              }
              subtext="How long each party can stay"
            />
            <InputField
              label="Advance Booking (days)"
              keyboardType="numeric"
              value={String(settings.advance_booking_days)}
              onChange={(val: string) =>
                setSettings({
                  ...settings,
                  advance_booking_days: parseInt(val) || 0,
                })
              }
              subtext="How far ahead customers can book"
            />
            <InputField
              label="Min Notice (hours)"
              keyboardType="numeric"
              value={String(settings.min_booking_notice_hours)}
              onChange={(val: string) =>
                setSettings({
                  ...settings,
                  min_booking_notice_hours: parseFloat(val) || 0,
                })
              }
              subtext="Minimum hours before a booking is allowed"
            />
          </View>
        </SettingsSection>

        <SettingsSection
          title={t("settings.notifications")}
          icon={<Bell size={20} color={theme.colors.oliveMuted} />}
          description="Get alerted about important activities."
        >
          <ToggleField
            label="New Reservation Alerts"
            description="Notify when a new reservation is made"
            active={settings.notify_new_reservation === 1}
            onToggle={() =>
              setSettings({
                ...settings,
                notify_new_reservation: settings.notify_new_reservation ? 0 : 1,
              })
            }
          />
          <ToggleField
            label="Cancellation Alerts"
            description="Notify when a reservation is cancelled"
            active={settings.notify_cancellations === 1}
            onToggle={() =>
              setSettings({
                ...settings,
                notify_cancellations: settings.notify_cancellations ? 0 : 1,
              })
            }
          />
          <ToggleField
            label="Waitlist Alerts"
            description="Notify when someone joins the waitlist"
            active={settings.notify_waitlist === 1}
            onToggle={() =>
              setSettings({
                ...settings,
                notify_waitlist: settings.notify_waitlist ? 0 : 1,
              })
            }
          />
        </SettingsSection>

        <TouchableOpacity
          onPress={handleSaveSettings}
          disabled={saving}
          style={[styles.saveButton, success && { backgroundColor: "#10b981" }]}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : success ? (
            <Check size={18} color="white" />
          ) : (
            <Save size={18} color="white" />
          )}
          <Text style={styles.saveButtonText}>
            {saving
              ? t("common.saving")
              : success
                ? t("common.saved")
                : t("common.save")}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <LanguageSelector
        isOpen={isLangOpen}
        onClose={() => setIsLangOpen(false)}
      />

      {/* Android: native dialog, renders itself when mounted */}
      {Platform.OS === "android" && activePicker && (
        <DateTimePicker
          value={timeStringToDate(
            schedule[activePicker.dayIndex][activePicker.field],
          )}
          mode="time"
          is24Hour
          display="default"
          onChange={onAndroidTimeChange}
        />
      )}

      {/* iOS: spinner inside a bottom sheet modal */}
      {Platform.OS === "ios" && (
        <Modal
          visible={!!activePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setActivePicker(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setActivePicker(null)}>
                  <Text style={styles.modalCancel}>{t("common.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmIosTime}>
                  <Text style={styles.modalDone}>{t("common.done")}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={iosPickerValue}
                mode="time"
                is24Hour
                display="spinner"
                onChange={onIosTimeChange}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function SettingsSection({ title, icon, description, children }: any) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBox}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDesc}>{description}</Text>
        </View>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function InputField({ label, value, onChange, subtext, ...props }: any) {
  return (
    <View style={styles.inputField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        {...props}
      />
      {subtext && <Text style={styles.inputSubtext}>{subtext}</Text>}
    </View>
  );
}

function ToggleField({ label, description, active, onToggle }: any) {
  return (
    <View style={styles.toggleField}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDesc}>{description}</Text>}
      </View>
      <Switch
        value={active}
        onValueChange={onToggle}
        trackColor={{
          false: "#e2e8f0",
          true: theme.colors.oliveMuted,
        }}
        thumbColor="white"
        ios_backgroundColor="#e2e8f0"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bgBase },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bgBase,
  },
  header: {
    height: 64,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    gap: 4,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
  },
  scrollContent: { padding: 20, gap: 20 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff1f2",
    padding: 16,
    borderRadius: 20,
    gap: 12,
  },
  errorText: {
    color: theme.colors.red,
    fontSize: 12,
    fontWeight: "bold",
    flex: 1,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 18,
  },
  sectionIconBox: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(90, 90, 64, 0.05)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.oliveAccent,
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  sectionDesc: { fontSize: 10, color: theme.colors.textDim, marginTop: 2 },
  sectionContent: { gap: 14 },
  languageToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: theme.colors.bgBase,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  languageInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  flagText: { fontSize: 24 },
  languageName: {
    fontSize: 14,
    fontWeight: "bold",
    color: theme.colors.charcoal,
  },
  sublabel: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    color: theme.colors.textDim,
  },
  changeText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.oliveMuted,
    textTransform: "uppercase",
    textDecorationLine: "underline",
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.03)",
  },
  dayInfo: { flexDirection: "row", alignItems: "center", gap: 6, width: 82 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dayName: { fontSize: 11, fontWeight: "bold", color: theme.colors.charcoal },
  timeInputs: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeInput: {
    backgroundColor: theme.colors.bgBase,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  timeInputText: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.charcoal,
  },
  toText: { fontSize: 10, color: theme.colors.textDim },
  closedText: {
    fontSize: 11,
    color: theme.colors.textDim,
    fontStyle: "italic",
    flex: 1,
    textAlign: "center",
  },
  dayToggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  dayToggleText: { fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  durationModeBlock: { gap: 8, marginBottom: 14 },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: theme.colors.bgBase,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonActive: {
    backgroundColor: theme.colors.charcoal,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: theme.colors.textDim,
  },
  segmentTextActive: {
    color: "white",
  },
  grid: { gap: 14 },
  inputField: { gap: 6 },
  inputLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: theme.colors.textDim,
    marginLeft: 4,
  },
  textInput: {
    backgroundColor: theme.colors.bgBase,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontWeight: "bold",
    color: theme.colors.charcoal,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  inputSubtext: {
    fontSize: 9,
    color: theme.colors.textDim,
    fontStyle: "italic",
    marginLeft: 4,
  },
  toggleField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: theme.colors.charcoal,
  },
  toggleDesc: { fontSize: 10, color: theme.colors.textDim, marginTop: 2 },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.charcoal,
    paddingVertical: 18,
    borderRadius: 24,
    gap: 10,
    marginTop: 4,
  },
  saveButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  modalSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  modalCancel: {
    fontSize: 14,
    color: theme.colors.textDim,
    fontWeight: "bold",
  },
  modalDone: {
    fontSize: 14,
    color: theme.colors.oliveMuted,
    fontWeight: "900",
  },
});
