"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type NewsItem = {
  title: string;
  category: string;
  date: string | null;
  description: string;
  imageUrl: string | null;
  url: string;
};

export default function LeMansNewsPanel({ compact = false }: { compact?: boolean }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);

  useEffect(() => {
    fetch("/api/le-mans-news")
      .then((response) => response.json())
      .then((result) => setNews(result.news || []))
      .catch(console.error)
      .finally(() => setLoading(false));

    loadPreference();
  }, []);

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : null;
  }

  async function loadPreference() {
    const headers = await getAuthHeaders();
    if (!headers) return;
    const response = await fetch("/api/push/news-preference", { headers });
    const result = await response.json();
    if (response.ok) setAlertsEnabled(result.enabled);
  }

  async function toggleAlerts() {
    const headers = await getAuthHeaders();
    if (!headers) return;
    setSavingAlerts(true);
    const response = await fetch("/api/push/news-preference", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !alertsEnabled }),
    });
    const result = await response.json();
    setSavingAlerts(false);
    if (!response.ok) {
      alert(result.error || "Impossible de modifier les alertes.");
      return;
    }
    setAlertsEnabled(result.enabled);
  }

  return (
    <section id={compact ? undefined : "actus-le-mans-fc"} className="mb-8 scroll-mt-4 rounded-xl bg-[#314357] p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Newspaper className="text-[#C7A27F]" />
          <h3 className="text-2xl font-bold">
            Actus Le Mans FC
          </h3>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={toggleAlerts} disabled={savingAlerts} className="rounded-lg bg-[#C7A27F] px-3 py-2 text-sm font-bold text-[#1E3047] disabled:opacity-60">
          {savingAlerts ? "Enregistrement…" : alertsEnabled ? "🔔 Alertes activées" : "🔕 M'alerter des nouvelles actus"}
        </button>
        <a
          href="https://www.lemansfc.fr/index.php?section=actualites"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-[#C7A27F] hover:underline"
        >
          Toutes les actualités
        </a>
        </div>
      </div>

      {loading && (
        <p className="text-gray-300">
          Chargement des dernières nouvelles…
        </p>
      )}

      {!loading && news.length === 0 && (
        <p className="text-gray-300">
          Les actualités sont momentanément indisponibles.
        </p>
      )}

      {!!news.length && (
        <div className="grid gap-4 lg:grid-cols-3">
          {news.slice(0, compact ? 1 : 3).map((item) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-xl bg-[#223246] transition hover:-translate-y-0.5 hover:ring-2 hover:ring-[#C7A27F]"
            >
              {item.imageUrl && (
                <div
                  className="h-36 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${item.imageUrl})`,
                  }}
                />
              )}

              <div className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                  <span className="rounded-full bg-[#C7A27F] px-2 py-1 font-bold text-[#1E3047]">
                    {item.category}
                  </span>
                  {item.date && (
                    <span className="text-gray-400">
                      {item.date.replaceAll(".", "/")}
                    </span>
                  )}
                </div>

                <h4 className="font-bold leading-snug">
                  {item.title}
                </h4>

                {item.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-gray-300">
                    {item.description}
                  </p>
                )}

                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#C7A27F]">
                  Lire sur le site officiel
                  <ExternalLink size={14} />
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
