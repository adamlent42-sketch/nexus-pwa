import { AppHeader } from "@/components/AppHeader";
import { ActionRow } from "@/components/ActionRow";
import { StatCards } from "@/components/StatCards";
import { ActiveAlerts } from "@/components/sections/ActiveAlerts";
import { TodaysPOs } from "@/components/sections/TodaysPOs";
import { TodaysInstructionNotes } from "@/components/sections/TodaysInstructionNotes";
import { Onboarding } from "@/components/sections/Onboarding";
import { RecentlyStarted } from "@/components/sections/RecentlyStarted";
import { TodaysStaff } from "@/components/sections/TodaysStaff";
import { TomorrowPreview } from "@/components/sections/TomorrowPreview";
import { FormsProvider } from "@/components/forms/FormsProvider";
import { ViewDateProvider } from "@/components/ViewDateContext";
import { DateSelector } from "@/components/DateSelector";

export default function Page() {
  return (
    <ViewDateProvider>
      <FormsProvider>
        <AppHeader />
        <ActionRow />
        <DateSelector />
        <StatCards />
        <TomorrowPreview />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <div id="active-alerts" className="scroll-mt-4">
            <ActiveAlerts />
          </div>
          <div id="todays-pos" className="scroll-mt-4">
            <TodaysPOs />
          </div>
          <TodaysInstructionNotes />
          <div id="onboarding" className="scroll-mt-4">
            <Onboarding />
          </div>
          <div id="recently-started" className="scroll-mt-4">
            <RecentlyStarted />
          </div>
        </div>

        <div id="todays-staff" className="scroll-mt-4">
          <TodaysStaff />
        </div>
      </FormsProvider>
    </ViewDateProvider>
  );
}
