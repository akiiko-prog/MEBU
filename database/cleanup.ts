import { Q } from "@nozbe/watermelondb";

import { info } from "@/utils/logger/logger";

import { getDatabaseInstance } from "./DatabaseProvider";
import { Attendance } from "./models/Attendance";
import CanteenHistoryItem from "./models/CanteenHistory";
import CanteenMenu from "./models/CanteenMenu";
import { Grade, Period, PeriodGrades } from "./models/Grades";
import Homework from "./models/Homework";
import IntracomBonus from "./models/IntracomBonus";
import IntracomEvent from "./models/IntracomEvent";
import IntracomRegisteredEvent from "./models/IntracomRegisteredEvent";
import Subject from "./models/Subject";
import Course from "./models/Timetable";
import { safeWrite } from "./utils/safeTransaction";


/**
 * Clears all data associated with Auriga service (Grades, Timetable, Canteen, etc.) for an account.
 */
export async function clearAurigaData(accountId: string) {
    const db = getDatabaseInstance();
    await safeWrite(db, async () => {
        info(`Cleaning Auriga data for account ${accountId}...`);

        const grades = await db.get<Grade>("grades").query(Q.where("createdByAccount", accountId)).fetch();
        for (const g of grades) { await g.markAsDeleted(); await g.destroyPermanently(); }

        const periodGrades = await db.get<PeriodGrades>("periodgrades").query(Q.where("createdByAccount", accountId)).fetch();
        for (const pg of periodGrades) {
            try {
                const subjects = await db.get<Subject>("subjects").query(Q.where("periodGradeId", pg.id)).fetch();
                for (const s of subjects) { await s.markAsDeleted(); await s.destroyPermanently(); }
            } catch (e) { }

            await pg.markAsDeleted();
            await pg.destroyPermanently();
        }

        const periods = await db.get<Period>("periods").query(Q.where("createdByAccount", accountId)).fetch();
        for (const p of periods) { await p.markAsDeleted(); await p.destroyPermanently(); }

        const homeworks = await db.get<Homework>("homework").query(Q.where("createdByAccount", accountId)).fetch();
        for (const hp of homeworks) { await hp.markAsDeleted(); await hp.destroyPermanently(); }

        const courses = await db.get<Course>("courses").query(Q.where("createdByAccount", accountId)).fetch();
        for (const c of courses) { await c.markAsDeleted(); await c.destroyPermanently(); }

        const menus = await db.get<CanteenMenu>("canteenmenus").query(Q.where("createdByAccount", accountId)).fetch();
        for (const m of menus) { await m.markAsDeleted(); await m.destroyPermanently(); }

        const transactions = await db.get<CanteenHistoryItem>("canteentransactions").query(Q.where("createdByAccount", accountId)).fetch();
        for (const t of transactions) { await t.markAsDeleted(); await t.destroyPermanently(); }

        try {
            const kids = await db.get("kids").query(Q.where("createdByAccount", accountId)).fetch();
            for (const k of kids) { await k.markAsDeleted(); await k.destroyPermanently(); }

            const balances = await db.get("balances").query(Q.where("createdByAccount", accountId)).fetch();
            for (const b of balances) { await b.markAsDeleted(); await b.destroyPermanently(); }
        } catch (e) { /* table might not exist or model not imported generically */ }

        info(`Auriga data cleaned.`);
    }, 20000, "clearAurigaData");
}


/**
 * Clears all Attendance data for an account.
 */
export async function clearAttendanceData(accountId: string) {
    const db = getDatabaseInstance();
    await safeWrite(db, async () => {
        info(`Cleaning Attendance data for account ${accountId}...`);
        const attendances = await db.get<Attendance>("attendance").query(Q.where("createdByAccount", accountId)).fetch();
        for (const att of attendances) {
            try {
                const delays = await att.delays.fetch();
                for (const d of delays) { await d.markAsDeleted(); await d.destroyPermanently(); }

                const absences = await att.absences.fetch();
                for (const a of absences) { await a.markAsDeleted(); await a.destroyPermanently(); }

                const observations = await att.observations.fetch();
                for (const o of observations) { await o.markAsDeleted(); await o.destroyPermanently(); }

                const punishments = await att.punishments.fetch();
                for (const p of punishments) { await p.markAsDeleted(); await p.destroyPermanently(); }
            } catch (e) { console.error("Error clearing sub-attendance items", e); }

            await att.markAsDeleted();
            await att.destroyPermanently();
        }
        info(`Attendance data cleaned.`);
    }, 10000, "clearAttendanceData");
}

/**
 * Clears Intracom data.
 */
export async function clearIntracomData(accountId: string) {
    const db = getDatabaseInstance();
    await safeWrite(db, async () => {
        info(`Cleaning Intracom data for account ${accountId}...`);

        const events = await db.get<IntracomEvent>("intracom_events").query(Q.where("createdByAccount", accountId)).fetch();
        for (const e of events) { await e.markAsDeleted(); await e.destroyPermanently(); }

        const regEvents = await db.get<IntracomRegisteredEvent>("intracom_registered_events").query(Q.where("createdByAccount", accountId)).fetch();
        for (const re of regEvents) { await re.markAsDeleted(); await re.destroyPermanently(); }

        const bonuses = await db.get<IntracomBonus>("intracom_bonus").query().fetch();
        for (const b of bonuses) { await b.markAsDeleted(); await b.destroyPermanently(); }

        info(`Intracom data cleaned.`);
    });
}
