import WidgetKit
import SwiftUI

// MARK: - Data Models

struct WidgetGrade: Codable {
    let subject: String
    let value: Double
    let outOf: Double
    let date: String

    var formattedDate: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fallback = ISO8601DateFormatter()
        let d = formatter.date(from: date) ?? fallback.date(from: date)
        guard let d else { return "" }
        let df = DateFormatter()
        df.dateStyle = .short
        df.timeStyle = .none
        return df.string(from: d)
    }

    var scoreOn20: Double {
        guard outOf > 0 else { return value }
        return (value / outOf) * 20.0
    }
}

struct GradesPayload: Codable {
    let average: Double
    let latestGrades: [WidgetGrade]
}

// MARK: - Shared Data Reader (reads the single JSON blob written by JS)

struct GradesSharedData {
    static let appGroup = "group.app.chrysalide.epita"
    static let key = "chrysalideGrades"

    static func load() -> GradesPayload {
        guard
            let raw = UserDefaults(suiteName: appGroup)?.string(forKey: key),
            let data = raw.data(using: .utf8),
            let payload = try? JSONDecoder().decode(GradesPayload.self, from: data)
        else {
            return GradesPayload(average: 0, latestGrades: [])
        }
        return payload
    }
}

// MARK: - Grade Color

func gradeColor(value: Double, outOf: Double) -> Color {
    let pct = outOf > 0 ? value / outOf : 0
    if pct >= 0.8 { return Color(red: 0.20, green: 0.78, blue: 0.35) }   // green
    if pct >= 0.5 { return Color(red: 0.00, green: 0.55, blue: 0.95) }   // blue
    return Color(red: 0.95, green: 0.30, blue: 0.25)                      // red
}

// MARK: - Accent

let accentBlue = Color(red: 0.00, green: 0.47, blue: 0.84)

// MARK: - Timeline Provider

struct GradesProvider: TimelineProvider {
    func placeholder(in context: Context) -> GradesEntry {
        GradesEntry(date: Date(), average: 7.5, grades: [
            WidgetGrade(subject: "Math", value: 16, outOf: 20, date: ""),
            WidgetGrade(subject: "Physique", value: 12.5, outOf: 20, date: ""),
            WidgetGrade(subject: "Info", value: 18, outOf: 20, date: ""),
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (GradesEntry) -> Void) {
        let p = GradesSharedData.load()
        completion(GradesEntry(date: Date(), average: p.average, grades: p.latestGrades))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GradesEntry>) -> Void) {
        let p = GradesSharedData.load()
        let entry = GradesEntry(date: Date(), average: p.average, grades: p.latestGrades)
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct GradesEntry: TimelineEntry {
    let date: Date
    let average: Double
    let grades: [WidgetGrade]
}

// MARK: - Small Widget

struct LatestGradesSm: View {
    let entry: GradesEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Header
            Label("Notes", systemImage: "graduationcap.fill")
                .font(.caption2.bold())
                .foregroundStyle(accentBlue)

            Spacer(minLength: 0)

            if entry.grades.isEmpty {
                Text("Ouvre l'app pour charger tes notes.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(Array(entry.grades.prefix(3).enumerated()), id: \.offset) { _, g in
                        HStack {
                            Text(g.subject)
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                            Spacer(minLength: 4)
                            Text(String(format: "%.1f", g.value))
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .foregroundStyle(gradeColor(value: g.value, outOf: g.outOf))
                        }
                    }
                }
            }

            Spacer(minLength: 0)

            Text("Chrysalide")
                .font(.system(size: 8, weight: .medium))
                .foregroundStyle(.tertiary)
        }
        .padding(7)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Medium Widget

struct AverageMd: View {
    let entry: GradesEntry

    var body: some View {
        HStack(spacing: 0) {
            // Left — average
            VStack(alignment: .leading, spacing: 4) {
                Label("Moyenne", systemImage: "chart.line.uptrend.xyaxis")
                    .font(.caption2.bold())
                    .foregroundStyle(accentBlue)

                Spacer(minLength: 0)

                HStack(alignment: .lastTextBaseline, spacing: 0) {
                    Text(entry.average > 0 ? String(format: "%.2f", entry.average) : "--")
                        .font(.system(size: 30, weight: .black, design: .rounded))
                        .foregroundStyle(gradeColor(value: entry.average, outOf: 20))
                    Text("/20")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .padding(.leading, 2)
                }

                Spacer(minLength: 0)

                Text("Chrysalide")
                    .font(.system(size: 8, weight: .medium))
                    .foregroundStyle(.tertiary)
            }
            .padding(.leading, 7)
            .frame(maxWidth: .infinity, alignment: .leading)

            // Divider
            Rectangle()
                .fill(.quaternary)
                .frame(width: 1, height: 56)
                .padding(.horizontal, 10)

            // Right — recent grades
            VStack(alignment: .leading, spacing: 4) {
                Text("Récentes")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.secondary)

                if entry.grades.isEmpty {
                    Text("Aucune note")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(Array(entry.grades.prefix(4).enumerated()), id: \.offset) { _, g in
                        HStack(spacing: 5) {
                            Circle()
                                .fill(gradeColor(value: g.value, outOf: g.outOf))
                                .frame(width: 5, height: 5)
                            Text(g.subject)
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                            Spacer()
                            Text(String(format: "%.1f", g.value))
                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                .foregroundStyle(gradeColor(value: g.value, outOf: g.outOf))
                        }
                    }
                }
            }
            .padding(.trailing, 7)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Large Widget

struct GradesLg: View {
    let entry: GradesEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Label("Notes — Chrysalide", systemImage: "graduationcap.fill")
                    .font(.caption.bold())
                    .foregroundStyle(accentBlue)
                Spacer()
                if entry.average > 0 {
                    HStack(alignment: .lastTextBaseline, spacing: 1) {
                        Text(String(format: "%.2f", entry.average))
                            .font(.system(size: 17, weight: .black, design: .rounded))
                            .foregroundStyle(gradeColor(value: entry.average, outOf: 20))
                        Text("/20")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 7)
            .padding(.bottom, 10)

            Divider()

            if entry.grades.isEmpty {
                Spacer()
                Text("Ouvre l'app pour charger tes notes.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                Spacer()
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(entry.grades.prefix(5).enumerated()), id: \.offset) { i, g in
                        HStack(spacing: 10) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(gradeColor(value: g.value, outOf: g.outOf))
                                .frame(width: 4, height: 30)

                            VStack(alignment: .leading, spacing: 1) {
                                Text(g.subject)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                                if !g.formattedDate.isEmpty {
                                    Text(g.formattedDate)
                                        .font(.system(size: 9))
                                        .foregroundStyle(.secondary)
                                }
                            }

                            Spacer()

                            HStack(alignment: .lastTextBaseline, spacing: 1) {
                                Text(String(format: "%.1f", g.value))
                                    .font(.system(size: 15, weight: .bold, design: .rounded))
                                    .foregroundStyle(gradeColor(value: g.value, outOf: g.outOf))
                                Text("/\(Int(g.outOf))")
                                    .font(.system(size: 10))
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 7)

                        if i < min(entry.grades.count, 5) - 1 {
                            Divider().padding(.leading, 36)
                        }
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Widget Definitions

struct LatestGradesWidget: Widget {
    let kind = "LatestGradesWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GradesProvider()) { entry in
            if #available(iOS 17.0, *) {
                LatestGradesSm(entry: entry)
                    .containerBackground(.background, for: .widget)
            } else {
                LatestGradesSm(entry: entry)
                    .padding()
                    .background(Color(UIColor.systemBackground))
            }
        }
        .configurationDisplayName("Dernières Notes")
        .description("Tes dernières notes directement depuis Chrysalide.")
        .supportedFamilies([.systemSmall])
    }
}

struct AverageWidget: Widget {
    let kind = "AverageWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GradesProvider()) { entry in
            if #available(iOS 17.0, *) {
                AverageMd(entry: entry)
                    .containerBackground(.background, for: .widget)
            } else {
                AverageMd(entry: entry)
                    .padding()
                    .background(Color(UIColor.systemBackground))
            }
        }
        .configurationDisplayName("Moyenne Générale")
        .description("Ta moyenne générale et tes dernières notes.")
        .supportedFamilies([.systemMedium])
    }
}

struct GradesDetailWidget: Widget {
    let kind = "GradesDetailWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: GradesProvider()) { entry in
            if #available(iOS 17.0, *) {
                GradesLg(entry: entry)
                    .containerBackground(.background, for: .widget)
            } else {
                GradesLg(entry: entry)
                    .padding()
                    .background(Color(UIColor.systemBackground))
            }
        }
        .configurationDisplayName("Notes Détaillées")
        .description("Tes 5 dernières notes avec dates et moyennes.")
        .supportedFamilies([.systemLarge])
    }
}
