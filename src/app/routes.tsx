import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { useAuth } from "./context/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Services from "./pages/Services";
import RequestService from "./pages/RequestService";
import ProviderDashboard from "./pages/ProviderDashboard";
import ServiceTracking from "./pages/ServiceTracking";
import History from "./pages/History";
import UserProfile from "./pages/UserProfile";
import TestDiagnostic from "./pages/TestDiagnostic";
import MapTest from "./pages/MapTest";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminClientsPage } from "./pages/AdminClientsPage";
import { AdminMechanicsPage } from "./pages/AdminMechanicsPage";
import { AdminRequestsPage } from "./pages/AdminRequestsPage";
import { AdminFinancialPage } from "./pages/AdminFinancialPage";
import { AdminMessagesPage } from "./pages/AdminMessagesPage";
import { AdminNotificationsPage } from "./pages/AdminNotificationsPage";
import { AdminInternalChatPage } from "./pages/AdminInternalChatPage";
import { AdminFaqPage } from "./pages/AdminFaqPage";
import { AdminComplaintsPage } from "./pages/AdminComplaintsPage";
import { AdminMapPage } from "./pages/AdminMapPage";
import { AdminAnalyticsPage } from "./pages/AdminAnalyticsPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";

// Componente para proteger rotas que requerem autenticação
function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole?: "customer" | "provider";
}) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirecionar para a página principal quando não houver sessão ativa
    return <Navigate to="/" replace />;
  }

  if (user?.role === 'admin' || user?.role === 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  if (allowedRole && user?.role !== allowedRole) {
    if (user?.role === "customer") return <Navigate to="/request" replace />;
    if (user?.role === "provider") return <Navigate to="/provider" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Componente para proteger rotas administrativas
function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Verificar se o usuário é admin (role == 'admin' ou 'super_admin')
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/services",
    element: <Services />,
  },
  {
    path: "/request",
    element: (
      <ProtectedRoute allowedRole="customer">
        <RequestService />
      </ProtectedRoute>
    ),
  },
  {
    path: "/provider",
    element: (
      <ProtectedRoute allowedRole="provider">
        <ProviderDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/tracking/:id",
    element: (
      <ProtectedRoute>
        <ServiceTracking />
      </ProtectedRoute>
    ),
  },
  {
    path: "/history",
    element: (
      <ProtectedRoute>
        <History />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <UserProfile />
      </ProtectedRoute>
    ),
  },
  {
    path: "/diagnostic",
    element: <TestDiagnostic />,
  },
  {
    path: "/map-test",
    element: <MapTest />,
  },
  // Admin Routes
  {
    path: "/admin",
    element: (
      <ProtectedAdminRoute>
        <AdminDashboard />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/clients",
    element: (
      <ProtectedAdminRoute>
        <AdminClientsPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/mechanics",
    element: (
      <ProtectedAdminRoute>
        <AdminMechanicsPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/requests",
    element: (
      <ProtectedAdminRoute>
        <AdminRequestsPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/financial",
    element: (
      <ProtectedAdminRoute>
        <AdminFinancialPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/messages",
    element: (
      <ProtectedAdminRoute>
        <AdminMessagesPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/notifications",
    element: (
      <ProtectedAdminRoute>
        <AdminNotificationsPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/chat",
    element: (
      <ProtectedAdminRoute>
        <AdminInternalChatPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/faq",
    element: (
      <ProtectedAdminRoute>
        <AdminFaqPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/complaints",
    element: (
      <ProtectedAdminRoute>
        <AdminComplaintsPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/map",
    element: (
      <ProtectedAdminRoute>
        <AdminMapPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/analytics",
    element: (
      <ProtectedAdminRoute>
        <AdminAnalyticsPage />
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/settings",
    element: (
      <ProtectedAdminRoute>
        <AdminSettingsPage />
      </ProtectedAdminRoute>
    ),
  },
]);
