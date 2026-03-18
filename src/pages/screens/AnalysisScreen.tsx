// src/pages/screens/AnalysisScreen.tsx
import React from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import HourlySalesChart from "@/components/HourlySalesChart";

export default function AnalysisScreen() {
  const { selectedEventId, selectedEvent, currency } = useDashboard();

  return (
    <div className="p-3 md:p-6 space-y-4">
      <HourlySalesChart eventId={selectedEventId || ""} currency={currency} tickets={selectedEvent?.tickets || []} />
    </div>
  );
}
