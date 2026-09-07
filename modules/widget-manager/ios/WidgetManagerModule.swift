import ExpoModulesCore
import WidgetKit

public class WidgetManagerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetManager")

    AsyncFunction("reloadAllTimelines") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
