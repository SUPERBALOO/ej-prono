"use client";

import { useMemo, useState } from "react";
import { Mail, Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type AdminContestEmailPanelProps = {
  concoursId: string;
  concoursName?: string;
};

export default function AdminContestEmailPanel({
  concoursId,
  concoursName,
}: AdminContestEmailPanelProps) {
  const [subject, setSubject] = useState(
    concoursName
      ? `Felicitations aux gagnants - ${concoursName}`
      : "Felicitations aux gagnants EJ Prono"
  );
  const [message, setMessage] = useState(
    "Merci a tous pour votre participation. Retrouvez l'affiche des gagnants ci-dessous."
  );
  const [imageUrl, setImageUrl] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");

  const defaultCtaUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/concours/${concoursId}`;
  }, [concoursId]);

  async function sendEmail() {
    if (!subject.trim() || !message.trim()) {
      setFeedback("Sujet et message requis.");
      return;
    }

    if (!imageUrl.trim()) {
      setFeedback(
        "Lien public de l'affiche requis pour envoyer l'image."
      );
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
        `/api/concours/${concoursId}/send-poster-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subject,
            message,
            imageUrl,
            ctaUrl: ctaUrl.trim() || defaultCtaUrl,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setFeedback(result.error || "Erreur envoi mail.");
        return;
      }

      const details = [
        `${result.sent} mail(s) envoye(s)`,
        `${result.skippedWithoutEmail} participant(s) sans email`,
      ];

      if (result.failed) {
        details.push(`${result.failed} erreur(s)`);
      }

      setFeedback(details.join(" - "));
    } catch (error) {
      console.error(error);
      setFeedback("Erreur envoi mail.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-8 rounded-2xl bg-[#24364A] p-5 shadow-lg">
      <div className="mb-4 flex items-center gap-3">
        <Mail className="text-[#D8AA82]" size={24} />
        <div>
          <h3 className="text-xl font-bold">
            Envoyer une affiche par mail
          </h3>
          <p className="text-sm text-gray-300">
            Envoi a tous les participants inscrits a ce concours.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="rounded-lg bg-white p-3 text-black"
          placeholder="Sujet du mail"
        />

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          className="rounded-lg bg-white p-3 text-black"
          placeholder="Message a envoyer"
        />

        <input
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          className="rounded-lg bg-white p-3 text-black"
          placeholder="Lien public de l'affiche image (https://...)"
        />

        <input
          value={ctaUrl}
          onChange={(event) => setCtaUrl(event.target.value)}
          className="rounded-lg bg-white p-3 text-black"
          placeholder={
            defaultCtaUrl ||
            "Lien du bouton dans le mail, optionnel"
          }
        />

        <button
          type="button"
          onClick={sendEmail}
          disabled={sending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#D8AA82] px-5 py-3 font-semibold text-[#1E3047] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={18} />
          {sending
            ? "Envoi en cours..."
            : "Envoyer l'affiche par mail"}
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
