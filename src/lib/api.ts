// Set EXPO_PUBLIC_API_URL in your .env file to your server's LAN IP.
// Example: EXPO_PUBLIC_API_URL=http://192.168.1.5:3000
//
// Find your LAN IP:
//   Mac/Linux: ifconfig | grep "inet "
//   Windows:   ipconfig | findstr "IPv4"
//
// Expo Go on a physical device CANNOT reach "localhost" — it must be
// the actual IP address of the machine running the server.

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};
