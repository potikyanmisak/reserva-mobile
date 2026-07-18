import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/AuthContext";
import {
  Mail,
  Lock,
  User as UserIcon,
  UserPlus,
  LogIn,
  CheckCircle2,
  RefreshCw,
  Plus,
  Camera,
  ChefHat,
  Phone,
} from "lucide-react-native";
import { theme } from "../theme";

const { width } = Dimensions.get("window");

import { getApiUrl } from "../lib/api";

const EMPTY_LOGIN = { email: "", password: "" };
const EMPTY_SIGNUP = {
  email: "",
  password: "",
  confirmPassword: "",
  name: "",
  surname: "",
  phone: "",
};

export default function AuthPage() {
  const insets = useSafeAreaInsets();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<"customer" | "owner">("customer");

  // Separate state per form — Sign In and Sign Up no longer share fields.
  const [loginData, setLoginData] = useState(EMPTY_LOGIN);
  const [signupData, setSignupData] = useState(EMPTY_SIGNUP);
  // Multi-step signup: details (name/surname/phone/email) -> [verify code] -> password
  const [signupStage, setSignupStage] = useState<"details" | "password">(
    "details",
  );

    const [forgotEmail, setForgotEmail] = useState("");
    const [tempResetAuth, setTempResetAuth] = useState<any>(null);
    const [resetPasswordData, setResetPasswordData] = useState({
      password: "",
      confirmPassword: "",
    });

  const [step, setStep] = useState(1);
  const [verificationCode, setVerificationCode] = useState("");
  const [timer, setTimer] = useState(60);
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [tempAuth, setTempAuth] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Whichever form is currently active — used for verification screen, etc.
 const activeEmail =
   step === 4 || step === 5 || step === 6
     ? forgotEmail
     : isLogin
       ? loginData.email
       : signupData.email;

  const hasMinLength = signupData.password.length >= 8;
  const hasNumber = /\d/.test(signupData.password);
  const isPasswordValid = hasMinLength && hasNumber;

  useEffect(() => {
    let interval: any;
    if ((step === 2 || step === 5) && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setError("");
    // Each form keeps its own state, so there's nothing to clear here —
    // but we do reset transient UI state tied to the form being left.
    setPasswordTouched(false);
    setSignupStage("details");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    const endpoint = isLogin
      ? getApiUrl("/api/login")
      : getApiUrl("/api/register");
    const body = isLogin
      ? { email: loginData.email, password: loginData.password }
      : { ...signupData, role, verified: true };

    try {
      if (!isLogin) {
        if (!isPasswordValid) {
          setError(
            "Password must be at least 8 characters and contain a number.",
          );
          setLoading(false);
          return;
        }
        if (signupData.password !== signupData.confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.unverified) {
          // Safety net — shouldn't normally trigger since we verify
          // the email before ever reaching this password stage.
          setStep(2);
          setTimer(0);
          setLoading(false);
          return;
        }
        throw new Error(data.error);
      }

      if (isLogin) {
        login(data.token, data.user);
      } else if (role === "customer") {
        setTempAuth(data);
        setStep(3);
        setLoading(false);
      } else {
        // Owner: no photo step, go straight in.
        login(data.token, data.user);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleDetailsNext = async () => {
    setError("");

    if (role === "customer") {
      if (!signupData.name.trim() || !signupData.surname.trim()) {
        setError("Name and Surname are required.");
        return;
      }
      const digitsOnly = signupData.phone.replace(/\D/g, "");
      if (!signupData.phone.trim() || digitsOnly.length < 6) {
        setError("Please enter a valid phone number.");
        return;
      }
    }

    if (!signupData.email.trim()) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    try {
      // Send the verification code up front, before password is collected.
      const res = await fetch(getApiUrl("/api/auth/send-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signupData.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep(2);
      setTimer(60);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Could not send verification code.");
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter 6 digits");
      return;
    }
    setLoading(true);
    setError("");

    const isResetFlow = step === 5;

    try {
      const endpoint = isResetFlow
        ? getApiUrl("/api/auth/verify-reset-code")
        : getApiUrl("/api/verify");

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: activeEmail, code: verificationCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (isResetFlow) {
        setTempResetAuth(data);
        setResetPasswordData({ password: "", confirmPassword: "" });
        setStep(6);
        setVerificationCode("");
        setLoading(false);
      } else if (!isLogin) {
        setSignupStage("password");
        setStep(1);
        setVerificationCode("");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    const hasLen = resetPasswordData.password.length >= 8;
    const hasNum = /\d/.test(resetPasswordData.password);
    if (!hasLen || !hasNum) {
      setError("Password must be at least 8 characters and contain a number.");
      return;
    }
    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!tempResetAuth) return;

    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/user/reset-password"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempResetAuth.token}`,
        },
        body: JSON.stringify({ password: resetPasswordData.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      login(tempResetAuth.token, tempResetAuth.user);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setLoading(true);
    setError("");
    try {
      const endpoint =
        step === 5
          ? getApiUrl("/api/auth/forgot-password")
          : getApiUrl("/api/auth/send-code");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: activeEmail }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setTimer(60);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    if (!forgotEmail.trim()) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep(5);
      setTimer(60);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleFinishProfile = async (photoUrl: string | null) => {
    if (!tempAuth) return;
    setLoading(true);

    const finalPhoto =
      photoUrl || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

    try {
      const res = await fetch(getApiUrl("/api/user/update-photo"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempAuth.token}`,
        },
        body: JSON.stringify({ photo_url: finalPhoto }),
      });

      if (!res.ok) throw new Error("Failed to update photo");

      login(tempAuth.token, { ...tempAuth.user, photo_url: finalPhoto });
    } catch (err: any) {
      login(tempAuth.token, tempAuth.user);
    }
  };

  if (step === 3) {
    return (
      <View style={styles.container}>
        <View style={styles.authCard}>
          <View style={styles.iconCircle}>
            <Camera color={theme.colors.charcoal} size={32} />
          </View>
          <Text style={styles.title}>Add Profile Photo</Text>
          <Text style={styles.subtitle}>
            Personalize your account so others can recognize you.
          </Text>

          <View style={styles.photoContainer}>
            <View style={styles.photoFrame}>
              {selectedPhoto ? (
                <Image
                  source={{ uri: selectedPhoto }}
                  style={styles.profileImage}
                />
              ) : (
                <UserIcon
                  color={theme.colors.textDim}
                  size={64}
                  strokeWidth={1}
                />
              )}
            </View>
            <Pressable style={styles.addPhotoFab}>
              <Plus color={theme.colors.white} size={20} />
            </Pressable>
          </View>

          <View style={{ width: "100%", gap: 16 }}>
            <Pressable
              onPress={() => handleFinishProfile(selectedPhoto)}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {loading
                  ? "Saving..."
                  : selectedPhoto
                    ? "Save & Continue"
                    : "Save Photo"}
              </Text>
            </Pressable>
            <Pressable onPress={() => handleFinishProfile(null)}>
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (step === 4) {
    return (
      <View style={styles.container}>
        <View style={styles.authCard}>
          <View style={styles.iconCircle}>
            <Mail color={theme.colors.charcoal} size={32} />
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter the email associated with your account and we'll send you a
            code.
          </Text>

          <View style={{ width: "100%", gap: 24 }}>
            <Input
              icon={<Mail size={18} color={theme.colors.textDim} />}
              placeholder="Email"
              keyboardType="email-address"
              value={forgotEmail}
              onChangeText={setForgotEmail}
            />

            {error ? <Text style={styles.errorTextCenter}>{error}</Text> : null}

            <Pressable
              onPress={handleForgotPassword}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Send Code</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                setStep(1);
                setError("");
              }}
            >
              <Text style={styles.backText}>Back to Sign In</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (step === 6) {
    const hasLen = resetPasswordData.password.length >= 8;
    const hasNum = /\d/.test(resetPasswordData.password);
    return (
      <View style={styles.container}>
        <View style={styles.authCard}>
          <View style={styles.iconCircle}>
            <Lock color={theme.colors.charcoal} size={32} />
          </View>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>
            Choose a new password for your account.
          </Text>

          <View style={{ width: "100%", gap: 16 }}>
            <Input
              icon={<Lock size={18} color={theme.colors.textDim} />}
              placeholder="New Password"
              secureTextEntry
              value={resetPasswordData.password}
              onChangeText={(val) =>
                setResetPasswordData({ ...resetPasswordData, password: val })
              }
            />
            <Input
              icon={<Lock size={18} color={theme.colors.textDim} />}
              placeholder="Confirm New Password"
              secureTextEntry
              value={resetPasswordData.confirmPassword}
              onChangeText={(val) =>
                setResetPasswordData({
                  ...resetPasswordData,
                  confirmPassword: val,
                })
              }
            />

            {resetPasswordData.password.length > 0 && (
              <View style={styles.passwordHints}>
                <View style={styles.hintRow}>
                  <View
                    style={[
                      styles.hintDot,
                      hasLen
                        ? { backgroundColor: "#16a34a" }
                        : { backgroundColor: theme.colors.red },
                    ]}
                  />
                  <Text
                    style={[
                      styles.hintText,
                      { color: hasLen ? "#16a34a" : theme.colors.red },
                    ]}
                  >
                    At least 8 characters
                  </Text>
                </View>
                <View style={styles.hintRow}>
                  <View
                    style={[
                      styles.hintDot,
                      hasNum
                        ? { backgroundColor: "#16a34a" }
                        : { backgroundColor: theme.colors.red },
                    ]}
                  />
                  <Text
                    style={[
                      styles.hintText,
                      { color: hasNum ? "#16a34a" : theme.colors.red },
                    ]}
                  >
                    Contains numbers
                  </Text>
                </View>
              </View>
            )}

            {error ? <Text style={styles.errorTextCenter}>{error}</Text> : null}

            <Pressable
              onPress={handleResetPassword}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Save Password</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (step === 2 || step === 5) {
    const isReset = step === 5;
    return (
      <View style={styles.container}>
        <View style={styles.authCard}>
          <View style={styles.iconCircle}>
            {isReset ? (
              <RefreshCw color={theme.colors.charcoal} size={32} />
            ) : (
              <Mail color={theme.colors.charcoal} size={32} />
            )}
          </View>
          <Text style={styles.title}>
            {isReset ? "Login Code" : "Check your email"}
          </Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{"\n"}
            <Text style={{ color: theme.colors.charcoal, fontWeight: "500" }}>
              {activeEmail}
            </Text>
          </Text>

          <View style={{ width: "100%", gap: 24 }}>
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              maxLength={6}
              keyboardType="number-pad"
              value={verificationCode}
              onChangeText={(val) =>
                setVerificationCode(val.replace(/\D/g, ""))
              }
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleVerify}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {loading
                  ? "Verifying..."
                  : isReset
                    ? "Verify Code"
                    : "Verify & Continue"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            {timer > 0 ? (
              <Text style={styles.timerText}>
                Resend code in{" "}
                <Text
                  style={{ color: theme.colors.charcoal, fontWeight: "700" }}
                >
                  {timer}s
                </Text>
              </Text>
            ) : (
              <Pressable onPress={handleResend} style={styles.resendButton}>
                <RefreshCw size={14} color={theme.colors.charcoal} />
                <Text style={styles.resendText}>Resend Code</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                setStep(1);
                setVerificationCode("");
                setError("");
              }}
            >
              <Text style={styles.backText}>Back to Sign In</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>RESERVA</Text>
          <Text style={styles.tagline}>Fine dining, simplified.</Text>
        </View>

        <View style={styles.authCard}>
          <View style={styles.tabs}>
            <Pressable
              onPress={() => switchTab(true)}
              style={[styles.tab, isLogin && styles.activeTab]}
            >
              <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchTab(false)}
              style={[styles.tab, !isLogin && styles.activeTab]}
            >
              <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>
                Sign Up
              </Text>
            </Pressable>
          </View>

          {isLogin ? (
            <View style={styles.form}>
              <Input
                icon={<Mail size={18} color={theme.colors.textDim} />}
                placeholder="Email"
                keyboardType="email-address"
                value={loginData.email}
                onChangeText={(val) =>
                  setLoginData({ ...loginData, email: val })
                }
              />
              <Input
                icon={<Lock size={18} color={theme.colors.textDim} />}
                placeholder="Password"
                secureTextEntry
                value={loginData.password}
                onChangeText={(val) =>
                  setLoginData({ ...loginData, password: val })
                }
              />

              <Pressable
                onPress={() => {
                  setForgotEmail(loginData.email);
                  setError("");
                  setStep(4);
                }}
                style={styles.forgotPassword}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </Pressable>

              {error ? (
                <Text style={styles.errorTextCenter}>{error}</Text>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <View style={styles.buttonContent}>
                    <LogIn size={20} color={theme.colors.white} />
                    <Text style={styles.primaryButtonText}>Sign In</Text>
                  </View>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              {signupStage === "details" && (
                <>
                  <View style={styles.roleGrid}>
                    <Pressable
                      onPress={() => setRole("customer")}
                      style={[
                        styles.roleButton,
                        role === "customer" && styles.activeRoleButton,
                      ]}
                    >
                      <UserIcon
                        color={
                          role === "customer"
                            ? theme.colors.oliveMuted
                            : theme.colors.textDim
                        }
                      />
                      <Text
                        style={[
                          styles.roleText,
                          role === "customer" && styles.activeRoleText,
                        ]}
                      >
                        Customer
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setRole("owner")}
                      style={[
                        styles.roleButton,
                        role === "owner" && styles.activeRoleButton,
                      ]}
                    >
                      <ChefHat
                        color={
                          role === "owner"
                            ? theme.colors.oliveMuted
                            : theme.colors.textDim
                        }
                      />
                      <Text
                        style={[
                          styles.roleText,
                          role === "owner" && styles.activeRoleText,
                        ]}
                      >
                        Owner
                      </Text>
                    </Pressable>
                  </View>

                  {role === "customer" && (
                    <>
                      <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Input
                            icon={
                              <UserIcon
                                size={18}
                                color={theme.colors.textDim}
                              />
                            }
                            placeholder="Name"
                            value={signupData.name}
                            onChangeText={(val) =>
                              setSignupData({ ...signupData, name: val })
                            }
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            icon={
                              <UserIcon
                                size={18}
                                color={theme.colors.textDim}
                              />
                            }
                            placeholder="Surname"
                            value={signupData.surname}
                            onChangeText={(val) =>
                              setSignupData({ ...signupData, surname: val })
                            }
                          />
                        </View>
                      </View>

                      <Input
                        icon={<Phone size={18} color={theme.colors.textDim} />}
                        placeholder="Phone Number"
                        keyboardType="phone-pad"
                        value={signupData.phone}
                        onChangeText={(val) =>
                          setSignupData({ ...signupData, phone: val })
                        }
                      />

                      <Input
                        icon={<Mail size={18} color={theme.colors.textDim} />}
                        placeholder="Email"
                        keyboardType="email-address"
                        value={signupData.email}
                        onChangeText={(val) =>
                          setSignupData({ ...signupData, email: val })
                        }
                      />
                    </>
                  )}

                  {role === "owner" && (
                    <Input
                      icon={<Mail size={18} color={theme.colors.textDim} />}
                      placeholder="Email"
                      keyboardType="email-address"
                      value={signupData.email}
                      onChangeText={(val) =>
                        setSignupData({ ...signupData, email: val })
                      }
                    />
                  )}

                  {error ? (
                    <Text style={styles.errorTextCenter}>{error}</Text>
                  ) : null}

                  <Pressable
                    onPress={handleDetailsNext}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && { transform: [{ scale: 0.95 }] },
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color={theme.colors.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Next</Text>
                    )}
                  </Pressable>
                </>
              )}

              {signupStage === "password" && (
                <>
                  <Input
                    icon={<Lock size={18} color={theme.colors.textDim} />}
                    placeholder="Password"
                    secureTextEntry
                    value={signupData.password}
                    onChangeText={(val) => {
                      setSignupData({ ...signupData, password: val });
                      if (!passwordTouched && val.length > 0)
                        setPasswordTouched(true);
                    }}
                  />

                  <Input
                    icon={<Lock size={18} color={theme.colors.textDim} />}
                    placeholder="Confirm Password"
                    secureTextEntry
                    value={signupData.confirmPassword}
                    onChangeText={(val) =>
                      setSignupData({ ...signupData, confirmPassword: val })
                    }
                  />

                  {passwordTouched && (
                    <View style={styles.passwordHints}>
                      <View style={styles.hintRow}>
                        <View
                          style={[
                            styles.hintDot,
                            hasMinLength
                              ? { backgroundColor: "#16a34a" }
                              : { backgroundColor: theme.colors.red },
                          ]}
                        />
                        <Text
                          style={[
                            styles.hintText,
                            {
                              color: hasMinLength
                                ? "#16a34a"
                                : theme.colors.red,
                            },
                          ]}
                        >
                          At least 8 characters
                        </Text>
                      </View>
                      <View style={styles.hintRow}>
                        <View
                          style={[
                            styles.hintDot,
                            hasNumber
                              ? { backgroundColor: "#16a34a" }
                              : { backgroundColor: theme.colors.red },
                          ]}
                        />
                        <Text
                          style={[
                            styles.hintText,
                            { color: hasNumber ? "#16a34a" : theme.colors.red },
                          ]}
                        >
                          Contains numbers
                        </Text>
                      </View>
                    </View>
                  )}

                  {error ? (
                    <Text style={styles.errorTextCenter}>{error}</Text>
                  ) : null}

                  <Pressable
                    onPress={handleSubmit}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && { transform: [{ scale: 0.95 }] },
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color={theme.colors.white} />
                    ) : (
                      <View style={styles.buttonContent}>
                        <UserPlus size={20} color={theme.colors.white} />
                        <Text style={styles.primaryButtonText}>
                          Get Started
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setSignupStage("details");
                      setError("");
                    }}
                  >
                    <Text style={styles.backText}>Back</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Input({ icon, ...props }: any) {
  return (
    <View style={styles.inputWrapper}>
      <View style={styles.inputIcon}>{icon}</View>
      <TextInput
        style={styles.input}
        placeholderTextColor={theme.colors.textDim + "80"}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgBase,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scrollContent: {
    paddingVertical: 40,
    alignItems: "center",
    width: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontFamily: theme.fonts.inriaSerif,
    letterSpacing: -2,
    color: theme.colors.charcoal,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.textDim,
    textTransform: "uppercase",
  },
  authCard: {
    backgroundColor: theme.colors.white,
    padding: 32,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    width: width - 48,
    alignSelf: "center",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#F5EEE7",
    padding: 4,
    borderRadius: 16,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  activeTab: {
    backgroundColor: theme.colors.oliveAccent,
    ...theme.shadows.soft,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: theme.colors.textDim,
  },
  activeTabText: {
    color: theme.colors.white,
  },
  form: {
    gap: 16,
  },
  roleGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.glassBorder,
    alignItems: "center",
  },
  activeRoleButton: {
    borderColor: theme.colors.oliveMuted,
    backgroundColor: theme.colors.oliveMuted + "0D",
  },
  roleText: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    color: theme.colors.textDim,
  },
  activeRoleText: {
    color: theme.colors.oliveMuted,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  inputWrapper: {
    position: "relative",
    width: "100%",
  },
  inputIcon: {
    position: "absolute",
    left: 16,
    top: "50%",
    marginTop: -9,
    zIndex: 1,
  },
  input: {
    width: "100%",
    backgroundColor: "#F5EEE7",
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    paddingVertical: 16,
    paddingLeft: 48,
    paddingRight: 16,
    borderRadius: 20,
    fontSize: 14,
    color: theme.colors.charcoal,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
  },
  forgotPasswordText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  passwordHints: {
    marginTop: 8,
    paddingLeft: 16,
    gap: 8,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hintText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  errorTextCenter: {
    textAlign: "center",
    color: theme.colors.red,
    fontSize: 12,
    fontWeight: "500",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: theme.colors.charcoal,
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.premium,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    backgroundColor: theme.colors.accentGray,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: theme.fonts.inriaSerif,
    textAlign: "center",
    color: theme.colors.charcoal,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textDim,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  photoContainer: {
    position: "relative",
    width: 144,
    height: 144,
    alignSelf: "center",
    marginBottom: 40,
  },
  photoFrame: {
    width: "100%",
    height: "100%",
    borderRadius: 72,
    borderWidth: 4,
    borderColor: theme.colors.glassBorder,
    overflow: "hidden",
    backgroundColor: theme.colors.accentGray,
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  addPhotoFab: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 40,
    height: 40,
    backgroundColor: theme.colors.oliveMuted,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: theme.colors.bgBase,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  codeInput: {
    width: "100%",
    backgroundColor: "#F5EEE7",
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    padding: 20,
    borderRadius: 20,
    textAlign: "center",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 8,
    color: theme.colors.charcoal,
  },
  errorText: {
    color: theme.colors.red,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  footer: {
    marginTop: 32,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
    alignItems: "center",
    gap: 16,
  },
  timerText: {
    fontSize: 14,
    color: theme.colors.textDim + "80",
    fontWeight: "500",
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: theme.colors.charcoal,
  },
  backText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.textDim,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
