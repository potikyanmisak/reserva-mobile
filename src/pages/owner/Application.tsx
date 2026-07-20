import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../lib/AuthContext";
import { useLanguage } from "../../lib/LanguageContext";
import * as ImagePicker from "expo-image-picker";
import {
  ChefHat,
  Clock,
  LogOut,
  Image as ImageIcon,
  Phone,
} from "lucide-react-native";
import { getApiUrl } from "../../lib/api";
import { CUISINES } from "../../lib/filterOptions";

type ApplicationStatus = null | "pending" | false;

interface OwnerApplicationProps {
  applicationStatus: ApplicationStatus;
  onSubmitted: () => void;
}

export default function OwnerApplication({
  applicationStatus,
  onSubmitted,
}: OwnerApplicationProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token, logout } = useAuth();
  const { t } = useLanguage();

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: "",
    description: "",
    cuisine_type: "Italian",
    location: "",
    phone_number: "",
    open_time: "10:00",
    close_time: "22:00",
    logo_url: "",
    cancellation_policy_hours: 24,
    min_price: 0,
    max_price: 0,
  });

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setFormData((prev: any) => ({ ...prev, logo_url: base64 }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.logo_url) {
      Alert.alert(
        t("owner_dashboard.error_title"),
        t("owner_dashboard.logo_required"),
      );
      return;
    }
    if (!formData.phone_number.trim()) {
      Alert.alert(
        t("owner_dashboard.error_title"),
        t("owner_dashboard.phone_required"),
      );
      return;
    }
    if (formData.min_price > formData.max_price && formData.max_price > 0) {
      Alert.alert(
        t("owner_dashboard.error_title"),
        t("owner_dashboard.invalid_price_range"),
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/restaurants"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, status: "pending" }),
      });
      if (!res.ok) throw new Error("Failed to create restaurant");
      setShowForm(false);
      onSubmitted();
    } catch (err) {
      console.error(err);
      Alert.alert(
        t("owner_dashboard.error_title"),
        t("owner_dashboard.submit_failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("owner_dashboard.confirm_title"),
      t("owner_dashboard.confirm_delete_account"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(getApiUrl("/api/account"), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                logout();
                navigation.navigate("Auth");
              } else {
                Alert.alert(
                  t("owner_dashboard.error_title"),
                  t("owner_dashboard.delete_account_failed"),
                );
              }
            } catch (err) {
              console.error(err);
              Alert.alert(
                t("owner_dashboard.error_title"),
                t("owner_dashboard.network_error"),
              );
            }
          },
        },
      ],
    );
  };

  if (applicationStatus === null) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#7C8B6D" />
      </View>
    );
  }

  if (applicationStatus === "pending") {
    return (
      <View style={styles.centeredContainer}>
        <View style={styles.pendingIconBox}>
          <Clock size={40} color="#7C8B6D" />
        </View>
        <View style={styles.centeredText}>
          <Text style={styles.registerTitle}>
            {t("owner_dashboard.application_submitted_title")}
          </Text>
          <Text style={styles.registerSubtitle}>
            {t("owner_dashboard.application_under_review")}
          </Text>
        </View>
        <View style={styles.pendingStatusCard}>
          <View style={styles.pendingDot} />
          <Text style={styles.pendingStatusText}>
            {t("owner_dashboard.pending_admin_approval")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            logout();
            navigation.navigate("Auth");
          }}
          style={styles.logoutPendingBtn}
        >
          <LogOut size={16} color="rgba(45,45,45,0.5)" />
          <Text style={styles.logoutPendingText}>
            {t("owner_dashboard.sign_out")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={styles.deleteAccountBtn}
        >
          <Text style={styles.deleteAccountText}>
            {t("owner_dashboard.delete_account")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showForm) {
    return (
      <ScrollView
        style={styles.formContainer}
        contentContainerStyle={[
          styles.formContent,
          { paddingTop: insets.top + 24 },
        ]}
      >
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>
            {t("owner_dashboard.register_restaurant")}
          </Text>
          <Text style={styles.formSubtitle}>
            {t("owner_dashboard.complete_profile")}
          </Text>
        </View>

        <View style={styles.formSpace}>
          <View style={styles.logoUploadSection}>
            <TouchableOpacity onPress={pickImage} style={styles.logoPicker}>
              {formData.logo_url ? (
                <Image
                  source={{ uri: formData.logo_url }}
                  style={styles.fullImage}
                />
              ) : (
                <View style={styles.centered}>
                  <ImageIcon size={24} color="#7C8B6D" />
                  <Text style={styles.pickerLabel}>
                    {t("owner_dashboard.logo_label")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.requiredText}>
              {t("owner_dashboard.required")}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t("owner_dashboard.restaurant_name")}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t("owner_dashboard.restaurant_name_placeholder")}
              placeholderTextColor="rgba(45, 45, 45, 0.4)"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t("owner_dashboard.description")}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t("owner_dashboard.description_placeholder")}
              placeholderTextColor="rgba(45, 45, 45, 0.4)"
              multiline
              numberOfLines={4}
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t("owner_dashboard.phone_number_required_label")}
            </Text>
            <View style={styles.phoneInputRow}>
              <Phone
                size={16}
                color="rgba(45,45,45,0.4)"
                style={{ marginLeft: 16 }}
              />
              <TextInput
                style={styles.phoneInput}
                placeholder={t("owner_dashboard.phone_placeholder")}
                placeholderTextColor="rgba(45, 45, 45, 0.4)"
                keyboardType="phone-pad"
                value={formData.phone_number}
                onChangeText={(text) =>
                  setFormData({ ...formData, phone_number: text })
                }
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t("owner_dashboard.cuisine_type")}
            </Text>
            <View style={styles.cuisinePickerContainer}>
              {CUISINES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setFormData({ ...formData, cuisine_type: c })}
                  style={[
                    styles.cuisineTab,
                    formData.cuisine_type === c && styles.cuisineTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.cuisineTabText,
                      formData.cuisine_type === c && styles.textWhite,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t("owner_dashboard.location")}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t("owner_dashboard.address_placeholder")}
              placeholderTextColor="rgba(45, 45, 45, 0.4)"
              value={formData.location}
              onChangeText={(text) =>
                setFormData({ ...formData, location: text })
              }
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>
                {t("owner_dashboard.open_time")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("owner_dashboard.time_placeholder")}
                value={formData.open_time}
                onChangeText={(text) =>
                  setFormData({ ...formData, open_time: text })
                }
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>
                {t("owner_dashboard.close_time")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("owner_dashboard.time_placeholder")}
                value={formData.close_time}
                onChangeText={(text) =>
                  setFormData({ ...formData, close_time: text })
                }
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t("owner_dashboard.cancel_policy")} (
              {t("owner_dashboard.hrs_suffix")})
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(formData.cancellation_policy_hours || 24)}
              onChangeText={(text) =>
                setFormData({
                  ...formData,
                  cancellation_policy_hours: parseInt(text) || 0,
                })
              }
            />
          </View>

          <View style={styles.priceSection}>
            <View style={styles.priceHeader}>
              <Text style={styles.priceSectionTitle}>
                {t("owner_dashboard.avg_price_range")}
              </Text>
              <Text style={styles.priceSectionSubtitle}>
                {t("owner_dashboard.cost_per_person")}
              </Text>
            </View>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>
                  {t("owner_dashboard.min_price")}
                </Text>
                <View style={styles.relativeInput}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder={t("owner_dashboard.price_placeholder_min")}
                    value={formData.min_price ? String(formData.min_price) : ""}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        min_price: text === "" ? 0 : parseInt(text),
                      })
                    }
                  />
                  <Text style={styles.currencySymbol}>֏</Text>
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>
                  {t("owner_dashboard.max_price")}
                </Text>
                <View style={styles.relativeInput}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder={t("owner_dashboard.price_placeholder_max")}
                    value={formData.max_price ? String(formData.max_price) : ""}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        max_price: text === "" ? 0 : parseInt(text),
                      })
                    }
                  />
                  <Text style={styles.currencySymbol}>֏</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            style={styles.formSubmitButton}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.formSubmitButtonText}>
                {t("owner_dashboard.submit_application")}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowForm(false)}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.centeredContainer}>
      <View style={styles.chefHatIconBox}>
        <ChefHat size={40} color="rgba(45, 45, 45, 0.4)" />
      </View>
      <View style={styles.centeredText}>
        <Text style={styles.registerTitle}>
          {t("owner_dashboard.register_restaurant")}
        </Text>
        <Text style={styles.registerSubtitle}>
          {t("owner_dashboard.wait_verification")}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => setShowForm(true)}
        style={styles.startAppButton}
      >
        <Text style={styles.startAppButtonText}>
          {t("owner_dashboard.start_application")}
        </Text>
      </TouchableOpacity>

      <View style={styles.accountActionsRow}>
        <TouchableOpacity
          onPress={() => {
            logout();
            navigation.navigate("Auth");
          }}
          style={styles.logoutPendingBtn}
        >
          <LogOut size={16} color="rgba(45,45,45,0.5)" />
          <Text style={styles.logoutPendingText}>
            {t("owner_dashboard.sign_out")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={styles.deleteAccountBtn}
        >
          <Text style={styles.deleteAccountText}>
            {t("owner_dashboard.delete_account")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    backgroundColor: "#FDFCFB",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  chefHatIconBox: {
    width: 96,
    height: 96,
    backgroundColor: "white",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  pendingIconBox: {
    width: 96,
    height: 96,
    backgroundColor: "#f0f4ee",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(124,139,109,0.2)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C8B6D",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 4,
  },
  centeredText: { alignItems: "center", gap: 8 },
  registerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    textAlign: "center",
  },
  registerSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(45, 45, 45, 0.6)",
    textAlign: "center",
    maxWidth: 280,
  },
  pendingStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f59e0b",
  },
  pendingStatusText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#d97706",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  logoutPendingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  logoutPendingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(45,45,45,0.5)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  accountActionsRow: { alignItems: "center", gap: 4 },
  deleteAccountBtn: { paddingVertical: 8 },
  deleteAccountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ef4444",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  startAppButton: {
    width: "100%",
    maxWidth: 300,
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
  startAppButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  formContainer: { flex: 1, backgroundColor: "#FDFCFB" },
  formContent: { padding: 24, paddingBottom: 40 },
  formHeader: { alignItems: "center", marginBottom: 40 },
  formTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    textAlign: "center",
  },
  formSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(45, 45, 45, 0.6)",
    textAlign: "center",
    marginTop: 4,
  },
  formSpace: { gap: 20 },
  logoUploadSection: { alignItems: "center", marginBottom: 20 },
  logoPicker: {
    width: 96,
    height: 96,
    backgroundColor: "#F5EEE7",
    borderRadius: 30,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fullImage: { width: "100%", height: "100%", resizeMode: "contain" },
  centered: { alignItems: "center" },
  pickerLabel: {
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "#7C8B6D",
    marginTop: 4,
  },
  requiredText: {
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
    color: "rgba(45, 45, 45, 0.4)",
    marginTop: 8,
  },
  inputGroup: { gap: 8 },
  inputLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.6)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 16,
  },
  input: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 14,
    color: "#2D2D2D",
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    gap: 8,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 14,
    color: "#2D2D2D",
  },
  textArea: { height: 120, textAlignVertical: "top" },
  cuisinePickerContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cuisineTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cuisineTabActive: { backgroundColor: "#2D2D2D", borderColor: "#2D2D2D" },
  cuisineTabText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "rgba(45, 45, 45, 0.6)",
  },
  textWhite: { color: "white" },
  row: { flexDirection: "row", gap: 12 },
  priceSection: {
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  priceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  priceSectionTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.6)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  priceSectionSubtitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#7C8B6D",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  relativeInput: { position: "relative" },
  currencySymbol: {
    position: "absolute",
    right: 16,
    top: 18,
    fontSize: 12,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.3)",
  },
  formSubmitButton: {
    width: "100%",
    height: 60,
    backgroundColor: "#7C8B6D",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    shadowColor: "#7C8B6D",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  formSubmitButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  cancelButton: {
    width: "100%",
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
