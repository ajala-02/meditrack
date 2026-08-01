import { useState, useEffect, useCallback } from "react";
import useSocket from "./useSocket";
import { useToast } from "../context/ToastContext";

/**
 * Custom hook to track real-time alerts via Socket.io.
 * Maintains an in-memory list of pending (unacknowledged) alerts.
 *
 * @returns {{
 *   alerts: Array,
 *   pendingCount: number,
 *   acknowledgeAlert: (alertId: string) => void,
 *   clearAlerts: () => void
 * }}
 */
const useAlerts = () => {
  const { socket } = useSocket();
  const { addToast } = useToast();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (data) => {
      setAlerts((prev) => {
        // Avoid duplicates
        if (prev.some((a) => a.alertId === data.alertId)) return prev;
        
        // Add toast
        addToast("New patient symptom logged requiring review.", "watch");
        
        return [{ ...data, receivedAt: new Date() }, ...prev];
      });
    };

    const handleCriticalAlert = (data) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.alertId === data.alertId)) return prev;
        
        // Add toast
        addToast("CRITICAL ALERT: Immediate attention required!", "critical");
        
        return [{ ...data, isCritical: true, receivedAt: new Date() }, ...prev];
      });
    };

    const handleRiskUpdate = (data) => {
      // Broadcast to any listeners that want to update patient cards
      setAlerts((prev) => {
        // Update the riskStatus for matching patient alerts
        return prev.map((a) =>
          a.patientId === data.patientId
            ? { ...a, riskStatus: data.riskStatus, overallScore: data.overallScore }
            : a
        );
      });
    };

    socket.on("new_alert", handleNewAlert);
    socket.on("critical_alert", handleCriticalAlert);
    socket.on("risk_update", handleRiskUpdate);

    return () => {
      socket.off("new_alert", handleNewAlert);
      socket.off("critical_alert", handleCriticalAlert);
      socket.off("risk_update", handleRiskUpdate);
    };
  }, [socket]);

  const acknowledgeAlert = useCallback((alertId) => {
    setAlerts((prev) => prev.filter((a) => a.alertId !== alertId));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    alerts,
    pendingCount: alerts.length,
    acknowledgeAlert,
    clearAlerts,
  };
};

export default useAlerts;
