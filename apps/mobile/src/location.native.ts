import Geolocation from "@react-native-community/geolocation";
import { PermissionsAndroid, Platform } from "react-native";
import type { CurrentPositionOptions, LocationObject, LocationOptions, LocationSubscription, PermissionResponse } from "./location.types";

export const Accuracy = { Balanced: "balanced" as const };

export async function requestForegroundPermissionsAsync(): Promise<PermissionResponse> {
  if (Platform.OS !== "android") return { status: "granted" };

  const permissions = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);
  const granted = Object.values(permissions).some((status) => status === PermissionsAndroid.RESULTS.GRANTED);
  return { status: granted ? "granted" : "denied" };
}

export function getCurrentPositionAsync(_options?: CurrentPositionOptions): Promise<LocationObject> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => resolve({ coords: position.coords }),
      (error) => reject(new Error(error.message)),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

export function watchPositionAsync(
  options: LocationOptions,
  onPosition: (position: LocationObject) => void,
  onError?: (error: Error) => void,
): Promise<LocationSubscription> {
  const watchId = Geolocation.watchPosition(
    (position) => onPosition({ coords: position.coords }),
    (error) => onError?.(new Error(error.message)),
    {
      enableHighAccuracy: options.accuracy === Accuracy.Balanced,
      interval: options.timeInterval,
      distanceFilter: options.distanceInterval,
    },
  );
  return Promise.resolve({ remove: () => Geolocation.clearWatch(watchId) });
}
