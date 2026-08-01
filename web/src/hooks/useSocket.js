import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

/**
 * Custom hook to manage a Socket.io connection.
 * Automatically connects on mount and joins the correct room
 * based on the authenticated user's role.
 *
 * @returns {{ socket: Socket | null, isConnected: boolean }}
 */
const useSocket = () => {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const token = window.__accessToken;
    if (!token) return;

    // Create socket connection with auth
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[Socket] Connected: ${socket.id}`);
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${reason}`);
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error(`[Socket] Connection error: ${err.message}`);
      setIsConnected(false);
    });

    // Cleanup on unmount or user change
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id]);

  return {
    socket: socketRef.current,
    isConnected,
  };
};

export default useSocket;
