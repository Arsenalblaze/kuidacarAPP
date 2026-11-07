import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "./ui/button";
import {
  LayoutDashboard,
  Users,
  Wrench,
  FileText,
  DollarSign,
  MessageSquare,
  Bell,
  HelpCircle,
  AlertCircle,
  Map,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

export const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { label: "Painel", path: "/admin", icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: "Clientes", path: "/admin/clients", icon: <Users className="w-5 h-5" /> },
    { label: "Mecânicos", path: "/admin/mechanics", icon: <Wrench className="w-5 h-5" /> },
    { label: "Solicitações", path: "/admin/requests", icon: <FileText className="w-5 h-5" /> },
    { label: "Financeiro", path: "/admin/financial", icon: <DollarSign className="w-5 h-5" /> },
    { label: "Mensagens", path: "/admin/messages", icon: <MessageSquare className="w-5 h-5" /> },
    { label: "Notificações", path: "/admin/notifications", icon: <Bell className="w-5 h-5" /> },
    { label: "FAQ", path: "/admin/faq", icon: <HelpCircle className="w-5 h-5" /> },
    { label: "Reclamações", path: "/admin/complaints", icon: <AlertCircle className="w-5 h-5" /> },
    { label: "Mapa", path: "/admin/map", icon: <Map className="w-5 h-5" /> },
    { label: "Estatísticas", path: "/admin/analytics", icon: <BarChart3 className="w-5 h-5" /> },
    { label: "Configurações", path: "/admin/settings", icon: <Settings className="w-5 h-5" /> },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 md:hidden z-50 bg-orange-600 text-white hover:bg-orange-700"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-slate-900 text-white transition-all duration-300 z-40 ${
          isOpen ? "w-64" : "w-20"
        } ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-bold">
                KA
              </div>
              <span className="font-bold text-lg">Administração</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="hidden md:flex text-white hover:bg-slate-800"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                  isActive
                    ? "bg-orange-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item.icon}
                {isOpen && (
                  <>
                    <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="bg-red-600 text-white text-xs rounded-full px-2 py-0.5">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 space-y-2">
          {isOpen && (
            <div className="text-xs text-slate-400 truncate">
              {user?.email || "Administrador"}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-red-400 hover:bg-red-900/20 hover:text-red-300"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isOpen && "Sair"}
          </Button>
        </div>
      </aside>

      {/* Spacer for non-mobile screens */}
      <div className={`hidden md:block transition-all duration-300 ${isOpen ? "w-64" : "w-20"}`} />
    </>
  );
};
