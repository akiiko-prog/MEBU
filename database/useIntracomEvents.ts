import { Model, Q } from "@nozbe/watermelondb";

import { error, info } from "@/utils/logger/logger";

import { getDatabaseInstance } from "./DatabaseProvider";
import IntracomBonus from "./models/IntracomBonus";
import IntracomEvent from "./models/IntracomEvent";
import IntracomRegisteredEvent from "./models/IntracomRegisteredEvent";
import { safeWrite } from "./utils/safeTransaction";

export interface IntracomEventData {
    id: number;
    date: string;
    type: string;
    name: string;
    campusSlug: string;
    registeredStudents: number;
    nbNewStudents: number;
    maxStudents: number;
    state: "OPEN" | "CLOSED";
    address?: string;
    zipcode?: string;
    town?: string;
    latitude?: number;
    longitude?: number;
    slotTimes?: string;
    participants?: string;
    bonus?: number;
}

export async function saveIntracomEventsToDatabase(
    events: IntracomEventData[],
    accountId: string
): Promise<void> {
    const db = getDatabaseInstance();

    await safeWrite(
        db,
        async () => {
            for (const event of events) {
                const existing = await db
                    .get<IntracomEvent>("intracom_events")
                    .query(Q.where("eventId", event.id))
                    .fetch();

                if (existing.length > 0) {
                    await existing[0].update((record: Model) => {
                        const intracomEvent = record as IntracomEvent;
                        Object.assign(intracomEvent, {
                            date: new Date(event.date).getTime(),
                            type: event.type,
                            name: event.name,
                            campusSlug: event.campusSlug,
                            registeredStudents: event.registeredStudents,
                            nbNewStudents: event.nbNewStudents,
                            maxStudents: event.maxStudents,
                            state: event.state,
                            ...(event.address && { address: event.address }),
                            ...(event.zipcode && { zipcode: event.zipcode }),
                            ...(event.town && { town: event.town }),
                            ...(event.latitude && { latitude: event.latitude }),
                            ...(event.longitude && { longitude: event.longitude }),
                            ...(event.slotTimes && { slotTimes: event.slotTimes }),
                            ...(event.participants && { participants: event.participants }),
                        });
                    });
                } else {
                    await db.get("intracom_events").create((record: Model) => {
                        const intracomEvent = record as IntracomEvent;
                        Object.assign(intracomEvent, {
                            eventId: event.id,
                            date: new Date(event.date).getTime(),
                            type: event.type,
                            name: event.name,
                            campusSlug: event.campusSlug,
                            registeredStudents: event.registeredStudents,
                            nbNewStudents: event.nbNewStudents,
                            maxStudents: event.maxStudents,
                            state: event.state,
                            createdByAccount: accountId,
                            ...(event.address && { address: event.address }),
                            ...(event.zipcode && { zipcode: event.zipcode }),
                            ...(event.town && { town: event.town }),
                            ...(event.latitude && { latitude: event.latitude }),
                            ...(event.longitude && { longitude: event.longitude }),
                            ...(event.slotTimes && { slotTimes: event.slotTimes }),
                            ...(event.participants && { participants: event.participants }),
                        });
                    });
                }
            }

            const newEventIds = events.map(e => e.id);
            const allExistingEvents = await db
                .get<IntracomEvent>("intracom_events")
                .query(
                    Q.where("createdByAccount", accountId),
                )
                .fetch();

            const staleEvents = allExistingEvents.filter(e => !newEventIds.includes(e.eventId));

            for (const event of staleEvents) {
                await event.markAsDeleted();
                await event.destroyPermanently();
            }

            info(`[DB] | Événements Intracom sauvegardés : ${events.length}, événements obsolètes supprimés : ${staleEvents.length}`);
        },
        10000,
        "saveIntracomEventsToDatabase"
    );
}

export async function saveRegisteredIntracomEvents(
    events: IntracomEventData[],
    accountId: string
): Promise<void> {
    const db = getDatabaseInstance();

    await safeWrite(
        db,
        async () => {
            for (const event of events) {
                const existing = await db
                    .get<IntracomRegisteredEvent>("intracom_registered_events")
                    .query(Q.where("eventId", event.id))
                    .fetch();

                if (existing.length > 0) {
                    await existing[0].update((record: Model) => {
                        const intracomEvent = record as IntracomRegisteredEvent;
                        Object.assign(intracomEvent, {
                            date: new Date(event.date).getTime(),
                            type: event.type,
                            name: event.name,
                            campusSlug: event.campusSlug,
                            registeredStudents: event.registeredStudents,
                            nbNewStudents: event.nbNewStudents,
                            maxStudents: event.maxStudents,
                            state: event.state,
                            ...(event.address && { address: event.address }),
                            ...(event.zipcode && { zipcode: event.zipcode }),
                            ...(event.town && { town: event.town }),
                            ...(event.latitude && { latitude: event.latitude }),
                            ...(event.longitude && { longitude: event.longitude }),
                            ...(event.slotTimes && { slotTimes: event.slotTimes }),
                            ...(event.participants && { participants: event.participants }),
                        });
                    });
                } else {
                    await db.get("intracom_registered_events").create((record: Model) => {
                        const intracomEvent = record as IntracomRegisteredEvent;
                        Object.assign(intracomEvent, {
                            eventId: event.id,
                            date: new Date(event.date).getTime(),
                            type: event.type,
                            name: event.name,
                            campusSlug: event.campusSlug,
                            registeredStudents: event.registeredStudents,
                            nbNewStudents: event.nbNewStudents,
                            maxStudents: event.maxStudents,
                            state: event.state,
                            createdByAccount: accountId,
                            ...(event.address && { address: event.address }),
                            ...(event.zipcode && { zipcode: event.zipcode }),
                            ...(event.town && { town: event.town }),
                            ...(event.latitude && { latitude: event.latitude }),
                            ...(event.longitude && { longitude: event.longitude }),
                            ...(event.slotTimes && { slotTimes: event.slotTimes }),
                            ...(event.participants && { participants: event.participants }),
                        });
                    });
                }
            }

            const newEventIds = events.map(e => e.id);
            const allExistingEvents = await db
                .get<IntracomRegisteredEvent>("intracom_registered_events")
                .query(
                    Q.where("createdByAccount", accountId),
                )
                .fetch();

            const staleEvents = allExistingEvents.filter(e => !newEventIds.includes(e.eventId));

            for (const event of staleEvents) {
                await event.markAsDeleted();
                await event.destroyPermanently();
            }

            info(`[DB] | Événements Intracom ENREGISTRÉS sauvegardés : ${events.length}, événements obsolètes supprimés : ${staleEvents.length}`);
        },
        10000,
        "saveRegisteredIntracomEvents"
    );
}



export async function getRegisteredIntracomEventsFromCache(
    accountId: string
): Promise<IntracomEventData[]> {
    try {
        const db = getDatabaseInstance();
        const events = await db
            .get<IntracomRegisteredEvent>("intracom_registered_events")
            .query(
                Q.where("createdByAccount", accountId),
                Q.where("state", "OPEN") // User specific: only OPEN events
            )
            .fetch();

        return events.map((event) => ({
            id: event.eventId,
            date: new Date(event.date).toISOString(),
            type: event.type,
            name: event.name,
            campusSlug: event.campusSlug,
            registeredStudents: event.registeredStudents,
            nbNewStudents: event.nbNewStudents,
            maxStudents: event.maxStudents,
            state: event.state as "OPEN" | "CLOSED",
            address: event.address,
            zipcode: event.zipcode,
            town: event.town,
            latitude: event.latitude,
            longitude: event.longitude,
            slotTimes: event.slotTimes,
            participants: event.participants,
        }));
    } catch (e) {
        error(`Failed to get Intracom registered events from cache: ${e}`);
        return [];
    }
}

export async function getIntracomEventsFromCache(
    accountId: string
): Promise<IntracomEventData[]> {
    try {
        const db = getDatabaseInstance();
        const events = await db
            .get<IntracomEvent>("intracom_events")
            .query(
                Q.where("createdByAccount", accountId),
                Q.where("date", Q.gte(new Date().getTime() - 86400000)) // Keep last 24h
            )
            .fetch();

        return events.map((event) => ({
            id: event.eventId,
            date: new Date(event.date).toISOString(),
            type: event.type,
            name: event.name,
            campusSlug: event.campusSlug,
            registeredStudents: event.registeredStudents,
            nbNewStudents: event.nbNewStudents,
            maxStudents: event.maxStudents,
            state: event.state as "OPEN" | "CLOSED",
            address: event.address,
            zipcode: event.zipcode,
            town: event.town,
            latitude: event.latitude,
            longitude: event.longitude,
            slotTimes: event.slotTimes,
            participants: event.participants,
        }));
    } catch (e) {
        error(`Failed to get Intracom events from cache: ${e}`);
        return [];
    }
}

export async function clearIntracomEventsForAccount(
    accountId: string
): Promise<void> {
    const db = getDatabaseInstance();

    await safeWrite(
        db,
        async () => {
            // Clear Events
            const events = await db
                .get<IntracomEvent>("intracom_events")
                .query(Q.where("createdByAccount", accountId))
                .fetch();

            for (const event of events) {
                await event.markAsDeleted();
                await event.destroyPermanently();
            }

            const registeredEvents = await db
                .get<IntracomRegisteredEvent>("intracom_registered_events")
                .query(Q.where("createdByAccount", accountId))
                .fetch();

            for (const event of registeredEvents) {
                await event.markAsDeleted();
                await event.destroyPermanently();
            }

            const bonuses = await db
                .get<IntracomBonus>("intracom_bonus")

            for (const bonus of bonuses) {
                await bonus.markAsDeleted();
                await bonus.destroyPermanently();
            }
        },
        10000,
    );
}

export async function cleanupOldIntracomEvents(
    accountId: string
): Promise<void> {
    const db = getDatabaseInstance();

    await safeWrite(
        db,
        async () => {
            const oldEvents = await db
                .get<IntracomEvent>("intracom_events")
                .query(
                    Q.where("createdByAccount", accountId),
                    Q.where("date", Q.lt(new Date().getTime() - 86400000)) // Older than 24h
                )
                .fetch();

            for (const event of oldEvents) {
                await event.markAsDeleted();
                await event.destroyPermanently();
            }
            if (oldEvents.length > 0) {
                info(`[DB] | Nettoyage de ${oldEvents.length} anciens événements Intracom`);
            }
        },
        10000,
        "cleanupOldIntracomEvents"
    );
}

export interface IntracomEventDetailsData {
    address: string;
    zipcode: string;
    town: string;
    latitude: number;
    longitude: number;
}

export async function updateIntracomEventDetails(
    eventId: number,
    details: IntracomEventDetailsData
): Promise<void> {
    const db = getDatabaseInstance();

    await safeWrite(
        db,
        async () => {
            const existing = await db
                .get<IntracomEvent>("intracom_events")
                .query(Q.where("eventId", eventId))
                .fetch();

            if (existing.length > 0) {
                await existing[0].update((record: Model) => {
                    const intracomEvent = record as IntracomEvent;
                    Object.assign(intracomEvent, {
                        address: details.address,
                        zipcode: details.zipcode,
                        town: details.town,
                        latitude: details.latitude,
                        longitude: details.longitude,
                    });
                });
            }
        },
        10000,
        "updateIntracomEventDetails"
    );
}

export async function getIntracomEventDetailsFromCache(
    eventId: number
): Promise<IntracomEventDetailsData | null> {
    try {
        const db = getDatabaseInstance();
        const events = await db
            .get<IntracomEvent>("intracom_events")
            .query(Q.where("eventId", eventId))
            .fetch();

        if (events.length > 0 && events[0].latitude) {
            return {
                address: events[0].address || '',
                zipcode: events[0].zipcode || '',
                town: events[0].town || '',
                latitude: events[0].latitude,
                longitude: events[0].longitude || 0,
            };
        }
        return null;
    } catch (e) {
        error(`Failed to get Intracom event details from cache: ${e}`);
        return null;
    }
}

export async function updateIntracomEventSlots(
    eventId: number,
    slotTimes: { start: string; end: string } | null,
    participants: any[]
): Promise<void> {
    const db = getDatabaseInstance();

    await safeWrite(
        db,
        async () => {
            const existing = await db
                .get<IntracomEvent>("intracom_events")
                .query(Q.where("eventId", eventId))
                .fetch();

            if (existing.length > 0) {
                await existing[0].update((record: Model) => {
                    const intracomEvent = record as IntracomEvent;
                    Object.assign(intracomEvent, {
                        slotTimes: JSON.stringify(slotTimes),
                        participants: JSON.stringify(participants),
                    });
                });
            }
        },
        10000,
        "updateIntracomEventSlots"
    );
}

import { getIntracomRequestHeaders } from "@/utils/intracomAuth";

export async function fetchIntracomBonus(token: string): Promise<void> {
    try {
        const headers = await getIntracomRequestHeaders(token);

        let studentId = "5808";
        try {
            const meRes = await fetch("https://intracom.epita.fr/api/Students/me", {
                headers: headers
            });
            if (meRes.ok) {
                const me = await meRes.json();
                if (me.id) { studentId = me.id.toString(); }
            }
        } catch (e) {
            info(`[Intracom] Failed to get user ID, using fallback: ${e}`);
        }

        const res = await fetch(`https://intracom.epita.fr/api/Students/${studentId}/Events`, {
            headers: headers
        });

        if (res.ok) {
            const data = await res.json();
            let totalBonus = 0;
            const fullHistory: any[] = [];

            if (Array.isArray(data)) {
                const latestSemester = data[data.length - 1];

                data.forEach((semester: any) => {
                    const semesterEvents: any[] = [];
                    if (semester.events && Array.isArray(semester.events)) {
                        semester.events.forEach((evt: any) => {
                            const b = evt.bonus || 0;
                            if (b > 0) {
                                if (semester === latestSemester) {
                                    totalBonus += b;
                                }

                                semesterEvents.push({
                                    id: evt.id,
                                    date: evt.date, // API sends "date": "YYYY-MM-DD"
                                    type: evt.type, // number
                                    typeName: evt.typeName, // string
                                    name: evt.title,
                                    campusSlug: "unknown",
                                    registeredStudents: 0,
                                    nbNewStudents: 0,
                                    maxStudents: 0,
                                    state: "CLOSED",
                                    bonus: b,
                                    address: evt.location?.address,
                                    town: evt.location?.town,
                                });
                            }
                        });

                        semesterEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    }

                    fullHistory.push({
                        startTime: semester.startTime,
                        endTime: semester.endTime,
                        events: semesterEvents
                    });
                });
            }

            const db = getDatabaseInstance();
            await safeWrite(db, async () => {
                const existing = await db.get<IntracomBonus>("intracom_bonus").query().fetch();
                if (existing.length > 0) {
                    await existing[0].update((rec: Model) => {
                        const r = rec as IntracomBonus;
                        r.total = totalBonus;
                        r.updatedAt = new Date().getTime();
                        r.studentId = studentId;
                        r.history = JSON.stringify(fullHistory);
                    });
                } else {
                    await db.get<IntracomBonus>("intracom_bonus").create((rec: Model) => {
                        const r = rec as IntracomBonus;
                        r.total = totalBonus;
                        r.updatedAt = new Date().getTime();
                        r.studentId = studentId;
                        r.history = JSON.stringify(fullHistory);
                    });
                }
            });
        }
    } catch (e) {
        error(`[Intracom] Failed to fetch bonus: ${e}`);
    }
}

export async function getIntracomBonusFromCache(): Promise<number | null> {
    try {
        const db = getDatabaseInstance();
        const bonuses = await db.get<IntracomBonus>("intracom_bonus").query().fetch();
        if (bonuses.length > 0) {
            return bonuses[0].total;
        }
        return null;
    } catch (e) {
        return null;
    }
}
