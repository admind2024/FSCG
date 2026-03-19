import { useState, useMemo } from "react";
import { useDashboard, useAuth } from "@/contexts/DashboardContext";
import {
  Home,
  Calendar,
  MapPin,
  Layers,
  BarChart3,
  RefreshCw,
  ChevronDown,
  LogOut,
  Clock,
  Bookmark,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import HomeScreen from "./screens/HomeScreen";
import DailyScreen from "./screens/DailyScreen";
import LocationScreen from "./screens/LocationScreen";
import CategoriesScreen from "./screens/CategoriesScreen";
import AnalysisScreen from "./screens/AnalysisScreen";
import BukiranjeScreen from "./screens/BukiranjeScreen";
import LoadingScreen from "@/components/LoadingScreen";
import InstallPrompt from "@/components/InstallPrompt";
import { triggerUpdateCheck } from "@/components/PWAUpdatePrompt";
import logo from "@/assets/fscg-logo.png";

type Screen = "home" | "daily" | "location" | "categories" | "analysis" | "bukiranje";

// FSCG brand color - red (used for active tabs etc.)
const brandColor = "#C8102E";
// Header color - dark navy
const headerColor = "#0f172a";

// Admin emails
const ADMIN_EMAILS = ["rade.milosevic87@gmail.com"];

function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email.toLowerCase());
}

// Props za switch na admin
interface DashboardLayoutProps {
  onSwitchToAdmin?: () => void;
}

export default function DashboardLayout({ onSwitchToAdmin }: DashboardLayoutProps) {
  const { logout, user } = useAuth();
  const { eventsList, selectedEventId, setSelectedEventId, isLoading, lastUpdate, refresh, selectedEvent } =
    useDashboard();
  const [activeScreen, setActiveScreen] = useState<Screen>("home");
  const [pressedTab, setPressedTab] = useState<Screen | null>(null);

  const selectedEventData = eventsList.find((e) => e.eventId === selectedEventId);
  const selectedEventName = selectedEventData?.eventName || "Izaberite utakmicu";

  // Check if user is admin
  const isAdmin = isAdminEmail(user?.email);

  const hasRezervacije = useMemo(() => {
    return selectedEvent?.hasRezervacija || false;
  }, [selectedEvent?.hasRezervacija]);

  // DINAMIČKI TABOVI - bez Dnevna/Kat
  const tabs = useMemo(() => {
    const baseTabs: { id: Screen; label: string; icon: typeof Home }[] = [
      { id: "home", label: "Početna", icon: Home },
      { id: "daily", label: "Dnevna", icon: Calendar },
      { id: "location", label: "Lokacija", icon: MapPin },
      { id: "categories", label: "Tribine", icon: Layers },
      { id: "analysis", label: "Analiza", icon: Clock },
    ];

    if (hasRezervacije) {
      baseTabs.push({ id: "bukiranje", label: "Bukiranje", icon: Bookmark });
    }

    return baseTabs;
  }, [hasRezervacije]);

  // Reset na home ako je aktivan bukiranje tab a nema više rezervacija
  useMemo(() => {
    if (activeScreen === "bukiranje" && !hasRezervacije) {
      setActiveScreen("home");
    }
  }, [hasRezervacije, activeScreen]);

  // Show loading screen only on initial load (no selected event yet)
  if (isLoading && !selectedEvent) {
    return <LoadingScreen />;
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case "home":
        return <HomeScreen />;
      case "daily":
        return <DailyScreen />;
      case "location":
        return <LocationScreen />;
      case "categories":
        return <CategoriesScreen />;
      case "analysis":
        return <AnalysisScreen />;
      case "bukiranje":
        return <BukiranjeScreen />;
    }
  };

  const handleTabPress = (id: Screen) => {
    setPressedTab(id);
    setActiveScreen(id);
    setTimeout(() => setPressedTab(null), 200);
  };

  // Event selector component - desktop only
  const DesktopEventSelector = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 w-full text-left transition-all px-4 py-3 rounded-xl hover:bg-muted/70">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Utakmica</span>
            <p className="text-sm font-semibold text-foreground truncate leading-tight">{selectedEventName}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="right"
        className="w-[280px] p-0 bg-card rounded-2xl shadow-2xl border-0 overflow-hidden"
      >
        <div className="px-4 py-3" style={{ backgroundColor: brandColor }}>
          <span className="text-sm font-semibold text-white">Odaberite utakmicu</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {eventsList.map((event) => {
            const isSelected = selectedEventId === event.eventId;
            return (
              <DropdownMenuItem
                key={event.eventId}
                onClick={() => setSelectedEventId(event.eventId)}
                className={`
                  rounded-xl px-4 py-3 cursor-pointer transition-all my-1 flex items-center gap-3
                  ${isSelected ? "text-white" : "hover:bg-muted"}
                `}
                style={isSelected ? { backgroundColor: brandColor } : {}}
              >
                <span className="truncate font-medium flex-1">{event.eventName}</span>
                {isSelected && <div className="ml-auto w-2 h-2 rounded-full bg-white flex-shrink-0" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <InstallPrompt isDataLoaded={!isLoading && !!selectedEvent} />

      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 text-white shadow-lg"
        style={{ backgroundColor: headerColor, paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center justify-between px-3 py-2">
          {/* Logo + Event Selector (mobile) */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img src={logo} alt="FSCG" className="w-12 h-12 object-contain flex-shrink-0" />

            {/* Mobile Event Selector */}
            <div className="md:hidden flex-1 min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-left">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] uppercase tracking-wider opacity-70 font-medium">Utakmica</span>
                      <p className="text-sm font-semibold truncate leading-tight">{selectedEventName}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-70 flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  collisionPadding={12}
                  className="w-[calc(100vw-24px)] min-w-[280px] max-w-[calc(100vw-24px)] p-0 bg-card rounded-2xl shadow-2xl border-0 overflow-hidden"
                >
                  <div className="px-4 py-3" style={{ backgroundColor: brandColor }}>
                    <span className="text-sm font-semibold text-white">Odaberite utakmicu</span>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto p-2">
                    {eventsList.map((event) => {
                      const isSelected = selectedEventId === event.eventId;
                      return (
                        <DropdownMenuItem
                          key={event.eventId}
                          onClick={() => setSelectedEventId(event.eventId)}
                          className={`
                            rounded-xl px-4 py-3 cursor-pointer transition-all my-1 flex items-center gap-3
                            ${isSelected ? "text-white" : "hover:bg-muted"}
                          `}
                          style={isSelected ? { backgroundColor: brandColor } : {}}
                        >
                          <span className="truncate font-medium flex-1">{event.eventName}</span>
                          {isSelected && <div className="ml-auto w-2 h-2 rounded-full bg-white flex-shrink-0" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop title */}
            <div className="hidden md:block">
              <h1 className="font-bold text-lg leading-tight">FSCG</h1>
              <p className="text-xs opacity-75">Dashboard</p>
            </div>
          </div>

          {/* Admin Button + Refresh with time + Logout */}
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {isAdmin && onSwitchToAdmin && (
              <button
                onClick={onSwitchToAdmin}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 transition-all border border-white/20"
              >
                <Shield className="w-4 h-4" />
                <span className="text-xs font-semibold hidden sm:inline">Admin</span>
              </button>
            )}

            <button
              onClick={() => {
                refresh();
                triggerUpdateCheck();
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              {lastUpdate && (
                <span className="text-xs font-medium">
                  {lastUpdate.toLocaleTimeString("sr-Latn", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-white hover:bg-white/10 h-9 w-9 rounded-xl"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content - with proper safe area spacing */}
      <main className="flex-1 pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-y-auto">
        <div className="md:max-w-4xl lg:max-w-5xl xl:max-w-6xl md:mx-auto md:px-6 lg:px-8">
          {renderScreen()}
        </div>
      </main>

      {/* Bottom Navigation - Mobile */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/10"
        style={{ backgroundColor: "#0f172a" }}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex justify-around items-center h-16 px-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeScreen === id;
            const isPressed = pressedTab === id;
            const isBukiranje = id === "bukiranje";
            const tabColor = isBukiranje ? "#f97316" : brandColor;

            return (
              <button
                key={id}
                onClick={() => handleTabPress(id)}
                className={`
                  relative flex flex-col items-center justify-center flex-1 h-14 mx-0.5 rounded-xl transition-all duration-200
                  ${isActive ? "text-white" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}
                  ${isPressed ? "scale-95" : ""}
                `}
                style={isActive ? { backgroundColor: `${tabColor}15`, color: tabColor } : {}}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl border-2" style={{ borderColor: `${tabColor}50` }} />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`}
                  style={isActive ? { color: tabColor } : {}}
                />
                <span className="text-[10px] mt-1 font-medium" style={isActive ? { color: tabColor } : {}}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav
        className="hidden md:flex fixed left-0 bottom-0 w-64 bg-card border-r border-border flex-col p-4 gap-2 shadow-lg"
        style={{ top: "72px" }}
      >
        {/* Event Selector */}
        <div className="mb-4">
          <DesktopEventSelector />
        </div>

        <div className="border-t border-border pt-4 mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">Navigacija</span>
        </div>

        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeScreen === id;
          const isPressed = pressedTab === id;
          const isBukiranje = id === "bukiranje";
          const tabColor = isBukiranje ? "#f97316" : brandColor;

          return (
            <button
              key={id}
              onClick={() => handleTabPress(id)}
              className={`
                relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${isActive ? "text-white shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-muted/70"}
                ${isPressed ? "scale-[0.97]" : ""}
              `}
              style={
                isActive
                  ? {
                      background: `linear-gradient(to right, ${tabColor}, ${tabColor}cc)`,
                      boxShadow: `0 10px 15px -3px ${tabColor}40`,
                    }
                  : {}
              }
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
              <span className="font-medium text-sm">{label}</span>
              {isActive && <div className="absolute right-3 w-2 h-2 rounded-full bg-white/80" />}
            </button>
          );
        })}

        {isAdmin && onSwitchToAdmin && (
          <>
            <div className="border-t border-border mt-4 pt-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">Admin</span>
            </div>
            <button
              onClick={onSwitchToAdmin}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 bg-slate-700 hover:bg-slate-600 text-white"
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium text-sm">Admin Panel</span>
            </button>
          </>
        )}
      </nav>

      {/* Desktop content offset */}
      <style>{`
        @media (min-width: 768px) {
          main {
            margin-left: 16rem;
            padding-bottom: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
