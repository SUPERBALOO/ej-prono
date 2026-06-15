"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function RedirectClassementPage() {
  const router = useRouter();

  useEffect(() => {
    async function charger() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/connexion");
        return;
      }

      const { data, error } = await supabase
        .from("participants_concours")
        .select(`
          concours_id,
          concours (
            id,
            nom,
            date_fin
          )
        `)
        .eq("joueur_id", user.id);

      if (error) {
        console.error(error);
        router.replace("/concours");
        return;
      }

      if (!data || data.length === 0) {
        router.replace("/concours");
        return;
      }

      const concoursTries = [...data].sort(
        (a: any, b: any) =>
          new Date(
            Array.isArray(b.concours)
              ? b.concours[0]?.date_fin
              : b.concours?.date_fin
          ).getTime() -
          new Date(
            Array.isArray(a.concours)
              ? a.concours[0]?.date_fin
              : a.concours?.date_fin
          ).getTime()
      );

      const dernierConcours: any = Array.isArray(
        concoursTries[0].concours
      )
        ? concoursTries[0].concours[0]
        : concoursTries[0].concours;

      if (!dernierConcours?.id) {
        router.replace("/concours");
        return;
      }

      router.replace(
        `/concours/${dernierConcours.id}?tab=classement`
      );
    }

    charger();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1E3047] text-white">
      Chargement...
    </div>
  );
}