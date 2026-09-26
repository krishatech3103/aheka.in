import { describe, expect, it } from 'vitest';
import {
  distanceBetweenCoordinatesKm,
  findNearestSupportedTaluka,
} from '../../src/lib/location/nearestTaluka';

const talukas = [
  { slug: 'sangamner', center_latitude: 19.56784, center_longitude: 74.21154, location_detection_radius_km: 25 },
  { slug: 'akole', center_latitude: 19.54063, center_longitude: 74.00543, location_detection_radius_km: 25 },
];

describe('nearest taluka detection', () => {
  it('calculates geographic distance using coordinates', () => {
    expect(distanceBetweenCoordinatesKm(19.56784, 74.21154, 19.56784, 74.21154)).toBe(0);
    expect(distanceBetweenCoordinatesKm(19.56784, 74.21154, 19.54063, 74.00543)).toBeGreaterThan(20);
  });

  it('selects the nearest configured taluka for an accurate nearby location', () => {
    const result = findNearestSupportedTaluka(19.568, 74.212, talukas, 30);
    expect(result?.taluka.slug).toBe('sangamner');
  });

  it('does not guess outside a taluka confidence radius', () => {
    expect(findNearestSupportedTaluka(18.5204, 73.8567, talukas, 30)).toBeNull();
  });

  it('does not guess when the nearest taluka is too close to another candidate', () => {
    expect(findNearestSupportedTaluka(19.554, 74.108, talukas, 30)).toBeNull();
  });

  it('accounts for poor GPS accuracy before selecting a taluka', () => {
    expect(findNearestSupportedTaluka(19.568, 74.212, talukas, 30_000)).toBeNull();
  });
});
