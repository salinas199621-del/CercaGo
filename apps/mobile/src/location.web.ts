import type { CurrentPositionOptions, LocationObject, LocationOptions, LocationSubscription, PermissionResponse } from "./location.types";

export const Accuracy = { Balanced: "balanced" as const };

function getGeolocation(): Geolocation {
  const geolocation = globalThis.navigator?.geolocation;
  if (!geolocation) throw new Error("Este navegador no permite acceder a la ubicación.");
  return geolocation;
}

export async function requestForegroundPermissionsAsync(): Promise<PermissionResponse> {
  try {
    getGeolocation();
    return { status: "granted" };
  } catch {
    return { status: "denied" };
  }
}

export function getCurrentPositionAsync(_options?: CurrentPositionOptions): Promise<LocationObject> {
  return new Promise((resolve, reject) => {
    getGeolocation().getCurrentPosition(
      (position) => resolve({ coords: position.coords }),
      (error) => reject(new Error(error.message)),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

export function watchPositionAsync(
  _options: LocationOptions,
  onPosition: (position: LocationObject) => void,
  onError?: (error: Error) => void,
): Promise<LocationSubscription> {
  const watchId = getGeolocation().watchPosition(
    (position) => onPosition({ coords: position.coords }),
    (error) => onError?.(new Error(error.message)),
    { enableHighAccuracy: true, maximumAge: 0 },
  );
  return Promise.resolve({ remove: () => getGeolocation().clearWatch(watchId) });
}
