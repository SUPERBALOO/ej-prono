"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import InstallAppButton from "@/components/InstallAppButton";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/connexion");
  }

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Concours", href: "/concours", icon: "🏆" },
  { label: "Pronostics", href: "/pronostics", icon: "📝" },
  { label: "Classement", href: "/classement", icon: "🥇" },
  { label: "Mon profil", href: "/profil", icon: "👤" },
];
  return (
    <>
      {/* Bouton menu mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 bg-[#D8AA82] text-white p-3 rounded-lg shadow-lg"
      >
        ☰
      </button>

      {/* Fond sombre mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen bg-[#2F3F54]
          border-r border-[#42536A]
          flex flex-col z-50
          w-64
          transform transition-transform duration-300

          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        <div className="p-6 text-center border-b border-[#42536A] relative">
          {/* Bouton fermer mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 text-white text-2xl md:hidden"
          >
            ✕
          </button>

          <Image
            src="/logo-ej-prono.png"
            alt="EJ Prono"
            width={140}
            height={80}
            className="mx-auto mb-4"
          />

          <h2 className="text-[#D8AA82] text-2xl font-bold">
            EJ Prono
          </h2>
        </div>

        <nav className="flex-1 p-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition ${
                pathname === item.href
                  ? "bg-[#D8AA82] text-white"
                  : "text-white hover:bg-[#3E5168]"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#42536A]">
          <InstallAppButton />

          <button
            onClick={handleLogout}
            className="mt-3 w-full bg-[#D8AA82] text-white py-3 rounded-lg font-semibold hover:opacity-90"
          >
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
