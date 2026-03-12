import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import Layout from "./components/Layout";
import Quiz from "./pages/Quiz";
import Reports from "./pages/Reports";
import AppInfo from "./pages/AppInfo";
import Members from "./pages/Members";
import Teams from "./pages/Teams";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import ForgotPassword from "./pages/ForgotPassword";
import InviteAccept from "./pages/InviteAccept";
import HostGame from "./pages/HostGame";
import JoinGame from "./pages/JoinGame";
import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-black/40 to-slate-950 text-white" style={{ fontFamily: '"DM Sans", sans-serif' }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/quiz" replace />} />
            <Route path="quiz" element={<Quiz />} />
            <Route path="reports" element={<Reports />} />
            <Route path="app-info" element={<AppInfo />} />
            <Route path="teams" element={<Teams />} />
            <Route path="members" element={<Members />} />
            <Route path="host-game/:code" element={<HostGame />} />
          </Route>
          <Route path="/join-game" element={<JoinGame />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/invite/accept" element={<InviteAccept />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/quiz" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
