import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import ClickSpark from "@/components/ClickSpark";
import Home from "@/pages/Home";
import QuestionDetail from "@/pages/QuestionDetail";
import ImportPage from "@/pages/ImportPage";
import PracticePage from "@/pages/PracticePage";
import MyQuestionsPage from "@/pages/MyQuestionsPage";
import AuthPage from "@/pages/AuthPage";
import AuthCallback from "@/pages/AuthCallback";
import ChatPage from "@/pages/ChatPage";
import ResumePage from "@/pages/ResumePage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminRoute from "@/components/AdminRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useStore } from "@/store";

export default function App() {
  const initializeAuth = useStore((s) => s.initializeAuth);

  // 应用启动时从 localStorage 恢复认证状态
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <ErrorBoundary>
      <ClickSpark
        sparkColor="#06d6a0"
        sparkSize={10}
        sparkRadius={15}
        sparkCount={8}
        duration={400}
      >
        <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/question/:id" element={<QuestionDetail />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/my-questions" element={<MyQuestionsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/resume" element={<ResumePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
        </Routes>
      </Router>
    </ClickSpark>
    </ErrorBoundary>
  );
}
