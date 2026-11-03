export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationObject {
  coords: LocationCoordinates;
}

export interface LocationSubscription {
  remove(): void;
}

export interface LocationOptions {
  accuracy: "balanced";
  timeInterval?: number;
  distanceInterval?: number;
}

export interface CurrentPositionOptions {
  accuracy: "balanced";
}

export interface PermissionResponse {
  status: "granted" | "denied";
}
