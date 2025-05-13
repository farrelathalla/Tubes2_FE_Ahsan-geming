export const apiConfig = {
  // Get WebSocket URL
  getWebSocketUrl: (): string => {
    if (typeof window === "undefined") {
      // Server-side rendering
      return "";
    }

    const isDev = process.env.NODE_ENV === "development";
    const baseUrl = isDev
      ? "ws://localhost:8080"
      : "wss://tubes2beahsan-geming-production.up.railway.app";

    // You can also use environment variables
    return process.env.NEXT_PUBLIC_API_URL || baseUrl;
  },

  // Get HTTP API URL
  getHttpUrl: (): string => {
    const isDev = process.env.NODE_ENV === "development";
    const baseUrl = isDev
      ? "http://localhost:8080"
      : "https://tubes2beahsan-geming-production.up.railway.app";

    return process.env.NEXT_PUBLIC_API_HTTP_URL || baseUrl;
  },

  // Check if we're in development
  isDevelopment: (): boolean => {
    return process.env.NODE_ENV === "development";
  },
};
