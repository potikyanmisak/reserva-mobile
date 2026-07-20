import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../lib/AuthContext";
import { getApiUrl } from "../../lib/api";
import OwnerApplication from "./Application";

type ApplicationStatus = null | "pending" | false;

/**
 * OwnerGate decides, BEFORE the owner ever reaches OwnerTabs, whether
 * they have an approved restaurant or need to apply. It's registered as
 * its own top-level Stack.Screen in App.tsx (a sibling of "OwnerMain",
 * not nested inside it), so it never renders with the bottom tab bar —
 * the application flow is a completely separate, chrome-free page.
 */
export default function OwnerGate() {
  const navigation = useNavigation<any>();
  const { user, token } = useAuth();
  const [applicationStatus, setApplicationStatus] =
    useState<ApplicationStatus>(null);
  const [checked, setChecked] = useState(false);

  const checkStatus = () => {
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
          // Owner already has an approved restaurant — go straight to
          // the normal tabbed app, skipping the application page entirely.
          navigation.replace("OwnerMain");
          return;
        }
        fetch(getApiUrl("/api/owner/application-status"), {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((appData) => {
            if (appData && appData.status === "pending") {
              setApplicationStatus("pending");
            } else {
              setApplicationStatus(false);
            }
            setChecked(true);
          })
          .catch(() => {
            setApplicationStatus(false);
            setChecked(true);
          });
      })
      .catch(() => {
        setApplicationStatus(false);
        setChecked(true);
      });
  };

  useEffect(() => {
    checkStatus();
  }, [user]);

  if (!checked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FDFCFB",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#7C8B6D" />
      </View>
    );
  }

  return (
    <OwnerApplication
      applicationStatus={applicationStatus}
      onSubmitted={() => {
        setApplicationStatus("pending");
      }}
    />
  );
}
