"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function AdminPushPanel() {
  const [title, setTitle] = useState("EJ Prono");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function sendNotification() {
    if (!message.trim()) {
      setFeedback("Message requis.");
      return;
    }

    setSending(true);
    setFeedback("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setFeedback("Session invalide.");
        return;
      }

      const response = await fetch(
        "/api/push/send-custom",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title,
            message,
            url,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setFeedback(result.error || "Erreur envoi push.");
        return;
      }

      setFeedback(
        `Notification envoyee a ${result.sent} appareil(s).`
      );
      setMessage("");
    } catch (error) {
      console.error(error);
      setFeedback("Erreur envoi push.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl bg-[#24364A] p-4">
      <h4 className="mb-3 text-lg font-bold">
        Notification push
      </h4>

      <div className="grid gap-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-lg bg-white p-3 text-black"
          placeholder="Titre"
        />

        <textarea
          value={message}
          onChange={(event) =>
            setMessage(event.target.value)
          }
          rows={3}
          className="rounded-lg bg-white p-3 text-black"
          placeholder="Message a envoyer"
        />

        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="rounded-lg bg-white p-3 text-black"
          placeholder="/dashboard"
        />

        <button
          type="button"
          onClick={sendNotification}
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#C7A27F] px-5 py-3 font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={18} />
          {sending ? "Envoi..." : "Envoyer la notification"}
        </button>
      </div>

      {feedback && (
        <p className="mt-3 text-sm text-gray-200">
          {feedback}
        </p>
      )}
    </div>
  );
}
