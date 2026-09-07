import Foundation
import ActivityKit

struct PizzaDeliveryAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var driverName: String
        var deliveryTimer: ClosedRange<Date>
    }
    var numberOfPizzas: Int
    var totalAmount: String
}
