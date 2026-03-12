import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/40 to-slate-900 text-white">
      <Sidebar />
      <main className="flex-1 overflow-auto ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
