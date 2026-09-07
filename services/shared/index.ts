import * as Network from "expo-network";

import {
  addAttendanceToDatabase,
  getAttendanceFromCache,
} from "@/database/useAttendance";
import {
  addBalancesToDatabase,
  getBalancesFromCache,
} from "@/database/useBalance";
import {
  addCanteenMenuToDatabase,
  addCanteenTransactionToDatabase,
  getCanteenMenuFromCache,
  getCanteenTransactionsFromCache,
} from "@/database/useCanteen";
import {
  addChatsToDatabase,
  addMessagesToDatabase,
  addRecipientsToDatabase,
  getChatsFromCache,
  getMessagesFromCache,
  getRecipientsFromCache,
} from "@/database/useChat";
import {
  addPeriodGradesToDatabase,
  addPeriodsToDatabase,
  cleanOrphanedPeriodGrades,
  getGradePeriodsFromCache,
  getPeriodsFromCache,
} from "@/database/useGrades";
import {
  addHomeworkToDatabase,
  getHomeworksFromCache,
} from "@/database/useHomework";
import { addKidToDatabase, getKidsFromCache } from "@/database/useKids";
import { addNewsToDatabase, getNewsFromCache } from "@/database/useNews";
import {
  addCourseDayToDatabase,
  getCoursesFromCache,
} from "@/database/useTimetable";
import { Attendance } from "@/services/shared/attendance";
import {
  Booking,
  BookingDay,
  CanteenHistoryItem,
  CanteenMenu,
  QRCode,
} from "@/services/shared/canteen";
import { Chat, Message, Recipient } from "@/services/shared/chat";
import { Period, PeriodGrades } from "@/services/shared/grade";
import { Homework } from "@/services/shared/homework";
import { News } from "@/services/shared/news";
import { Course, CourseDay, CourseResource } from "@/services/shared/timetable";
import { addSyllabusToDatabase, getSyllabusFromCache } from "@/database/useSyllabus";
import { Syllabus } from "@/services/auriga/types";
import {
  Capabilities,
  FetchOptions,
  SchoolServicePlugin,
} from "@/services/shared/types";
import { useAccountStore } from "@/stores/account";
import { Account, ServiceAccount, Services } from "@/stores/account/types";
import { error, log, warn } from "@/utils/logger/logger";

import { AuthenticationError } from "../errors/AuthenticationError";
import { Balance } from "./balance";
import { Kid } from "./kid";

export class AccountManager {
  private clients: Record<string, SchoolServicePlugin> = {};

  constructor(readonly account: Account) { }

  removeService(id: string): void {
    delete this.clients[id];
  }

  getAccount(): Account {
    return this.account;
  }

  async refreshAllAccounts(forceRefresh?: boolean): Promise<boolean> {
    const networkState = await Network.getNetworkStateAsync();
    const hasInternet = networkState.isInternetReachable ?? false;

    let refreshedAtLeastOne = false;

    // Clean up legacy/phantom services with unknown serviceIds
    const validServiceIds = [Services.MULTI, Services.IZLY, Services.INTRACOM, Services.ATTENDANCE];
    const servicesToRemove: string[] = [];
    for (const service of this.account.services) {
      if (!validServiceIds.includes(service.serviceId)) {
        warn(`Removing legacy service with unknown serviceId ${service.serviceId} (id: ${service.id})`);
        servicesToRemove.push(service.id);
      }
    }
    if (servicesToRemove.length > 0) {
      const store = useAccountStore.getState();
      for (const id of servicesToRemove) {
        store.removeServiceFromAccount(id);
      }
      // Update our local reference to the cleaned account
      const updatedAccount = store.accounts.find(a => a.id === this.account.id);
      if (updatedAccount) {
        (this as any).account = updatedAccount;
      }
    }

    for (const service of this.account.services) {
      try {
        const plugin = this.getServicePluginForAccount(service);

        if (!plugin) {
          warn(`No plugin found for service ${service.serviceId}, skipping.`);
          continue;
        }

        if (hasInternet && plugin.capabilities.includes(Capabilities.REFRESH)) {
          this.clients[service.id] = await plugin.refreshAccount(service.auth, forceRefresh);
          refreshedAtLeastOne = true;
        } else {
          // Offline: set capabilities based on auth type without network calls
          if (service.auth?.additionals?.type === "auriga") {
            plugin.capabilities = [Capabilities.REFRESH, Capabilities.GRADES, Capabilities.TIMETABLE, Capabilities.SYLLABUS];
            if ("isAuriga" in plugin) {
              (plugin as any).isAuriga = true;
            }
          }
          this.clients[service.id] = plugin;
        }
      } catch (e) {
        // Don't let one service failure block the entire app
        warn(`Service ${service.serviceId} (${service.id}) refresh failed: ${e}`);
        // Still register plugin with basic capabilities so cached data can be used
        const plugin = this.getServicePluginForAccount(service);
        if (plugin) {
          if (service.auth?.additionals?.type === "auriga") {
            plugin.capabilities = [Capabilities.REFRESH, Capabilities.GRADES, Capabilities.TIMETABLE, Capabilities.SYLLABUS];
            if ("isAuriga" in plugin) {
              (plugin as any).isAuriga = true;
            }
          }
          this.clients[service.id] = plugin;
        }
      }
    }

    if (!hasInternet) {
      warn("Offline: skipped account refresh, using cached data.");
    }

    return refreshedAtLeastOne;
  }

  async getCanteenKind(clientId: string): Promise<CanteenKind> {
    return await this.fetchData(
      Capabilities.CANTEEN_BALANCE,
      async client =>
        client.getCanteenKind ? client.getCanteenKind() : CanteenKind.ARGENT,
      {
        multiple: false,
        clientId,
      }
    );
  }

  async getKids(): Promise<Kid[]> {
    return await this.fetchData(
      Capabilities.HAVE_KIDS,
      async client => (client.getKids ? client.getKids() : []),
      {
        multiple: true,
        fallback: async () => getKidsFromCache(),
        saveToCache: async (data: Kid[]) => {
          await addKidToDatabase(data);
        },
      }
    );
  }

  async getHomeworks(weekNumber: number): Promise<Homework[]> {
    return await this.fetchData(
      Capabilities.HOMEWORK,
      async client =>
        client.getHomeworks ? await client.getHomeworks(weekNumber) : [],
      {
        multiple: true,
        fallback: async () => getHomeworksFromCache(weekNumber),
        saveToCache: async (data: Homework[]) => {
          await addHomeworkToDatabase(data);
        },
      }
    );
  }

  async getNews(): Promise<News[]> {
    return await this.fetchData(
      Capabilities.NEWS,
      async client => (client.getNews ? await client.getNews() : []),
      {
        multiple: true,
        fallback: async () => getNewsFromCache(),
        saveToCache: async (data: News[]) => {
          await addNewsToDatabase(data);
        },
      }
    );
  }

  async getGradesForPeriod(
    period: Period,
    clientId: string,
    kid?: Kid
  ): Promise<PeriodGrades> {
    return await this.fetchData(
      Capabilities.GRADES,
      async client =>
        client.getGradesForPeriod
          ? await client.getGradesForPeriod(period, kid)
          : error("Bad Implementation"),
      {
        multiple: false,
        clientId,
        fallback: async () => getGradePeriodsFromCache(period.name, period.createdByAccount),
        saveToCache: async (data: PeriodGrades) => {
          await addPeriodGradesToDatabase(data, period.name);
        },
      }
    );
  }

  async getGradesPeriods(): Promise<Period[]> {
    return await this.fetchData(
      Capabilities.GRADES,
      async client =>
        client.getGradesPeriods ? await client.getGradesPeriods() : [],
      {
        multiple: false,
        fallback: async () => getPeriodsFromCache(),
        saveToCache: async (data: Period[]) => {
          await addPeriodsToDatabase(data);
          await cleanOrphanedPeriodGrades();
        },
      }
    );
  }

  async getSyllabus(): Promise<Syllabus[]> {
    return await this.fetchData(
      Capabilities.SYLLABUS,
      async client =>
        client.getSyllabus ? await client.getSyllabus() : [],
      {
        multiple: false,
        fallback: async () => getSyllabusFromCache(),
        saveToCache: async (data: Syllabus[]) => {
          await addSyllabusToDatabase(data);
        },
      }
    );
  }

  async getAttendanceForPeriod(period: string): Promise<Attendance[]> {
    return await this.fetchData(
      Capabilities.ATTENDANCE,
      async client => {
        if (!client.getAttendanceForPeriod) {
          throw new Error(
            "getAttendanceForPeriod not implemented but the capability is set."
          );
        }
        const attendance = await client.getAttendanceForPeriod(period);
        return Array.isArray(attendance) ? attendance : [attendance];
      },
      {
        multiple: true,
        fallback: async () => {
          const res = await getAttendanceFromCache(period);
          return res ? [res] : [];
        },
        saveToCache: async (data: Attendance[]) => {
          await addAttendanceToDatabase(data, period);
        },
      }
    );
  }

  async getAttendancePeriods(): Promise<Period[]> {
    return await this.fetchData(
      Capabilities.ATTENDANCE_PERIODS,
      async client =>
        client.getAttendancePeriods ? await client.getAttendancePeriods() : [],
      {
        multiple: true,
        fallback: async () => getPeriodsFromCache(),
        saveToCache: async (data: Period[]) => {
          await addPeriodsToDatabase(data);
          await cleanOrphanedPeriodGrades();
        },
      }
    );
  }

  async getWeeklyCanteenMenu(startDate: Date): Promise<CanteenMenu[]> {
    return await this.fetchData(
      Capabilities.CANTEEN_MENU,
      async client =>
        client.getWeeklyCanteenMenu
          ? await client.getWeeklyCanteenMenu(startDate)
          : [],
      {
        multiple: true,
        fallback: async () => getCanteenMenuFromCache(startDate),
        saveToCache: async (data: CanteenMenu[]) => {
          await addCanteenMenuToDatabase(data);
        },
      }
    );
  }

  async getChats(): Promise<Chat[]> {
    return await this.fetchData(
      Capabilities.CHAT_READ,
      async client => (client.getChats ? await client.getChats() : []),
      {
        multiple: true,
        fallback: async () => getChatsFromCache(),
        saveToCache: async (data: Chat[]) => {
          await addChatsToDatabase(data);
        },
      }
    );
  }

  async getChatRecipients(chat: Chat): Promise<Recipient[]> {
    return await this.fetchData(
      Capabilities.CHAT_READ,
      async client =>
        client.getChatRecipients ? await client.getChatRecipients(chat) : [],
      {
        multiple: true,
        clientId: chat.createdByAccount,
        fallback: async () => getRecipientsFromCache(chat),
        saveToCache: async (data: Recipient[]) => {
          await addRecipientsToDatabase(chat, data);
        },
      }
    );
  }

  async getChatMessages(chat: Chat): Promise<Message[]> {
    return await this.fetchData(
      Capabilities.CHAT_READ,
      async client =>
        client.getChatMessages ? await client.getChatMessages(chat) : [],
      {
        multiple: true,
        clientId: chat.createdByAccount,
        fallback: async () => getMessagesFromCache(chat),
        saveToCache: async (data: Message[]) => {
          await addMessagesToDatabase(chat, data);
        },
      }
    );
  }

  async getRecipientsAvailableForNewChat(): Promise<Recipient[]> {
    return await this.fetchData(
      Capabilities.CHAT_READ,
      async client =>
        client.getRecipientsAvailableForNewChat
          ? await client.getRecipientsAvailableForNewChat()
          : [],
      { multiple: true }
    );
  }

  async getWeeklyTimetable(weekNumber: number): Promise<CourseDay[]> {
    return await this.fetchData(
      Capabilities.TIMETABLE,
      async client =>
        client.getWeeklyTimetable
          ? await client.getWeeklyTimetable(weekNumber)
          : [],
      {
        multiple: true,
        fallback: async () => getCoursesFromCache([weekNumber]),
        saveToCache: async (data: CourseDay[]) => {
          addCourseDayToDatabase(data);
        },
      }
    );
  }

  async getCourseResources(course: Course): Promise<CourseResource[]> {
    return await this.fetchData(
      Capabilities.TIMETABLE,
      async client =>
        client.getCourseResources
          ? await client.getCourseResources(course)
          : [],
      { multiple: true, clientId: course.createdByAccount }
    );
  }

  async sendMessageInChat(chat: Chat, content: string): Promise<void> {
    return await this.fetchData(
      Capabilities.CHAT_REPLY,
      async client => {
        if (client.sendMessageInChat) {
          await client.sendMessageInChat(chat, content);
        }
      },
      { clientId: chat.createdByAccount }
    );
  }

  async setNewsAsDone(news: News): Promise<News> {
    return await this.fetchData(
      Capabilities.NEWS,
      async client =>
        client.setNewsAsAcknowledged
          ? await client.setNewsAsAcknowledged(news)
          : news,
      { multiple: false, clientId: news.createdByAccount }
    );
  }

  async setHomeworkCompletion(
    homework: Homework,
    state?: boolean
  ): Promise<Homework> {
    return await this.fetchData(
      Capabilities.HOMEWORK,
      async client =>
        client.setHomeworkCompletion
          ? await client.setHomeworkCompletion(homework, state)
          : homework,
      { multiple: false, clientId: homework.createdByAccount }
    );
  }

  async createMail(
    accountId: string,
    subject: string,
    content: string,
    recipients: Recipient[],
    cc?: Recipient[],
    bcc?: Recipient[]
  ): Promise<Chat> {
    return await this.fetchData(
      Capabilities.CHAT_CREATE,
      async client => {
        if (client.createMail) {
          return await client.createMail(subject, content, recipients, cc, bcc);
        }
        throw new Error("createMail not implemented");
      },
      { multiple: false, clientId: accountId }
    );
  }

  async getCanteenBalances(): Promise<Balance[]> {
    return await this.fetchData(
      Capabilities.CANTEEN_BALANCE,
      async client =>
        client.getCanteenBalances ? await client.getCanteenBalances() : [],
      {
        multiple: true,
        fallback: async () => getBalancesFromCache(),
        saveToCache: async (data: Balance[]) => {
          await addBalancesToDatabase(data);
        },
      }
    );
  }

  async getCanteenTransactionsHistory(
    clientId: string
  ): Promise<CanteenHistoryItem[]> {
    return await this.fetchData(
      Capabilities.CANTEEN_HISTORY,
      async client =>
        client.getCanteenTransactionsHistory
          ? await client.getCanteenTransactionsHistory()
          : [],
      {
        multiple: true,
        clientId,
        fallback: async () => getCanteenTransactionsFromCache(),
        saveToCache: async (data: CanteenHistoryItem[]) => {
          await addCanteenTransactionToDatabase(data);
        },
      }
    );
  }

  async getCanteenQRCodes(clientId: string): Promise<QRCode> {
    return await this.fetchData(
      Capabilities.CANTEEN_QRCODE,
      async client =>
        client.getCanteenQRCodes
          ? await client.getCanteenQRCodes()
          : error("getCanteenQRCodes not found"),
      {
        multiple: false,
        clientId,
      }
    );
  }

  async getCanteenBookingWeek(
    weekNumber: number,
    clientId: string
  ): Promise<BookingDay[]> {
    return await this.fetchData(
      Capabilities.CANTEEN_BOOKINGS,
      async client =>
        client.getCanteenBookingWeek
          ? await client.getCanteenBookingWeek(weekNumber)
          : [],
      {
        multiple: true,
        clientId,
      }
    );
  }

  async setMealAsBooked(meal: Booking, booked?: boolean): Promise<Booking> {
    return await this.fetchData(
      Capabilities.CANTEEN_BOOKINGS,
      async client =>
        client.setMealAsBooked
          ? await client.setMealAsBooked(meal, booked)
          : meal,
      { multiple: false, clientId: meal.createdByAccount }
    );
  }

  clientHasCapatibility(capatibility: Capabilities, clientId: string): boolean {
    const client = this.clients[clientId];
    if (client?.capabilities.includes(capatibility)) {
      return true;
    }
    return false;
  }

  getAvailableClients(capability: Capabilities): SchoolServicePlugin[] {
    return Object.values(this.clients).filter(client =>
      client.capabilities.includes(capability)
    );
  }

  private async handleHasInternet<T>(
    options?: FetchOptions<T | T[]>
  ): Promise<T | T[] | void> {
    const networkState = await Network.getNetworkStateAsync();
    const hasInternet = networkState.isInternetReachable ?? false;
    if (!hasInternet) {
      warn("No internet connection, using fallback if available.");
      if (options?.fallback) {
        return await options.fallback();
      }
      throw new Error("Internet not reachable and no fallback provided.");
    }
  }

  private async fetchData<T>(
    capability: Capabilities,
    callback: (client: SchoolServicePlugin) => Promise<T[]>,
    options?: FetchOptions<T[]> & { multiple: true }
  ): Promise<T[]>;

  private async fetchData<T>(
    capability: Capabilities,
    callback: (client: SchoolServicePlugin) => Promise<T>,
    options?: FetchOptions<T> & { multiple?: false }
  ): Promise<T>;

  private async fetchData<T>(
    capability: Capabilities,
    callback: (client: SchoolServicePlugin) => Promise<T | T[]>,
    options?: FetchOptions<T | T[]> & { multiple?: boolean }
  ): Promise<T | T[]> {
    const resultFromFallback = await this.handleHasInternet<T>(options);
    if (resultFromFallback !== undefined) {
      return resultFromFallback;
    }
    try {
      if (options?.clientId !== undefined) {
        let client = this.clients[options.clientId];
        if (!client) {
          // Client ID not found (e.g. legacy service removed) — fall back to any client with this capability
          warn("Client ID " + options.clientId + " not found, trying fallback client with capability " + capability);
          const fallbackClients = this.getAvailableClients(capability);
          if (fallbackClients.length > 0) {
            client = fallbackClients[0];
          } else {
            if (options?.fallback) {
              return await options.fallback();
            }
            warn("Client ID missing and no fallback client available");
            throw new Error("Client ID missing");
          }
        }
        if (!client.capabilities.includes(capability)) {
          warn(
            "Capability " +
            capability +
            " not supported by client " +
            options.clientId
          );
        }
        const result = await callback(client);
        if (options.saveToCache) {
          options.saveToCache(result).catch(e => warn("Cache save failed: " + e));
        }
        return result;
      }

      const availableClients = this.getAvailableClients(capability);

      if (availableClients.length === 0) {
        if (options?.fallback) {
          return await options.fallback();
        }
        throw new Error(`No clients available for capability: ${capability}`);
      }

      if (options?.multiple) {
        const results = await Promise.all(
          availableClients.map(client => callback(client) as Promise<T[]>)
        );
        const combinedResult = results.flat();

        if (options?.saveToCache) {
          options.saveToCache(combinedResult).catch(e => warn("Cache save failed: " + e));
        }

        return combinedResult;
      } else {
        const result = await callback(availableClients[0]);
        if (options?.saveToCache) {
          options.saveToCache(result).catch(e => warn("Cache save failed: " + e));
        }
        return result;
      }
    } catch (e) {
      if (options?.fallback) {
        return await options.fallback();
      }
      throw e;
    }

    error(
      "An error occurred while fetching data for capability: " + capability
    );
  }

  private getServicePluginForAccount(
    service: ServiceAccount
  ): SchoolServicePlugin | null {
    if (service.serviceId === Services.MULTI) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require("@/services/multi/index");
      return new module.Multi(service.id);
    }

    if (service.serviceId === Services.IZLY) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require("@/services/izly/index");
      return new module.Izly(service.id);
    }

    if (service.serviceId === Services.INTRACOM) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require("@/services/intracom/index");
      return new module.Intracom(service.id);
    }

    if (service.serviceId === Services.ATTENDANCE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require("@/services/absences/index");
      return new module.Attendance(service.id);
    }

    // Unknown service (e.g. legacy AURIGA entries) — skip gracefully
    warn(
      "No plugin for service: " + service.serviceId + ", skipping.",
      "AccountManager.getServicePluginForAccount"
    );
    return null;
  }
}

let globalManager: AccountManager | null = null;
const managerListeners: Array<(manager: AccountManager) => void> = [];

export const subscribeManagerUpdate = (
  listener: (manager: AccountManager) => void
) => {
  managerListeners.push(listener);
  if (globalManager) {
    listener(globalManager);
  }
  return () => {
    const idx = managerListeners.indexOf(listener);
    if (idx !== -1) {
      managerListeners.splice(idx, 1);
    }
  };
};

const notifyManagerListeners = (manager: AccountManager) => {
  managerListeners.forEach(listener => listener(manager));
};

export const initializeAccountManager = async (
  accountId?: string,
  options?: { forceRefresh?: boolean }
): Promise<AccountManager> => {
  const store = useAccountStore.getState();

  if (!accountId) {
    accountId = store.lastUsedAccount;
    if (!accountId && store.accounts.length > 0) {
      // Auto-select first account if lastUsedAccount is empty
      accountId = store.accounts[0].id;
      store.setLastUsedAccount(accountId);
      warn("No last used account found, auto-selected first account: " + accountId);
    }
    if (!accountId) {
      error("No account ID provided and no last used account found.");
    }
  }
  const account = store.accounts.find(acc => acc.id === accountId);

  if (!account) {
    error("Account not found for ID: " + accountId);
  }

  const manager = new AccountManager(account);
  await manager.refreshAllAccounts(options?.forceRefresh);
  globalManager = manager;
  notifyManagerListeners(manager);
  return manager;
};

export const getManager = (): AccountManager => {
  if (!globalManager) {
    warn(
      "Account manager not initialized. Call initializeAccountManager first."
    );
  }
  return globalManager;
};
