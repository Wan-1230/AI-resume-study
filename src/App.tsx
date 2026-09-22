import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import ClickSpark from "@/components/ClickSpark";
import Home from "@/pages/Home";
import QuestionDetail from "@/pages/QuestionDetail";
import ImportPage from "@/pages/ImportPage";
import PracticePage from "@/pages/PracticePage";
import InterviewPage from "@/pages/InterviewPage";
import MyQuestionsPage from "@/pages/MyQuestionsPage";
import AuthPage from "@/pages/AuthPage";
import ChatPage from "@/pages/ChatPage";
import ResumePage from "@/pages/ResumePage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminRoute from "@/components/AdminRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import ToastViewport from "@/components/Toast";
import Empty from "@/components/Empty";
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
          <Route path="/interview" element={<InterviewPage />} />
          <Route path="/interview/:id" element={<InterviewPage />} />
          <Route path="/my-questions" element={<MyQuestionsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/resume" element={<ResumePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          {/* 兜底路由。errorElement 只在 data router（createBrowserRouter）下生效，
              这里用的是 <Routes> 组件式路由，所以 404 只能这样兜 —— 不假装配了 errorElement */}
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
                <Empty
                  title="这个地址下没有页面"
                  description="可能是链接抄断了，或者那一页还没做。从首页开始走一遍最稳。"
                  className="max-w-md bg-[#141419]"
                  action={
                    <a href="/" className="px-4 py-2 bg-primary-500/15 text-primary-500 rounded-xl text-sm">
                      回首页
                    </a>
                  }
                />
              </div>
            }
          />
        </Routes>
      </Router>
      <ToastViewport />
    </ClickSpark>
    </ErrorBoundary>
  );
}
