import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { User, LogOut, ChevronDown, Info, Users, LayoutGrid, HelpCircle, FileText, FolderOpen } from "lucide-react";
import logo from "../assets/logo.png";
import { useAppSelector, useAppDispatch } from "../app/hooks";
import { logoutAndClearCache } from "../app/store";
import { useGetMembersQuery } from "../services/teamApi";

const menuItems = [
  { to: "/quiz", label: "Quizzes", icon: HelpCircle },
  { to: "/teams", label: "Teams", icon: LayoutGrid },
  { to: "/app-info", label: "Categories", icon: FolderOpen },
  { to: "/members", label: "Members", icon: Users, showPendingBadge: true },
  { to: "/reports", label: "Report", icon: FileText },
];

export default function Sidebar() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { data: membersData } = useGetMembersQuery(undefined, { skip: user?.role === "admin" });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path: string) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path));
  const pendingCount =
    membersData && Array.isArray(membersData.members)
      ? membersData.members.filter((m) => m.status === "pending").length
      : 0;

  return (
    <aside className="fixed left-0 top-0 z-30 w-64 h-screen bg-slate-800/80 border-r border-slate-700/50 flex flex-col shrink-0">
      <div className="p-5 border-b border-slate-700/50 flex items-center gap-3">
        <img src={logo} alt="Brain Box" className="h-9 w-auto object-contain shrink-0" />
        {/* <h1 className="text-xl font-bold text-white truncate" style={{ fontFamily: "Montserrat, sans-serif" }}>
          Brain Box
        </h1> */}
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map(({ to, label, icon: Icon, showPendingBadge }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(to)
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
            }`}
          >
            <span className="relative inline-flex items-center">
              <Icon className="h-5 w-5 shrink-0" />
              {showPendingBadge && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-900 px-1.5 min-w-[16px]">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </span>
            {label}
          </Link>
        ))}
        {pendingCount > 0 && (
          <div className="pt-2 mt-2 border-t border-slate-700/50">
            <p className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Pending
            </p>
            <p className="px-5 py-1 text-sm text-amber-400">
              {pendingCount} member{pendingCount !== 1 ? "s" : ""} awaiting approval
            </p>
          </div>
        )}
      </nav>
      <div className="p-3 border-t border-slate-700/50" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-200 hover:bg-slate-700/50 transition-colors text-left"
        >
          <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-slate-300" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="truncate text-sm font-medium">{user?.name ?? "User"}</span>
            <span className="text-xs text-slate-400 capitalize">
              {user?.role === "team_manager" ? "Team Manager" : user?.role ?? "User"}
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {dropdownOpen && (
          <div className="mt-1 py-1 bg-slate-700/80 rounded-lg border border-slate-600/50 shadow-lg">
            <button
              type="button"
              onClick={() => {
                dispatch(logoutAndClearCache());
                setDropdownOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-200 hover:bg-slate-600/50 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
