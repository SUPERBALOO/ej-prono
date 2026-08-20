"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";

type NewsItem = {
  title: string;
  category: string;
  date: string | null;
  description: string;
  imageUrl: string | null;
  url: string;
};

export default function LeMansNewsPanel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/le-mans-news")
      .then((response) => response.json())
      .then((result) => setNews(result.news || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mb-8 rounded-xl bg-[#314357] p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Newspaper className="text-[#C7A27F]" />
          <h3 className="text-2xl font-bold">
            Actus Le Mans FC
          </h3>
        </div>

        <a
          href="https://www.lemansfc.fr/index.php?section=actualites"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-[#C7A27F] hover:underline"
        >
          Toutes les actualités
        </a>
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
          {news.map((item) => (
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
