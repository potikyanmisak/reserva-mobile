# Reserva — Mobile App

A React Native / Expo restaurant reservation app.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure your API URL**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `EXPO_PUBLIC_API_URL` to your server's LAN IP:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
   ```
   > **Why not localhost?** Expo Go on a physical device is a separate machine — it can't reach your computer via `localhost`. Use your machine's actual LAN IP.

3. **Start the server** (in a separate terminal)
   ```bash
   # Restore server.ts if needed, then:
   npx tsx server.ts
   ```

4. **Start Expo**
   ```bash
   npx expo start
   ```
   Scan the QR code with the Expo Go app.

## Project structure

```
src/
  App.tsx              — Root navigator
  theme.ts             — Design tokens
  lib/
    api.ts             — API URL helper
    AuthContext.tsx    — Auth state + token storage
    LanguageContext.tsx
  components/
    LanguageSelector.tsx
  pages/
    AuthPage.tsx
    RestaurantDetail.tsx
    ReservationPage.tsx
    customer/
      Dashboard.tsx
      Collections.tsx
      Profile.tsx
    owner/
      Dashboard.tsx
      Reservations.tsx
      Analytics.tsx
      Settings.tsx
    admin/
      Dashboard.tsx
```
