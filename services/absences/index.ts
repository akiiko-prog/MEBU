import { MMKV } from "react-native-mmkv";

// Initialize MMKV storage
export const storage = new MMKV({
  id: "absences-storage",
});

const BASE_URL = "https://absences.epita.net/api/Users/student/grades";

import { Attendance as SharedAttendance } from "@/services/shared/attendance";
import { Capabilities, SchoolServicePlugin } from "@/services/shared/types";
import { Auth, Services } from "@/stores/account/types";
import { sendNewAbsenceNotification } from "@/utils/notification/alertNotification";

class AbsencesAPI {
  private token: string | null = null;

  constructor() {
    const savedToken = storage.getString("absences_token");
    if (savedToken) {
      this.token = savedToken;
    }
  }

  setToken(token: string) {
    this.token = token;
    storage.set("absences_token", token);
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  async sync(token?: string) {
    if (token) {
      this.setToken(token);
    }

    if (!this.token) {
      console.error("No token provided for Absences sync");
      return;
    }

    const { useFlagsStore } = require('@/stores/flags');
    if (useFlagsStore.getState().isDemoMode) {
      console.log("🎭 Demo mode active — skipping real Absences sync and returning cached sandbox data.");
      return this.initializeFromDatabase();
    }

    try {
      const response = await fetch(BASE_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          Referer: "https://absences.epita.net/parent/home",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Dest": "empty",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch grades: ${response.status}`);
      }

      const data = await response.json();

      console.log(`Fetched ${data.length} levels from Absences API`);

      storage.set("absences_grades", JSON.stringify(data));
      const lastAbsencesNumber = storage.getNumber("AbsencesNumber") || 0;
      const absencesList: { slotId: number; startDate: string; subjectName: string; justificatory: string; mandatory: boolean }[] = [];
      data[0].periods.forEach((period: any) => {
        period.absences.forEach((absence: any) => {
          absencesList.push(absence);
        });
      });
      for (let i = 0; i < absencesList.length; i++) {
        for (let j = 0; j < absencesList.length; j++) {
          if (i !== j && absencesList[i].subjectName == absencesList[j].subjectName && absencesList[i].justificatory == absencesList[j].justificatory && absencesList[i].startDate.split('T')[0] == absencesList[j].startDate.split('T')[0]) {
            absencesList.splice(j, 1);
          }
        }
      }

      storage.set("AbsencesNumber", absencesList.length);
      if (lastAbsencesNumber < absencesList.length) {
        for (let i = lastAbsencesNumber; i < absencesList.length; i++) {
          await sendNewAbsenceNotification();
        }
      }

      return data;
    } catch (error) {
      console.error("Error fetching absences:", error);
      throw error;
    }
  }

  async initializeFromDatabase() {
    const cached = storage.getString("absences_grades");
    if (cached) {
      return JSON.parse(cached);
    }
    return [];
  }
}

export const API = new AbsencesAPI();
export default API;

export class Attendance implements SchoolServicePlugin {
  displayName = "Attendance";
  service = Services.ATTENDANCE;
  capabilities: Capabilities[] = [Capabilities.ATTENDANCE];
  authData: Auth = {};
  session: any = undefined;

  constructor(public accountId: string) { }

  async refreshAccount(credentials: Auth): Promise<Attendance> {
    this.authData = credentials;
    if (credentials.accessToken) {
      API.setToken(credentials.accessToken);
    }
    return this;
  }

  async getAttendanceForPeriod(): Promise<SharedAttendance> {
    const data = await API.sync();
    return data as SharedAttendance;
  }
}