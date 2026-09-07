import WidgetKit
import SwiftUI

// MARK: - Next Course Widget (from original ChrysalideWidget.swift)

struct CourseProvider: TimelineProvider {
    func placeholder(in context: Context) -> CourseEntry {
        CourseEntry(date: Date(), courseName: "Chargement...", room: "...")
    }

    func getSnapshot(in context: Context, completion: @escaping (CourseEntry) -> ()) {
        let entry = CourseEntry(date: Date(), courseName: "Mathématiques", room: "A301")
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let sharedDefaults = UserDefaults(suiteName: "group.app.chrysalide.epita")
        let courseName = sharedDefaults?.string(forKey: "nextCourseName") ?? "Aucun cours"
        let room = sharedDefaults?.string(forKey: "nextCourseRoom") ?? ""
        let entry = CourseEntry(date: Date(), courseName: courseName, room: room)
        let timeline = Timeline(entries: [entry], policy: .atEnd)
        completion(timeline)
    }
}

struct CourseEntry: TimelineEntry {
    let date: Date
    let courseName: String
    let room: String
}

struct CourseWidgetView: View {
    var entry: CourseProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: "calendar.badge.clock")
                    .font(.caption2.bold())
                    .foregroundColor(Color(red: 0, green: 0.47, blue: 0.83))
                Text("Prochain cours")
                    .font(.caption2.bold())
                    .foregroundColor(Color(red: 0, green: 0.47, blue: 0.83))
            }
            Spacer(minLength: 6)
            Text(entry.courseName)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.white)
                
            if !entry.room.isEmpty {
                Text(entry.room)
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
        }
        .padding(7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct CourseWidget: Widget {
    let kind: String = "ChrysalideWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CourseProvider()) { entry in
            if #available(iOS 17.0, *) {
                CourseWidgetView(entry: entry)
                    .containerBackground(.black, for: .widget)
            } else {
                CourseWidgetView(entry: entry)
                    .padding()
                    .background(Color.black)
            }
        }
        .configurationDisplayName("Prochain Cours")
        .description("Affiche ton prochain cours directement sur l'écran d'accueil.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Widget Bundle

@main
struct ChrysalideWidgetBundle: WidgetBundle {
    var body: some Widget {
        CourseWidget()
        LatestGradesWidget()
        AverageWidget()
        GradesDetailWidget()
    }
}
