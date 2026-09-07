import { ImageSourcePropType } from "react-native";

import { Services } from "@/stores/account/types";

export function getServiceName(service: Services): string {
  switch (service) {
    case Services.IZLY:
      return "Izly";
    default:
      return "Unknown";
  }
}

export function getServiceLogo(service: Services): ImageSourcePropType {
  switch (service) {
    case Services.IZLY:
      return require("@/assets/images/izly.png");
    default:
      return require("@/assets/images/izly.png");
  }
}

export function getServiceBackground(service: Services): ImageSourcePropType {
  switch (service) {
    case Services.IZLY:
      return require("@/assets/images/izly_background_card.png");
    default:
      return require("@/assets/images/izly_background_card.png");
  }
}

export function getServiceColor(service: Services): string {
  switch (service) {
    default:
      return "#E70026";
  }
}

export function getCodeType(service: Services): string {
  switch (service) {
    default:
      return "QR";
  }
}
