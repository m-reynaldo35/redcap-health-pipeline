"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Upload,
  ClipboardList,
  Send,
  Database,
  BarChart2,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/review", label: "Review", icon: ClipboardList },
  { href: "/import", label: "REDCap Import", icon: Send },
  { href: "/records", label: "Records", icon: Database },
  { href: "/stats", label: "Stats Export", icon: BarChart2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("pipeline_token");
    router.replace("/login");
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold leading-tight">REDCap Pipeline</p>
          <p className="text-slate-400 text-xs">Health Data Tool</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 space-y-0.5 border-t border-slate-800 pt-4">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/settings"
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
