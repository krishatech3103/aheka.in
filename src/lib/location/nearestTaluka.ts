export interface TalukaLocationCandidate {
  center_latitude?: number | null;
  center_longitude?: number | null;
  location_detection_radius_km?: number | null;
}

export interface NearestTalukaResult<T extends TalukaLocationCandidate> {
  taluka: T;
  distanceKm: number;
}

const EARTH_RADIUS_KM = 6371;
const DEFAULT_DETECTION_RADIUS_KM = 25;
const MINIMUM_DISTANCE_MARGIN_KM = 8;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function isValidCoordinatePair(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function hasValidTalukaCentre(candidate: TalukaLocationCandidate): boolean {
  if (candidate.center_latitude === null || candidate.center_latitude === undefined
    || candidate.center_longitude === null || candidate.center_longitude === undefined) {
    return false;
  }
  return isValidCoordinatePair(Number(candidate.center_latitude), Number(candidate.center_longitude));
}

export function distanceBetweenCoordinatesKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(fromLatitude))
      * Math.cos(toRadians(toLatitude))
      * Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Finds a taluka only when a browser position is clearly within its configured
 * confidence radius and materially closer than any other supported taluka.
 * Ambiguous or out-of-coverage results intentionally fall back to manual choice.
 */
export function findNearestSupportedTaluka<T extends TalukaLocationCandidate>(
  latitude: number,
  longitude: number,
  candidates: T[],
  accuracyMetres = 0,
): NearestTalukaResult<T> | null {
  if (!isValidCoordinatePair(latitude, longitude) || !Number.isFinite(accuracyMetres) || accuracyMetres < 0) {
    return null;
  }

  const nearby = candidates
    .filter(hasValidTalukaCentre)
    .map((taluka) => ({
      taluka,
      distanceKm: distanceBetweenCoordinatesKm(
        latitude,
        longitude,
        Number(taluka.center_latitude),
        Number(taluka.center_longitude),
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearest = nearby[0];
  if (!nearest) return null;

  const confidenceRadiusKm = Number(nearest.taluka.location_detection_radius_km)
    || DEFAULT_DETECTION_RADIUS_KM;
  const uncertaintyKm = accuracyMetres / 1000;
  if (nearest.distanceKm + uncertaintyKm > confidenceRadiusKm) return null;

  const runnerUp = nearby[1];
  if (runnerUp && runnerUp.distanceKm - nearest.distanceKm < MINIMUM_DISTANCE_MARGIN_KM) {
    return null;
  }

  return nearest;
}
