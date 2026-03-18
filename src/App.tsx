import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, DashboardProvider, useAuth } from "@/contexts/DashboardContext";
import LoginPage from "@/pages/LoginPage";
import DashboardLayout from "@/pages/DashboardLayout";
import AdminDashboard from "@/pages/AdminDashboard";
import { Loader2 } from "lucide-react";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

// Admin email
const ADMIN_EMAILS = ["rade.milosevic87@gmail.com"];

function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email.toLowerCase());
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [viewMode, setViewMode] = useState<"admin" | "organizer">("admin");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Admin može da bira između Admin i Organizer pogleda
  if (isAdminEmail(user.email)) {
    if (viewMode === "admin") {
      return <AdminDashboard onSwitchToOrganizer={() => setViewMode("organizer")} />;
    } else {
      // Organizer pogled za admina - sa dugmetom za povratak na Admin
      return (
        <DashboardProvider>
          <DashboardLayout onSwitchToAdmin={() => setViewMode("admin")} />
        </DashboardProvider>
      );
    }
  }

  // Ostali vide samo obični dashboard (bez Admin dugmeta)
  return (
    <DashboardProvider>
      <DashboardLayout />
    </DashboardProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <PWAUpdatePrompt />
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
