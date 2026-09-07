import { useEffect, useMemo, useRef, useState } from "react";

import { getChatsFromCache } from "@/database/useChat";
import AbsencesAPI from "@/services/absences";
import {
  AccountManager,
  getManager,
  subscribeManagerUpdate,
} from "@/services/shared";
import { Attendance } from "@/services/shared/attendance";
import { Chat } from "@/services/shared/chat";
import { Period } from "@/services/shared/grade";
import { useAccountStore } from "@/stores/account";
import { Services } from "@/stores/account/types";
import { getCurrentPeriod } from "@/utils/grades/helper/period";
import { syncAbsencesToWidget } from "@/utils/widget/syncAbsences";

export const useHomeHeaderData = () => {
  const accounts = useAccountStore(state => state.accounts);
  const lastUsedAccount = useAccountStore(state => state.lastUsedAccount);
  const account = accounts.find(a => a.id === lastUsedAccount);

  const availableCanteenCards = useMemo(
    () =>
      account?.services.filter(service =>
        [
          Services.IZLY,
        ].includes(service.serviceId)
      ) ?? [],
    [account]
  );

  const attendancesPeriodsRef = useRef<Period[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [lastAbsence, setLastAbsence] = useState<any>(null);
  const [totalAbsenceHours, setTotalAbsenceHours] = useState<number>(0);
  const [lastSubjectName, setLastSubjectName] = useState<string | null>(null);

  const absencesCount = useMemo(() => {
    if (!attendances) {
      return 0;
    }
    let count = 0;
    attendances.forEach(att => {
      if (att && "absences" in att) {
        if (att.absences) {
          count += att.absences.length;
        }
      }
    });
    return count;
  }, [attendances]);

  useEffect(() => {
    const init = async () => {
      const cachedChats = await getChatsFromCache();
      setChats(cachedChats);
    };

    init();

    const updateAttendance = async (manager: AccountManager) => {
      try {
        if (!AbsencesAPI.isLoggedIn()) {
          try {
            const { getValidAttendanceToken } = await import('@/utils/attendanceAuth');
            const token = await getValidAttendanceToken();
            if (token) {
              AbsencesAPI.setToken(token);
              console.log('[useHomeHeaderData] Attendance token restored from SecureStore');
            }
          } catch (restoreErr) {
            console.warn('[useHomeHeaderData] Could not restore attendance token:', restoreErr);
          }
        }

        let rawData: any[] = [];
        try {
          rawData = await AbsencesAPI.initializeFromDatabase() || [];
        } catch (e) { }

        if (AbsencesAPI.isLoggedIn()) {
          try {
            const freshData = await AbsencesAPI.sync();
            if (freshData && freshData.length > 0) {
              rawData = freshData;
            }
          } catch (absErr) {
            console.warn("[useHomeHeaderData] AbsencesAPI sync failed, using cache:", absErr);
          }
        }

        if (rawData && rawData.length > 0) {
              const mappedPeriods: Period[] = rawData.map((level: any) => ({
                id: level.levelName,
                name: level.levelName,
                start: new Date(),
                end: new Date(0),
                createdByAccount: "auriga",
              }));

              attendancesPeriodsRef.current = mappedPeriods;

              const allAbsences: any[] = [];
              rawData.forEach((level: any) => {
                level.periods?.forEach((p: any) => {
                  p.absences?.forEach((abs: any) => {
                    allAbsences.push({
                      id: String(abs.slotId),
                      from: new Date(abs.startDate),
                      to: new Date(new Date(abs.startDate).getTime() + 60 * 60 * 1000),
                      timeMissed: 60,
                      justified: !!abs.justificatory,
                      reason: abs.justificatory || abs.subjectName,
                      subjectName: abs.subjectName,
                      createdByAccount: "auriga",
                    });
                  });
                });
              });

              allAbsences.sort((a, b) => a.from.getTime() - b.from.getTime());

              const consolidated: any[] = [];
              if (allAbsences.length > 0) {
                let current = { ...allAbsences[0] };
                for (let i = 1; i < allAbsences.length; i++) {
                  const next = allAbsences[i];
                  const isSameSubject = current.subjectName === next.subjectName;
                  const isSameJustification = current.justified === next.justified;
                  const isSameDay = new Date(current.from).toDateString() === new Date(next.from).toDateString();
                  if (isSameSubject && isSameJustification && isSameDay) {
                    current.to = new Date(Math.max(new Date(current.to).getTime(), new Date(next.to).getTime()));
                    current.timeMissed = (current.timeMissed ?? 60) + (next.timeMissed ?? 60);
                  } else {
                    consolidated.push(current);
                    current = { ...next };
                  }
                }
                consolidated.push(current);
              }

              consolidated.sort((a, b) => new Date(b.from).getTime() - new Date(a.from).getTime());

              const fakeAttendance: Attendance = {
                id: "auriga",
                kidId: "me",
                createdByAccount: "auriga",
                absences: consolidated,
                delays: [],
                punishments: [],
                observations: [],
              };

              setAttendances([fakeAttendance]);
              setLastAbsence(consolidated.length > 0 ? consolidated[0] : null);
              setLastSubjectName(consolidated[0]?.subjectName ?? null);

              const totalMinutes = consolidated.reduce((acc: number, a: any) => acc + (a.timeMissed ?? 60), 0);
              const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
              const unjustifiedMinutes = consolidated
                .filter((a: any) => !a.justified)
                .reduce((acc: number, a: any) => acc + (a.timeMissed ?? 60), 0);
              const unjustifiedHours = Math.round((unjustifiedMinutes / 60) * 10) / 10;
              setTotalAbsenceHours(totalHours);

              syncAbsencesToWidget({
                totalHours,
                unjustifiedHours,
                lastSubject: consolidated[0]?.subjectName ?? "—",
              });

              return;
            }
        if (!manager.clientHasCapatibility(4 as any, manager.getAccount().services[0].id)) {
          console.log("[useHomeHeaderData] Account does not support ATTENDANCE, skipping.");
          return;
        }

        const periods = await manager.getAttendancePeriods();
        const currentPeriod = getCurrentPeriod(periods);

        attendancesPeriodsRef.current = periods;

        if (currentPeriod) {
          const fetchedAttendances = await manager.getAttendanceForPeriod(
            currentPeriod.name
          );
          setAttendances(fetchedAttendances);
        } else {
          setAttendances([]);
        }

        const allPromises = periods.map(p => manager.getAttendanceForPeriod(p.name));
        const allResults = await Promise.all(allPromises);

        const allAbsences: any[] = [];
        allResults.flat().forEach(att => {
          if (att.absences) {
            att.absences.forEach((abs: any) => {
              if (!abs.from) abs.from = abs.date || abs.startDate;
              allAbsences.push(abs);
            });
          }
        });

        allAbsences.sort((a, b) => new Date(b.from).getTime() - new Date(a.from).getTime());

        if (allAbsences.length > 0) {
          setLastAbsence(allAbsences[0]);
        } else {
          setLastAbsence(null);
        }
      } catch (e) {
        console.log("[useHomeHeaderData] Skipped attendance fetch: ", e);
      }
    };

    const updateDiscussions = async (manager: AccountManager) => {
      try {
        if (!manager.clientHasCapatibility(7 as any, manager.getAccount().services[0].id)) {
          console.log("[useHomeHeaderData] Account does not support CHAT_READ, skipping.");
          return;
        }
        const fetchedChats = await manager.getChats();
        setChats(fetchedChats);
      } catch (e) {
        console.log("[useHomeHeaderData] Skipped chats fetch: ", e);
      }
    };

    const unsubscribe = subscribeManagerUpdate(_ => {
      const manager = getManager();
      updateAttendance(manager);
      updateDiscussions(manager);
    });

    const manager = getManager();
    updateAttendance(manager);
    updateDiscussions(manager);

    return () => unsubscribe();
  }, []);

  return {
    availableCanteenCards,
    attendancesPeriods: attendancesPeriodsRef.current,
    attendances,
    absencesCount,
    lastAbsence,
    totalAbsenceHours,
    lastSubjectName,
    chats,
  };
};
