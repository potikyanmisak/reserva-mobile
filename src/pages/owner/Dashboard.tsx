import React, { useEffect, useState } from "react";
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
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../lib/AuthContext";
import { theme } from "../../theme";
import {
  Plus,
  Eye,
  Star,
  MapPin,
  Image as ImageIcon,
  Check,
  X,
  RefreshCw,
  Circle,
  Square,
  RectangleHorizontal,
  ChefHat,
  LogOut,
  Phone,
  Gamepad2,
  Mic2,
  Sofa,
  Pencil,
  Save,
  Wallet,
} from "lucide-react-native";
import { useLanguage } from "../../lib/LanguageContext";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import { getApiUrl } from "../../lib/api";
import { EXPERIENCE_GROUPS, AMENITIES, MOODS } from "../../lib/filterOptions";

const { width } = Dimensions.get("window");

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY ?? "";

function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s\-().]{7,20}$/.test(phone.trim());
}

function MultiSelectPills({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  return (
    <View style={styles.pillGrid}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onToggle(opt)}
            style={[styles.pill, active && styles.pillActive]}
          >
            {active && (
              <Check
                size={10}
                color="white"
                strokeWidth={3}
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SubLabel({ label }: { label: string }) {
  return <Text style={styles.subLabel}>{label}</Text>;
}

function RestaurantMap({ location }: { location: string }) {
  const encodedLocation = encodeURIComponent(location || "");
  const mapHtml = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>body,html{height:100%;margin:0;padding:0;overflow:hidden;}</style>
  </head><body>
    <iframe width="100%" height="100%" style="border:0;" loading="lazy"
      src="https://maps.google.com/maps?q=${encodedLocation}&t=&z=15&ie=UTF8&iwloc=&output=embed">
    </iframe>
  </body></html>`;
  return (
    <View style={styles.mapContainer}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        style={styles.webViewMap}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator color="#7C8B6D" />
          </View>
        )}
      />
    </View>
  );
}

function EditableLocationMap({
  lat,
  lng,
  onLocationChange,
}: {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}) {
  const mapHtml = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>body,html{height:100%;margin:0;padding:0;}#map{height:100%;}</style>
  </head><body>
    <div id="map"></div>
    <script>
      var initLat = ${lat};
      var initLng = ${lng};
      var map, marker;

      function sendPos(lat, lng) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerMoved', lat: lat, lng: lng }));
      }

      function initMap() {
        var latLng = { lat: initLat, lng: initLng };
        map = new google.maps.Map(document.getElementById('map'), {
          center: latLng,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
        });
        marker = new google.maps.Marker({
          position: latLng,
          map: map,
          draggable: true,
        });
        marker.addListener('dragend', function(e) {
          sendPos(e.latLng.lat(), e.latLng.lng());
        });
        map.addListener('click', function(e) {
          marker.setPosition(e.latLng);
          sendPos(e.latLng.lat(), e.latLng.lng());
        });
      }
    </script>
    <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&callback=initMap" async defer></script>
  </body></html>`;

  return (
    <View style={styles.editableMapContainer}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        style={styles.editableMapWebView}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "markerMoved") {
              onLocationChange(data.lat, data.lng);
            }
          } catch {}
        }}
      />
    </View>
  );
}

function ResourceShapeIcon({ resource }: { resource: any }) {
  if (resource.resource_type === "room")
    return <Sofa size={14} color="#7C8B6D" />;
  if (resource.resource_type === "station")
    return <Gamepad2 size={14} color="#7C8B6D" />;
  if (resource.resource_type === "booth")
    return <Mic2 size={14} color="#7C8B6D" />;
  if (resource.shape === "round") return <Circle size={14} color="#7C8B6D" />;
  if (resource.shape === "rectangular")
    return <RectangleHorizontal size={14} color="#7C8B6D" />;
  return <Square size={14} color="#7C8B6D" />;
}

function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const show = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

export default function OwnerDashboard() {
  const insets = useSafeAreaInsets();
  const { user, token, logout } = useAuth();
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { toast, show: showToast } = useToast();

  const RESOURCE_TYPES = [
    { id: "table", label: t("owner_dashboard.resource_type_table") },
    { id: "room", label: t("owner_dashboard.resource_type_room") },
    { id: "booth", label: t("owner_dashboard.resource_type_booth") },
    { id: "station", label: t("owner_dashboard.resource_type_station") },
    { id: "zone", label: t("owner_dashboard.resource_type_zone") },
  ];

  const [restaurant, setRestaurant] = useState<any>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [pendingReservations, setPendingReservations] = useState<any[]>([]);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [newResource, setNewResource] = useState({
    name: "",
    resource_type: "table",
    capacity: 2,
    location: "indoor",
    quantity: 1,
    shape: "square",
    min_booking_minutes: 30,
    max_booking_minutes: null as number | null,
    price_per_hour: 0,
    features: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingMenu, setUploadingMenu] = useState(false);
  const TAB_BAR_HEIGHT = 60;

  const [editingPhone, setEditingPhone] = useState(false);
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [showSecondaryPhone, setShowSecondaryPhone] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  const [editingLocation, setEditingLocation] = useState(false);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const [editingFilters, setEditingFilters] = useState(false);
  const [filterExperienceTypes, setFilterExperienceTypes] = useState<string[]>(
    [],
  );
  const [filterAmenities, setFilterAmenities] = useState<string[]>([]);
  const [filterMoods, setFilterMoods] = useState<string[]>([]);
  const [savingFilters, setSavingFilters] = useState(false);

  const [editingPriceRange, setEditingPriceRange] = useState(false);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [savingPriceRange, setSavingPriceRange] = useState(false);

  useEffect(() => {
    if (restaurant) {
      setPrimaryPhone(restaurant.phone_number || "");
      setSecondaryPhone(restaurant.secondary_phone || "");
      setShowSecondaryPhone(!!restaurant.secondary_phone);
      setLocationAddress(restaurant.location || "");
      setLocationLat(
        restaurant.latitude ? parseFloat(restaurant.latitude) : null,
      );
      setLocationLng(
        restaurant.longitude ? parseFloat(restaurant.longitude) : null,
      );
      setFilterExperienceTypes(restaurant.experience_types || []);
      setFilterAmenities(restaurant.amenities || []);
      setFilterMoods(restaurant.moods || []);
      setMinPrice(
        restaurant.min_price !== undefined && restaurant.min_price !== null
          ? Number(restaurant.min_price)
          : null,
      );
      setMaxPrice(
        restaurant.max_price !== undefined && restaurant.max_price !== null
          ? Number(restaurant.max_price)
          : null,
      );
    }
  }, [restaurant]);

  const handleSavePhone = async () => {
    if (!restaurant?.id) {
      showToast(t("owner_dashboard.restaurant_not_loaded"), "error");
      return;
    }
    if (!isValidPhone(primaryPhone)) {
      showToast(t("owner_dashboard.invalid_primary_phone"), "error");
      return;
    }
    if (secondaryPhone && !isValidPhone(secondaryPhone)) {
      showToast(t("owner_dashboard.invalid_secondary_phone"), "error");
      return;
    }
    setSavingPhone(true);
    try {
      const res = await fetch(getApiUrl(`/api/restaurants/${restaurant.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone_number: primaryPhone,
          secondary_phone: secondaryPhone || null,
        }),
      });
      if (res.ok) {
        showToast(t("owner_dashboard.phone_updated"));
        setEditingPhone(false);
        fetchRestaurant();
      } else {
        const errText = await res.text();
        showToast(
          `${t("owner_dashboard.phone_update_failed")} (${res.status})`,
          "error",
        );
        console.error("Phone save error:", res.status, errText);
      }
    } catch (e) {
      showToast(t("owner_dashboard.network_error"), "error");
      console.error(e);
    } finally {
      setSavingPhone(false);
    }
  };

  const handleCancelPhone = () => {
    setPrimaryPhone(restaurant?.phone_number || "");
    setSecondaryPhone(restaurant?.secondary_phone || "");
    setShowSecondaryPhone(!!restaurant?.secondary_phone);
    setEditingPhone(false);
  };

  const handleDeleteSecondaryPhone = () => {
    setSecondaryPhone("");
    setShowSecondaryPhone(false);
  };

  const handleSaveLocation = async () => {
    if (!restaurant?.id) {
      showToast(t("owner_dashboard.restaurant_not_loaded"), "error");
      return;
    }
    if (!locationAddress.trim()) {
      showToast(t("owner_dashboard.address_empty"), "error");
      return;
    }
    setSavingLocation(true);
    try {
      const body: any = { location: locationAddress };
      if (locationLat !== null) body.latitude = locationLat;
      if (locationLng !== null) body.longitude = locationLng;
      const res = await fetch(getApiUrl(`/api/restaurants/${restaurant.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast(t("owner_dashboard.location_updated"));
        setEditingLocation(false);
        fetchRestaurant();
      } else {
        const errText = await res.text();
        showToast(
          `${t("owner_dashboard.location_update_failed")} (${res.status})`,
          "error",
        );
        console.error("Location save error:", res.status, errText);
      }
    } catch (e) {
      showToast(t("owner_dashboard.network_error"), "error");
      console.error(e);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleCancelLocation = () => {
    setLocationAddress(restaurant?.location || "");
    setLocationLat(
      restaurant?.latitude ? parseFloat(restaurant.latitude) : null,
    );
    setLocationLng(
      restaurant?.longitude ? parseFloat(restaurant.longitude) : null,
    );
    setEditingLocation(false);
  };

  const handleSaveFilters = async () => {
    if (!restaurant?.id) {
      showToast(t("owner_dashboard.restaurant_not_loaded"), "error");
      return;
    }
    setSavingFilters(true);
    try {
      const res = await fetch(getApiUrl(`/api/restaurants/${restaurant.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          experience_types: filterExperienceTypes,
          amenities: filterAmenities,
          moods: filterMoods,
        }),
      });
      if (res.ok) {
        showToast(t("owner_dashboard.filters_saved"));
        setEditingFilters(false);
        fetchRestaurant();
      } else {
        const errText = await res.text();
        showToast(
          `${t("owner_dashboard.filters_save_failed")} (${res.status})`,
          "error",
        );
        console.error("Filters save error:", res.status, errText);
      }
    } catch (e) {
      showToast(t("owner_dashboard.network_error"), "error");
      console.error(e);
    } finally {
      setSavingFilters(false);
    }
  };

  const handleCancelFilters = () => {
    setFilterExperienceTypes(restaurant?.experience_types || []);
    setFilterAmenities(restaurant?.amenities || []);
    setFilterMoods(restaurant?.moods || []);
    setEditingFilters(false);
  };

  const handleSavePriceRange = async () => {
    if (!restaurant?.id) {
      showToast(t("owner_dashboard.restaurant_not_loaded"), "error");
      return;
    }
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      showToast(t("owner_dashboard.invalid_price_range"), "error");
      return;
    }
    setSavingPriceRange(true);
    try {
      const res = await fetch(getApiUrl(`/api/restaurants/${restaurant.id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          min_price: minPrice ?? 0,
          max_price: maxPrice ?? 0,
        }),
      });
      if (res.ok) {
        showToast(t("owner_dashboard.price_range_updated"));
        setEditingPriceRange(false);
        fetchRestaurant();
      } else {
        const errText = await res.text();
        showToast(
          `${t("owner_dashboard.price_range_update_failed")} (${res.status})`,
          "error",
        );
        console.error("Price range save error:", res.status, errText);
      }
    } catch (e) {
      showToast(t("owner_dashboard.network_error"), "error");
      console.error(e);
    } finally {
      setSavingPriceRange(false);
    }
  };

  const handleCancelPriceRange = () => {
    setMinPrice(
      restaurant?.min_price !== undefined && restaurant?.min_price !== null
        ? Number(restaurant.min_price)
        : null,
    );
    setMaxPrice(
      restaurant?.max_price !== undefined && restaurant?.max_price !== null
        ? Number(restaurant.max_price)
        : null,
    );
    setEditingPriceRange(false);
  };

  const pickImage = async (type: "logo" | "gallery") => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === "logo") {
        handleLogoUpload(base64);
      } else {
        handleImageUpload(base64);
      }
    }
  };

  const handleLogoUpload = async (base64: string) => {
    if (!restaurant) return;
    setLoading(true);
    try {
      const res = await fetch(
        getApiUrl(`/api/restaurants/${restaurant.id}/logo`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ logo_url: base64 }),
        },
      );
      if (res.ok) fetchRestaurant();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (base64: string) => {
    if (!restaurant) return;
    setUploadingGallery(true);
    const tempId = Date.now();
    setRestaurant((prev: any) => ({
      ...prev,
      images: [...(prev.images || []), { id: tempId, url: base64, temp: true }],
    }));
    try {
      const res = await fetch(
        getApiUrl(`/api/restaurants/${restaurant.id}/images`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: base64 }),
        },
      );
      if (res.ok) fetchRestaurant();
      else
        setRestaurant((prev: any) => ({
          ...prev,
          images: (prev.images || []).filter((img: any) => img.id !== tempId),
        }));
    } catch (err) {
      console.error(err);
      setRestaurant((prev: any) => ({
        ...prev,
        images: (prev.images || []).filter((img: any) => img.id !== tempId),
      }));
    } finally {
      setUploadingGallery(false);
    }
  };

  const pickMenuImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      handleMenuImageUpload(
        `data:image/jpeg;base64,${result.assets[0].base64}`,
      );
    }
  };

  const handleMenuImageUpload = async (base64: string) => {
    if (!restaurant) return;
    setUploadingMenu(true);
    const tempId = Date.now();
    setRestaurant((prev: any) => ({
      ...prev,
      menuImages: [
        ...(prev.menuImages || []),
        { id: tempId, url: base64, temp: true },
      ],
    }));
    try {
      const res = await fetch(
        getApiUrl(`/api/restaurants/${restaurant.id}/menu-images`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: base64 }),
        },
      );
      if (res.ok) fetchRestaurant();
      else
        setRestaurant((prev: any) => ({
          ...prev,
          menuImages: (prev.menuImages || []).filter(
            (img: any) => img.id !== tempId,
          ),
        }));
    } catch (err) {
      console.error(err);
      setRestaurant((prev: any) => ({
        ...prev,
        menuImages: (prev.menuImages || []).filter(
          (img: any) => img.id !== tempId,
        ),
      }));
    } finally {
      setUploadingMenu(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    Alert.alert(
      t("owner_dashboard.confirm_delete_title"),
      t("owner_dashboard.confirm_delete_image"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            setRestaurant((prev: any) => ({
              ...prev,
              images: (prev.images || []).filter(
                (img: any) => img.id !== imageId,
              ),
              menuImages: (prev.menuImages || []).filter(
                (img: any) => img.id !== imageId,
              ),
            }));
            try {
              await fetch(getApiUrl(`/api/restaurant-images/${imageId}`), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
            } catch (err) {
              console.error(err);
              fetchRestaurant();
            }
          },
        },
      ],
    );
  };

  const fetchRestaurant = () => {
    fetch(getApiUrl("/api/restaurants"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const list = data.all ?? data ?? [];
        const owned = list.find(
          (r: any) => Number(r.owner_id) === Number(user?.id),
        );
        if (owned) {
          fetch(getApiUrl(`/api/restaurants/${owned.id}`), {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.json())
            .then((fullData) => {
              setRestaurant(fullData);
              fetchResources(owned.id);
              fetchPendingReservations();
            });
        }
      })
      .catch(() => {});
  };

  const fetchResources = (restaurantId: number) => {
    fetch(getApiUrl(`/api/restaurants/${restaurantId}/resources`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("resources endpoint not found");
        return res.json();
      })
      .then((data) => setResources(data))
      .catch(() => {
        fetch(getApiUrl(`/api/restaurants/${restaurantId}/tables`), {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) =>
            setResources(
              data.map((t: any) => ({ ...t, resource_type: "table" })),
            ),
          );
      });
  };

  const fetchPendingReservations = () => {
    if (!token) return;
    fetch(getApiUrl("/api/owner/reservations"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data))
          setPendingReservations(
            data.filter((r: any) => r.status === "pending"),
          );
      })
      .catch((err) => console.error("Reservation Fetch Error:", err));
  };

  useEffect(() => {
    fetchRestaurant();
    const interval = setInterval(fetchPendingReservations, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleAddResources = async () => {
    if (!restaurant) return;
    setLoading(true);
    try {
      const res = await fetch(
        getApiUrl(`/api/restaurants/${restaurant.id}/resources`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...newResource }),
        },
      );
      if (res.ok) {
        fetchResources(restaurant.id);
        setShowResourceForm(false);
        setNewResource({
          name: "",
          resource_type: "table",
          capacity: 2,
          location: "indoor",
          quantity: 1,
          shape: "square",
          min_booking_minutes: 30,
          max_booking_minutes: null,
          price_per_hour: 0,
          features: [],
        });
      } else {
        const legacyRes = await fetch(
          getApiUrl(`/api/restaurants/${restaurant.id}/tables`),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              capacity: newResource.capacity,
              location: newResource.location,
              quantity: newResource.quantity,
              shape: newResource.shape,
            }),
          },
        );
        if (legacyRes.ok) {
          fetchResources(restaurant.id);
          setShowResourceForm(false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResource = async (resourceId: number) => {
    Alert.alert(
      t("owner_dashboard.confirm_title"),
      t("owner_dashboard.confirm_remove_resource"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("owner_dashboard.remove"),
          style: "destructive",
          onPress: async () => {
            try {
              let res = await fetch(getApiUrl(`/api/resources/${resourceId}`), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok)
                res = await fetch(getApiUrl(`/api/tables/${resourceId}`), {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                });
              if (res.ok && restaurant) fetchResources(restaurant.id);
            } catch (err) {
              console.error(err);
            }
          },
        },
      ],
    );
  };

  const handleReservationAction = async (
    id: number,
    action: "confirm" | "reject",
  ) => {
    try {
      const res = await fetch(getApiUrl(`/api/reservations/${id}/${action}`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchPendingReservations();
    } catch (err) {
      console.error(err);
    }
  };

  if (!restaurant) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#7C8B6D" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {toast && (
        <View
          style={[
            styles.toastContainer,
            { top: insets.top + 16 },
            toast.type === "error" ? styles.toastError : styles.toastSuccess,
          ]}
          pointerEvents="none"
        >
          {toast.type === "success" ? (
            <Check size={14} color="white" strokeWidth={3} />
          ) : (
            <X size={14} color="white" strokeWidth={3} />
          )}
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 },
        ]}
      >
        {/* Header */}
        <View style={styles.headerOverlay}>
          <Image
            source={{
              uri:
                restaurant.background_url ||
                restaurant.images?.[0]?.url ||
                restaurant.logo_url,
            }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGradient} />

          <View style={[styles.topActions, { top: insets.top + 16 }]}>
            <View style={styles.row}>
              <View style={styles.ownerBadge}>
                <ChefHat size={20} color="white" />
                <Text style={styles.ownerBadgeText}>#{user?.id ?? ""}</Text>
              </View>
              {pendingReservations.length > 0 && (
                <View style={styles.pendingBadge}>
                  <View style={styles.redDot} />
                  <Text style={styles.pendingBadgeText}>
                    {pendingReservations.length}{" "}
                    {t("owner_dashboard.action_needed")}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() => {
                  fetchPendingReservations();
                  fetchRestaurant();
                }}
                style={styles.actionIcon}
              >
                <RefreshCw size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  logout();
                  navigation.navigate("Auth");
                }}
                style={styles.actionIconDanger}
              >
                <LogOut size={20} color="#ff4444" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerBottomInfo}>
            <TouchableOpacity
              onPress={() => pickImage("logo")}
              style={styles.logoContainer}
            >
              <Image
                source={{ uri: restaurant.logo_url }}
                style={styles.logoImage}
              />
              <View style={styles.logoOverlay}>
                <Plus size={20} color="white" />
              </View>
            </TouchableOpacity>
            <View>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <View style={styles.row}>
                <View style={styles.ratingBox}>
                  <Star size={12} fill="#eab308" color="#eab308" />
                  <Text style={styles.ratingText}>
                    {restaurant.rating} {t("owner_dashboard.rating_suffix")}
                  </Text>
                </View>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.categoryText}>
                  {restaurant.category || t("owner_dashboard.fine_dining")}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.mainContent}>
          {/* Pending Reservations */}
          {pendingReservations.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.cyanDot} />
                  <Text style={styles.sectionTitleCyan}>
                    {t("owner_dashboard.new_requests")} (
                    {pendingReservations.length})
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate("OwnerReservations")}
                >
                  <Text style={styles.viewAllText}>
                    {t("owner_dashboard.view_all")}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.requestsGrid}>
                {pendingReservations.map((res) => (
                  <View key={res.id} style={styles.requestCard}>
                    <View>
                      <Text style={styles.customerName}>
                        {res.customer_name}{" "}
                        {res.customer_surname ? res.customer_surname[0] : ""}.
                      </Text>
                      <View
                        style={[
                          styles.reliabilityBadge,
                          {
                            backgroundColor:
                              (res.reliability_score ?? 100) > 70
                                ? "#ecfdf5"
                                : (res.reliability_score ?? 100) > 40
                                  ? "#fffbeb"
                                  : "#fef2f2",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.reliabilityText,
                            {
                              color:
                                (res.reliability_score ?? 100) > 70
                                  ? "#059669"
                                  : (res.reliability_score ?? 100) > 40
                                    ? "#d97706"
                                    : "#ef4444",
                            },
                          ]}
                        >
                          ⚡ {String(res.reliability_score ?? 100)}
                        </Text>
                      </View>
                      <Text style={styles.requestDetails}>
                        {res.people_count} {t("owner_dashboard.people_bullet")}{" "}
                        • {res.start_time || res.time}
                        {res.end_time ? ` → ${res.end_time}` : ""}
                      </Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        onPress={() =>
                          handleReservationAction(res.id, "reject")
                        }
                        style={styles.rejectButton}
                      >
                        <X size={16} color="#ef4444" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          handleReservationAction(res.id, "confirm")
                        }
                        style={styles.confirmButton}
                      >
                        <Check size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.dashboardGrid}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("RestaurantDetail", { id: restaurant.id })
              }
              style={styles.quickActionButton}
            >
              <View style={styles.quickActionIcon}>
                <Eye size={20} color="rgba(45, 45, 45, 0.4)" />
              </View>
              <Text style={styles.quickActionText}>
                {t("owner_dashboard.preview_public_page")}
              </Text>
            </TouchableOpacity>

            {/* Phone Numbers Card */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t("owner_dashboard.phone_numbers_title")}
                </Text>
                {!editingPhone && (
                  <TouchableOpacity
                    onPress={() => setEditingPhone(true)}
                    style={styles.editIconBtn}
                  >
                    <Pencil size={14} color="white" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.cardPanel}>
                {!editingPhone ? (
                  <>
                    <View style={styles.phoneDisplayRow}>
                      <View style={styles.phoneLabelCol}>
                        <Text style={styles.phoneTypeLabel}>
                          {t("owner_dashboard.primary")}
                        </Text>
                        <View style={styles.phoneValueRow}>
                          <Phone size={14} color="#7C8B6D" />
                          <Text style={styles.phoneValue}>
                            {restaurant.phone_number || "—"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {!!restaurant.secondary_phone ? (
                      <View
                        style={[styles.phoneDisplayRow, styles.phoneRowBorder]}
                      >
                        <View style={styles.phoneLabelCol}>
                          <Text style={styles.phoneTypeLabel}>
                            {t("owner_dashboard.secondary")}
                          </Text>
                          <View style={styles.phoneValueRow}>
                            <Phone size={14} color="rgba(45,45,45,0.4)" />
                            <Text
                              style={[
                                styles.phoneValue,
                                { color: "rgba(45,45,45,0.6)" },
                              ]}
                            >
                              {restaurant.secondary_phone}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View
                        style={[styles.phoneDisplayRow, styles.phoneRowBorder]}
                      >
                        <Text style={styles.noSecondaryText}>
                          {t("owner_dashboard.no_secondary_number")}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.tinyLabel}>
                        {t("owner_dashboard.primary_phone_required_label")}
                      </Text>
                      <View style={styles.phoneEditRow}>
                        <Phone
                          size={14}
                          color="#7C8B6D"
                          style={{ marginLeft: 16 }}
                        />
                        <TextInput
                          style={styles.phoneEditInput}
                          placeholder={t("owner_dashboard.phone_placeholder")}
                          placeholderTextColor="rgba(45,45,45,0.3)"
                          keyboardType="phone-pad"
                          value={primaryPhone}
                          onChangeText={setPrimaryPhone}
                        />
                      </View>
                    </View>

                    {showSecondaryPhone ? (
                      <View style={styles.inputGroup}>
                        <View style={styles.secondaryLabelRow}>
                          <Text style={styles.tinyLabel}>
                            {t("owner_dashboard.secondary_phone_label")}
                          </Text>
                          <TouchableOpacity
                            onPress={handleDeleteSecondaryPhone}
                          >
                            <Text style={styles.deleteSecondaryText}>
                              {t("owner_dashboard.remove")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.phoneEditRow}>
                          <Phone
                            size={14}
                            color="rgba(45,45,45,0.4)"
                            style={{ marginLeft: 16 }}
                          />
                          <TextInput
                            style={styles.phoneEditInput}
                            placeholder={t("owner_dashboard.phone_placeholder")}
                            placeholderTextColor="rgba(45,45,45,0.3)"
                            keyboardType="phone-pad"
                            value={secondaryPhone}
                            onChangeText={setSecondaryPhone}
                          />
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setShowSecondaryPhone(true)}
                        style={styles.addSecondaryBtn}
                      >
                        <Plus size={14} color="#7C8B6D" />
                        <Text style={styles.addSecondaryText}>
                          {t("owner_dashboard.add_second_number")}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        onPress={handleCancelPhone}
                        style={styles.cardCancelBtn}
                      >
                        <Text style={styles.cardCancelText}>
                          {t("common.cancel")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSavePhone}
                        disabled={savingPhone}
                        style={styles.cardSaveBtn}
                      >
                        {savingPhone ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <>
                            <Save size={14} color="white" />
                            <Text style={styles.cardSaveText}>
                              {t("owner_dashboard.save")}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Average Price Range Card */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t("owner_dashboard.avg_price_range")}
                </Text>
                {!editingPriceRange && (
                  <TouchableOpacity
                    onPress={() => setEditingPriceRange(true)}
                    style={styles.editIconBtn}
                  >
                    <Pencil size={14} color="white" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.cardPanel}>
                {!editingPriceRange ? (
                  <View style={styles.phoneDisplayRow}>
                    <View style={styles.phoneLabelCol}>
                      <Text style={styles.phoneTypeLabel}>
                        {t("owner_dashboard.cost_per_person")}
                      </Text>
                      <View style={styles.phoneValueRow}>
                        <Wallet size={14} color="#7C8B6D" />
                        <Text style={styles.phoneValue}>
                          {minPrice || maxPrice
                            ? `${minPrice ?? "—"} - ${maxPrice ?? "—"} ֏`
                            : "—"}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.formDataRow}>
                      <View style={styles.formInputWrapper}>
                        <Text style={styles.tinyLabel}>
                          {t("owner_dashboard.min_price")}
                        </Text>
                        <TextInput
                          style={styles.formMiniInput}
                          keyboardType="numeric"
                          placeholder={t(
                            "owner_dashboard.price_placeholder_min",
                          )}
                          placeholderTextColor="rgba(45,45,45,0.3)"
                          value={minPrice !== null ? String(minPrice) : ""}
                          onChangeText={(text) =>
                            setMinPrice(text ? parseInt(text) : null)
                          }
                        />
                      </View>
                      <View style={styles.formInputWrapper}>
                        <Text style={styles.tinyLabel}>
                          {t("owner_dashboard.max_price")}
                        </Text>
                        <TextInput
                          style={styles.formMiniInput}
                          keyboardType="numeric"
                          placeholder={t(
                            "owner_dashboard.price_placeholder_max",
                          )}
                          placeholderTextColor="rgba(45,45,45,0.3)"
                          value={maxPrice !== null ? String(maxPrice) : ""}
                          onChangeText={(text) =>
                            setMaxPrice(text ? parseInt(text) : null)
                          }
                        />
                      </View>
                    </View>

                    <View style={styles.cardActionRow}>
                      <TouchableOpacity
                        onPress={handleCancelPriceRange}
                        style={styles.cardCancelBtn}
                      >
                        <Text style={styles.cardCancelText}>
                          {t("common.cancel")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSavePriceRange}
                        disabled={savingPriceRange}
                        style={styles.cardSaveBtn}
                      >
                        {savingPriceRange ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <>
                            <Save size={14} color="white" />
                            <Text style={styles.cardSaveText}>
                              {t("owner_dashboard.save")}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Gallery */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t("owner_dashboard.gallery")}
                </Text>
                <TouchableOpacity
                  onPress={() => pickImage("gallery")}
                  style={styles.addMediaButton}
                >
                  <Plus size={16} color="white" />
                </TouchableOpacity>
              </View>
              <View style={styles.mediaGrid}>
                {(restaurant.images || []).map((img: any, i: number) => (
                  <View key={i} style={styles.mediaCard}>
                    <Image
                      source={{ uri: img.url }}
                      style={styles.mediaImage}
                    />
                    <TouchableOpacity
                      onPress={() => handleDeleteImage(img.id)}
                      style={styles.mediaDeleteButton}
                    >
                      <X size={12} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => pickImage("gallery")}
                  style={styles.addMediaEmpty}
                >
                  <ImageIcon size={24} color="rgba(45, 45, 45, 0.4)" />
                  <Text style={styles.addMediaText}>
                    {loading
                      ? t("owner_dashboard.registering")
                      : t("owner_dashboard.add_photo")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Menu */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t("owner_dashboard.menu")}
                </Text>
                <TouchableOpacity
                  onPress={pickMenuImage}
                  style={styles.addMediaButton}
                >
                  {uploadingMenu ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Plus size={16} color="white" />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.mediaGrid}>
                {(restaurant.menuImages || []).map((img: any, i: number) => (
                  <View key={img.id || i} style={styles.mediaCard}>
                    <Image
                      source={{ uri: img.url }}
                      style={styles.mediaImage}
                    />
                    {!img.temp && (
                      <TouchableOpacity
                        onPress={() => handleDeleteImage(img.id)}
                        style={styles.mediaDeleteButton}
                      >
                        <X size={12} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  onPress={pickMenuImage}
                  style={styles.addMediaEmpty}
                >
                  <ImageIcon size={24} color="rgba(45, 45, 45, 0.4)" />
                  <Text style={styles.addMediaText}>
                    {uploadingMenu
                      ? t("owner_dashboard.uploading")
                      : t("owner_dashboard.add_menu_photo")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Resource / Floor Plan Management */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t("owner_dashboard.floor_plan")}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowResourceForm(!showResourceForm)}
                  style={styles.addTableButton}
                >
                  <Plus size={16} color="white" />
                </TouchableOpacity>
              </View>

              {showResourceForm && (
                <View style={styles.tableForm}>
                  <View style={styles.formInputWrapper}>
                    <Text style={styles.tinyLabel}>
                      {t("owner_dashboard.resource_name")}
                    </Text>
                    <TextInput
                      style={styles.formMiniInput}
                      placeholder={t(
                        "owner_dashboard.resource_name_placeholder",
                      )}
                      placeholderTextColor="rgba(45,45,45,0.3)"
                      value={newResource.name}
                      onChangeText={(text) =>
                        setNewResource({ ...newResource, name: text })
                      }
                    />
                  </View>

                  <View style={styles.formInputWrapper}>
                    <Text style={styles.tinyLabel}>
                      {t("owner_dashboard.resource_type")}
                    </Text>
                    <View style={styles.formTabRow}>
                      {RESOURCE_TYPES.map((rt) => (
                        <TouchableOpacity
                          key={rt.id}
                          onPress={() =>
                            setNewResource({
                              ...newResource,
                              resource_type: rt.id,
                            })
                          }
                          style={[
                            styles.formTab,
                            newResource.resource_type === rt.id &&
                              styles.formTabActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.formTabText,
                              newResource.resource_type === rt.id &&
                                styles.textWhite,
                            ]}
                          >
                            {rt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formDataRow}>
                    <View style={styles.formInputWrapper}>
                      <Text style={styles.tinyLabel}>
                        {t("owner_dashboard.capacity")}
                      </Text>
                      <TextInput
                        keyboardType="numeric"
                        style={styles.formMiniInput}
                        value={String(newResource.capacity)}
                        onChangeText={(text) =>
                          setNewResource({
                            ...newResource,
                            capacity: parseInt(text) || 1,
                          })
                        }
                      />
                    </View>
                    <View style={styles.formInputWrapper}>
                      <Text style={styles.tinyLabel}>
                        {t("owner_dashboard.quantity")}
                      </Text>
                      <TextInput
                        keyboardType="numeric"
                        style={styles.formMiniInput}
                        value={String(newResource.quantity)}
                        onChangeText={(text) =>
                          setNewResource({
                            ...newResource,
                            quantity: parseInt(text) || 1,
                          })
                        }
                      />
                    </View>
                  </View>

                  <View style={styles.formDataRow}>
                    <View style={styles.formInputWrapper}>
                      <Text style={styles.tinyLabel}>
                        {t("owner_dashboard.location")}
                      </Text>
                      <View style={styles.formTabRow}>
                        {["indoor", "outdoor"].map((loc) => (
                          <TouchableOpacity
                            key={loc}
                            onPress={() =>
                              setNewResource({ ...newResource, location: loc })
                            }
                            style={[
                              styles.formTab,
                              newResource.location === loc &&
                                styles.formTabActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.formTabText,
                                newResource.location === loc &&
                                  styles.textWhite,
                              ]}
                            >
                              {loc === "indoor"
                                ? t("owner_dashboard.indoor")
                                : t("owner_dashboard.outdoor")}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  {(newResource.resource_type === "table" ||
                    newResource.resource_type === "zone") && (
                    <View style={styles.formInputWrapper}>
                      <Text style={styles.tinyLabel}>
                        {t("owner_dashboard.shape")}
                      </Text>
                      <View style={styles.formIconTabRow}>
                        {[
                          { id: "round", icon: Circle },
                          { id: "square", icon: Square },
                          { id: "rectangular", icon: RectangleHorizontal },
                        ].map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            onPress={() =>
                              setNewResource({ ...newResource, shape: s.id })
                            }
                            style={[
                              styles.formIconTab,
                              newResource.shape === s.id &&
                                styles.formIconTabActive,
                            ]}
                          >
                            <s.icon
                              size={16}
                              color={
                                newResource.shape === s.id
                                  ? "white"
                                  : "rgba(45, 45, 45, 0.4)"
                              }
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.formDataRow}>
                    <View style={styles.formInputWrapper}>
                      <Text style={styles.tinyLabel}>
                        {t("owner_dashboard.min_booking")}
                      </Text>
                      <TextInput
                        keyboardType="numeric"
                        style={styles.formMiniInput}
                        value={String(newResource.min_booking_minutes)}
                        onChangeText={(text) =>
                          setNewResource({
                            ...newResource,
                            min_booking_minutes: parseInt(text) || 30,
                          })
                        }
                      />
                    </View>
                    <View style={styles.formInputWrapper}>
                      <Text style={styles.tinyLabel}>
                        {t("owner_dashboard.max_booking")}
                      </Text>
                      <TextInput
                        keyboardType="numeric"
                        style={styles.formMiniInput}
                        placeholder={t("owner_dashboard.no_limit")}
                        placeholderTextColor="rgba(45,45,45,0.3)"
                        value={
                          newResource.max_booking_minutes
                            ? String(newResource.max_booking_minutes)
                            : ""
                        }
                        onChangeText={(text) =>
                          setNewResource({
                            ...newResource,
                            max_booking_minutes: text ? parseInt(text) : null,
                          })
                        }
                      />
                    </View>
                  </View>

                  <View style={styles.formInputWrapper}>
                    <Text style={styles.tinyLabel}>
                      {t("owner_dashboard.price_per_hour")}
                    </Text>
                    <View style={styles.relativeInput}>
                      <TextInput
                        keyboardType="numeric"
                        style={styles.formMiniInput}
                        value={String(newResource.price_per_hour)}
                        onChangeText={(text) =>
                          setNewResource({
                            ...newResource,
                            price_per_hour: parseFloat(text) || 0,
                          })
                        }
                      />
                    </View>
                  </View>

                  <View style={styles.formActions}>
                    <TouchableOpacity
                      onPress={handleAddResources}
                      style={styles.confirmAddTable}
                    >
                      <Text style={styles.confirmAddTableText}>
                        {loading
                          ? t("common.saving")
                          : t("owner_dashboard.add_table")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowResourceForm(false)}
                      style={styles.cancelAddTable}
                    >
                      <Text style={styles.cancelAddTableText}>
                        {t("common.cancel")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.tablesGrid}>
                {resources.length === 0 ? (
                  <View style={styles.emptyGrid}>
                    <Text style={styles.emptyGridText}>
                      {t("owner_dashboard.no_resources")}
                    </Text>
                  </View>
                ) : (
                  resources.map((resource) => (
                    <View key={resource.id} style={styles.tableCard}>
                      <View style={styles.tableCardHeader}>
                        <ResourceShapeIcon resource={resource} />
                        <TouchableOpacity
                          onPress={() => handleDeleteResource(resource.id)}
                        >
                          <X size={12} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.tableCapacity}>
                        {resource.capacity} {t("owner_dashboard.seats")}
                      </Text>
                      <Text style={styles.tableLocation}>
                        {resource.resource_type !== "table"
                          ? resource.resource_type
                          : resource.location}
                      </Text>
                      {resource.price_per_hour > 0 && (
                        <Text style={styles.resourcePrice}>
                          ${resource.price_per_hour}
                          {t("owner_dashboard.per_hour_suffix")}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Restaurant Filters Card */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t("owner_dashboard.restaurant_filters_title")}
                </Text>
                {!editingFilters && (
                  <TouchableOpacity
                    onPress={() => setEditingFilters(true)}
                    style={styles.editIconBtn}
                  >
                    <Pencil size={14} color="white" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.cardPanel}>
                {!editingFilters ? (
                  <>
                    {filterExperienceTypes.length === 0 &&
                    filterAmenities.length === 0 &&
                    filterMoods.length === 0 ? (
                      <Text style={styles.noFiltersText}>
                        {t("owner_dashboard.no_filters_selected")}
                      </Text>
                    ) : (
                      <>
                        {filterExperienceTypes.length > 0 && (
                          <View style={styles.filterGroup}>
                            <Text style={styles.filterGroupLabel}>
                              {t("owner_dashboard.experience_label")}
                            </Text>
                            <View style={styles.chipRow}>
                              {filterExperienceTypes.map((f) => (
                                <View key={f} style={styles.chip}>
                                  <Text style={styles.chipText}>{f}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                        {filterAmenities.length > 0 && (
                          <View style={styles.filterGroup}>
                            <Text style={styles.filterGroupLabel}>
                              {t("owner_dashboard.amenities_label")}
                            </Text>
                            <View style={styles.chipRow}>
                              {filterAmenities.map((f) => (
                                <View key={f} style={styles.chip}>
                                  <Text style={styles.chipText}>{f}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                        {filterMoods.length > 0 && (
                          <View style={styles.filterGroup}>
                            <Text style={styles.filterGroupLabel}>
                              {t("owner_dashboard.best_for_label")}
                            </Text>
                            <View style={styles.chipRow}>
                              {filterMoods.map((f) => (
                                <View key={f} style={styles.chip}>
                                  <Text style={styles.chipText}>{f}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <View style={{ gap: 20 }}>
                      <View>
                        <Text style={styles.filterEditGroupTitle}>
                          {t("owner_dashboard.experience_types_title")}
                        </Text>
                        {Object.entries(EXPERIENCE_GROUPS).map(
                          ([group, items]) => (
                            <View key={group} style={{ marginBottom: 12 }}>
                              <SubLabel label={group} />
                              <MultiSelectPills
                                options={items}
                                selected={filterExperienceTypes}
                                onToggle={(val) =>
                                  setFilterExperienceTypes((prev) =>
                                    prev.includes(val)
                                      ? prev.filter((x) => x !== val)
                                      : [...prev, val],
                                  )
                                }
                              />
                            </View>
                          ),
                        )}
                      </View>
                      <View>
                        <Text style={styles.filterEditGroupTitle}>
                          {t("owner_dashboard.amenities_label")}
                        </Text>
                        <MultiSelectPills
                          options={AMENITIES}
                          selected={filterAmenities}
                          onToggle={(val) =>
                            setFilterAmenities((prev) =>
                              prev.includes(val)
                                ? prev.filter((x) => x !== val)
                                : [...prev, val],
                            )
                          }
                        />
                      </View>
                      <View>
                        <Text style={styles.filterEditGroupTitle}>
                          {t("owner_dashboard.best_for_label")}
                        </Text>
                        <MultiSelectPills
                          options={MOODS}
                          selected={filterMoods}
                          onToggle={(val) =>
                            setFilterMoods((prev) =>
                              prev.includes(val)
                                ? prev.filter((x) => x !== val)
                                : [...prev, val],
                            )
                          }
                        />
                      </View>
                    </View>

                    <View style={[styles.cardActionRow, { marginTop: 20 }]}>
                      <TouchableOpacity
                        onPress={handleCancelFilters}
                        style={styles.cardCancelBtn}
                      >
                        <Text style={styles.cardCancelText}>
                          {t("common.cancel")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveFilters}
                        disabled={savingFilters}
                        style={styles.cardSaveBtn}
                      >
                        {savingFilters ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <>
                            <Save size={14} color="white" />
                            <Text style={styles.cardSaveText}>
                              {t("owner_dashboard.save_filters")}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Location Card */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t("owner_dashboard.location")}
                </Text>
                {!editingLocation ? (
                  <TouchableOpacity
                    onPress={() => setEditingLocation(true)}
                    style={styles.editIconBtn}
                  >
                    <Pencil size={14} color="white" />
                  </TouchableOpacity>
                ) : (
                  <MapPin size={16} color="rgba(45, 45, 45, 0.4)" />
                )}
              </View>

              {!editingLocation ? (
                <View style={styles.mapCard}>
                  <RestaurantMap location={restaurant.location} />
                  <View style={styles.mapInfo}>
                    <Text style={styles.mapAddress} numberOfLines={1}>
                      {restaurant.location}
                    </Text>
                    {!!restaurant.latitude && !!restaurant.longitude && (
                      <Text style={styles.mapCoords}>
                        {Number(restaurant.latitude).toFixed(5)},{" "}
                        {Number(restaurant.longitude).toFixed(5)}
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.cardPanel}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.tinyLabel}>
                      {t("owner_dashboard.address_label")}
                    </Text>
                    <TextInput
                      style={styles.formMiniInput}
                      placeholder={t("owner_dashboard.address_placeholder")}
                      placeholderTextColor="rgba(45,45,45,0.3)"
                      value={locationAddress}
                      onChangeText={setLocationAddress}
                    />
                  </View>

                  <View style={styles.formDataRow}>
                    <View style={styles.formInputWrapper}>
                      <Text style={styles.tinyLabel}>
                        {t("owner_dashboard.latitude_label")}
                      </Text>
                      <TextInput
                        style={styles.formMiniInput}
                        keyboardType="numeric"
                        placeholder={t("owner_dashboard.lat_placeholder")}
                        placeholderTextColor="rgba(45,45,45,0.3)"
                        value={locationLat !== null ? String(locationLat) : ""}
                        onChangeText={(text) =>
                          setLocationLat(text ? parseFloat(text) : null)
                        }
                      />
                    </View>
                    <View style={styles.formInputWrapper}>
                      <Text style={styles.tinyLabel}>
                        {t("owner_dashboard.longitude_label")}
                      </Text>
                      <TextInput
                        style={styles.formMiniInput}
                        keyboardType="numeric"
                        placeholder={t("owner_dashboard.lng_placeholder")}
                        placeholderTextColor="rgba(45,45,45,0.3)"
                        value={locationLng !== null ? String(locationLng) : ""}
                        onChangeText={(text) =>
                          setLocationLng(text ? parseFloat(text) : null)
                        }
                      />
                    </View>
                  </View>

                  <View
                    style={{
                      borderRadius: 20,
                      overflow: "hidden",
                      marginTop: 4,
                    }}
                  >
                    <Text style={[styles.tinyLabel, { marginBottom: 8 }]}>
                      {t("owner_dashboard.tap_drag_pin")}
                    </Text>
                    <EditableLocationMap
                      lat={locationLat ?? 40.1792}
                      lng={locationLng ?? 44.4991}
                      onLocationChange={(lat, lng) => {
                        setLocationLat(parseFloat(lat.toFixed(6)));
                        setLocationLng(parseFloat(lng.toFixed(6)));
                      }}
                    />
                  </View>

                  <View style={styles.cardActionRow}>
                    <TouchableOpacity
                      onPress={handleCancelLocation}
                      style={styles.cardCancelBtn}
                    >
                      <Text style={styles.cardCancelText}>
                        {t("common.cancel")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveLocation}
                      disabled={savingLocation}
                      style={styles.cardSaveBtn}
                    >
                      {savingLocation ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Save size={14} color="white" />
                          <Text style={styles.cardSaveText}>
                            {t("owner_dashboard.save_location")}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FDFCFB" },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#FDFCFB",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {},
  row: { flexDirection: "row", gap: 12 },
  inputGroup: { gap: 8 },
  relativeInput: { position: "relative" },
  textWhite: { color: "white" },
  toastContainer: {
    position: "absolute",
    left: 24,
    right: 24,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
  },
  toastSuccess: { backgroundColor: "#7C8B6D" },
  toastError: { backgroundColor: "#ef4444" },
  toastText: {
    fontSize: 11,
    fontWeight: "900",
    color: "white",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flex: 1,
  },
  headerOverlay: { height: 400, position: "relative" },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  topActions: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ownerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  ownerBadgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "900",
    opacity: 0.8,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ef4444",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  redDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "white" },
  pendingBadgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actionIcon: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconDanger: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBottomInfo: {
    position: "absolute",
    bottom: 30,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: "white",
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logoImage: { width: "100%", height: "100%", resizeMode: "contain" },
  logoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
  },
  restaurantName: {
    fontSize: 32,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.white,
    textTransform: "uppercase",
    letterSpacing: -1,
  },
  ratingBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: {
    color: "white",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bullet: { color: "white", opacity: 0.3, fontSize: 12 },
  categoryText: {
    color: "white",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    opacity: 0.8,
  },
  mainContent: { padding: 24, gap: 32 },
  section: { gap: 16 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cyanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accentBlue,
  },
  sectionTitleCyan: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.accentBlue,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  viewAllText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    textDecorationLine: "underline",
  },
  requestsGrid: { gap: 12 },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(124, 139, 109, 0.05)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(124, 139, 109, 0.1)",
    padding: 20,
  },
  customerName: {
    fontSize: 18,
    fontFamily: theme.fonts.inriaSerif,
    color: theme.colors.charcoal,
  },
  reliabilityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  reliabilityText: { fontSize: 10, fontWeight: "900" },
  requestDetails: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    marginTop: 2,
  },
  requestActions: { flexDirection: "row", gap: 10 },
  rejectButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#7C8B6D",
    alignItems: "center",
    justifyContent: "center",
  },
  dashboardGrid: { gap: 40 },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: theme.colors.white,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.premium,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(45, 45, 45, 0.03)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  addMediaButton: { padding: 10, backgroundColor: "#2D2D2D", borderRadius: 14 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  mediaCard: {
    width: (width - 60) / 2,
    height: 160,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  mediaImage: { width: "100%", height: "100%", resizeMode: "cover" },
  mediaDeleteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  addMediaEmpty: {
    width: (width - 60) / 2,
    height: 160,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.1)",
    backgroundColor: "rgba(0,0,0,0.02)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addMediaText: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  addTableButton: { padding: 10, backgroundColor: "#7C8B6D", borderRadius: 14 },
  tableForm: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  formDataRow: { flexDirection: "row", gap: 12 },
  formInputWrapper: { flex: 1, gap: 8 },
  tinyLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    marginLeft: 12,
    letterSpacing: 1,
  },
  formMiniInput: {
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    fontWeight: "bold",
    color: "#2D2D2D",
  },
  formTabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 16,
    padding: 4,
  },
  formTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
  },
  formTabActive: { backgroundColor: "#7C8B6D" },
  formTabText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "rgba(45, 45, 45, 0.6)",
  },
  formIconTabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  formIconTab: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  formIconTabActive: { backgroundColor: "#2D2D2D" },
  formActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  confirmAddTable: {
    flex: 2,
    height: 54,
    backgroundColor: "#2D2D2D",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmAddTableText: {
    color: "white",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cancelAddTable: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelAddTableText: {
    color: "rgba(45, 45, 45, 0.4)",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tablesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  emptyGrid: {
    flex: 1,
    paddingVertical: 40,
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 32,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyGridText: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
  },
  tableCard: {
    width: (width - 78) / 4,
    aspectRatio: 1,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  tableCardHeader: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tableCapacity: {
    fontSize: 12,
    fontWeight: "900",
    color: "#2D2D2D",
    textAlign: "center",
  },
  tableLocation: {
    fontSize: 7,
    fontWeight: "900",
    color: "rgba(45, 45, 45, 0.4)",
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 2,
  },
  resourcePrice: {
    fontSize: 7,
    fontWeight: "900",
    color: "#7C8B6D",
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 1,
  },
  mapCard: {
    height: 240,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  mapContainer: { flex: 1 },
  webViewMap: { flex: 1 },
  editableMapContainer: { height: 240, borderRadius: 20, overflow: "hidden" },
  editableMapWebView: { flex: 1 },
  mapInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  mapAddress: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mapCoords: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(45,45,45,0.4)",
    marginTop: 2,
  },
  cardPanel: {
    backgroundColor: "white",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  editIconBtn: { padding: 10, backgroundColor: "#2D2D2D", borderRadius: 14 },
  cardActionRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  cardCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardCancelText: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(45,45,45,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardSaveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#7C8B6D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cardSaveText: {
    fontSize: 11,
    fontWeight: "900",
    color: "white",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  phoneDisplayRow: { paddingVertical: 4 },
  phoneRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    paddingTop: 16,
    marginTop: 4,
  },
  phoneLabelCol: { gap: 6 },
  phoneTypeLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(45,45,45,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  phoneValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  phoneValue: { fontSize: 16, fontWeight: "700", color: "#2D2D2D" },
  noSecondaryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(45,45,45,0.3)",
    fontStyle: "italic",
  },
  phoneEditRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 16,
    gap: 8,
  },
  phoneEditInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 15,
    fontWeight: "700",
    color: "#2D2D2D",
  },
  secondaryLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  deleteSecondaryText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#ef4444",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  addSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(124,139,109,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(124,139,109,0.3)",
  },
  addSecondaryText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#7C8B6D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  noFiltersText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(45,45,45,0.35)",
    textAlign: "center",
    paddingVertical: 12,
    fontStyle: "italic",
  },
  filterGroup: { gap: 8 },
  filterGroupLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(45,45,45,0.4)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(124,139,109,0.1)",
    borderWidth: 1,
    borderColor: "rgba(124,139,109,0.2)",
  },
  chipText: { fontSize: 11, fontWeight: "700", color: "#7C8B6D" },
  filterEditGroupTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#2D2D2D",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "rgba(45,45,45,0.4)",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 4,
  },
  pillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillActive: { backgroundColor: "#7C8B6D", borderColor: "#7C8B6D" },
  pillText: { fontSize: 11, fontWeight: "700", color: "#2D2D2D" },
  pillTextActive: { color: "white" },
});
