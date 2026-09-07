package expo.modules.androidwidgetupdater

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.epimac.chrysalide.widgets.AbsencesWidget
import org.epimac.chrysalide.widgets.TimetableWidget
import org.epimac.chrysalide.widgets.GradesSmallWidget
import org.epimac.chrysalide.widgets.GradesLargeWidget

private const val PREFS = "chrysalide_widget_prefs"

class AndroidWidgetUpdaterModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("AndroidWidgetUpdater")

        // ── Absences ──────────────────────────────────────────────────────────
        Function("syncAbsences") { count: Int, unjustified: Int, lastSubject: String ->
            val context = appContext.reactContext ?: return@Function
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putInt("absences_count", count)
                .putInt("absences_unjustified", unjustified)
                .putString("absences_last_subject", lastSubject)
                .apply()

            broadcastUpdate(context, AbsencesWidget::class.java)
        }

        // ── Timetable ─────────────────────────────────────────────────────────
        Function("syncTimetable") { courseName: String, room: String, time: String, coursesCount: Int ->
            val context = appContext.reactContext ?: return@Function
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("timetable_course", courseName)
                .putString("timetable_room", room)
                .putString("timetable_time", time)
                .putInt("timetable_count", coursesCount)
                .apply()

            broadcastUpdate(context, TimetableWidget::class.java)
        }

        // ── Grades ────────────────────────────────────────────────────────────
        Function("syncGrades") { averageStr: String, gradesJson: String ->
            val context = appContext.reactContext ?: return@Function
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("grades_average", averageStr)
                .putString("grades_list", gradesJson)
                .apply()

            broadcastUpdate(context, GradesSmallWidget::class.java)
            broadcastUpdate(context, GradesLargeWidget::class.java)
        }

        // ── Utilitaire general ────────────────────────────────────────────────
        Function("updateAllWidgets") {
            val context = appContext.reactContext ?: return@Function
            listOf(AbsencesWidget::class.java, TimetableWidget::class.java, GradesSmallWidget::class.java, GradesLargeWidget::class.java)
                .forEach { broadcastUpdate(context, it) }
        }
    }

    private fun broadcastUpdate(context: Context, widgetClass: Class<*>) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, widgetClass))
        if (ids.isNotEmpty()) {
            val intent = Intent(context, widgetClass).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }
}
