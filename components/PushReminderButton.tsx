"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray =
    new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] =
      rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function PushReminderButton() {
  const [
    notificationPermission,
    setNotificationPermission,
  ] = useState<NotificationPermission | "unsupported">(
    "default"
  );

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setNotificationPermission("unsupported");
      return;
    }

    setNotificationPermission(Notification.permission);
  }, []);

  async function activerNotificationsRappel() {
    setLoading(true);
    setMessage("");

    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setNotificationPermission("unsupported");
        setMessage(
          "Les notifications ne sont pas supportees sur cet appareil."
        );
        return;
      }

      const permission =
        await Notification.requestPermission();

      setNotificationPermission(permission);

      if (permission !== "granted") {
        setMessage(
          "Les notifications ne sont pas autorisees sur cet appareil."
        );
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setMessage("Vous devez etre connecte.");
        return;
      }

      const keyResponse = await fetch(
        "/api/push/public-key"
      );

      const { publicKey } =
        await keyResponse.json();

      if (!publicKey) {
        setMessage(
          "Les notifications push ne sont pas encore configurees."
        );
        return;
      }

      await navigator.serviceWorker.register("/sw.js");

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(publicKey),
          });
      }

      const response = await fetch(
        "/api/push/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
          }),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        setMessage(
          result.error ||
            "Impossible d'activer les notifications."
        );
        return;
      }

      setMessage("Rappels actives sur ce telephone.");
    } catch (error) {
      console.error(error);
      setMessage(
        "Impossible d'activer les notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  if (notificationPermission === "unsupported") {
    return (
      <div className="rounded-xl bg-[#223246] p-4 text-sm text-gray-300">
        Les notifications push ne sont pas supportees sur cet appareil.
      </div>
    );
  }

  if (notificationPermission === "denied") {
    return (
      <div className="rounded-xl bg-[#223246] p-4 text-sm text-gray-300">
        Les notifications sont bloquees. Il faut les autoriser dans les
        reglages du navigateur ou du telephone.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={activerNotificationsRappel}
        disabled={
          loading ||
          notificationPermission === "granted"
        }
        className="
          w-full
          md:w-auto
          px-6
          py-3
          rounded-lg
          bg-[#c9a27e]
          text-white
          font-semibold
          hover:bg-[#b58d69]
          disabled:opacity-70
          disabled:cursor-not-allowed
          transition
        "
      >
        {notificationPermission === "granted"
          ? "Rappels actives"
          : loading
          ? "Activation..."
          : "Activer les rappels"}
      </button>

      {message && (
        <p className="text-sm text-green-300">
          {message}
        </p>
      )}
    </div>
  );
}
