import { ApiError } from '../telemetry/schema.js';

export const MAX_BODY = 8192;
export const MAX_RESPONSE = 1024 * 1024;
export const ENGINE_VERSION = '3.6.3';
const MAX_DISTANCE = 3_000_000;
const MAX_POINTS = 30_000;
const MAX_MANEUVERS = 512;

export function routeError(status, code, message) {
  const error = new ApiError(status, message);
  error.routingCode = code;
  return error;
}

const invalidResponse = () => routeError(502, 'ROUTING_RESPONSE_INVALID', 'Invalid routing response');
const record = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every(key => keys.includes(key));

function coordinate(point) {
  if (!record(point, ['latitude', 'longitude']) ||
      !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 ||
      !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180 ||
      Math.round(point.latitude * 1e6) / 1e6 !== point.latitude ||
      Math.round(point.longitude * 1e6) / 1e6 !== point.longitude)
    throw routeError(400, 'INVALID_COORDINATES', 'Use numeric coordinates with up to six decimal places');
  return point;
}

function distance(a, b) {
  const rad = Math.PI / 180;
  const h = Math.sin((a.latitude - b.latitude) * rad / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) *
    Math.sin((a.longitude - b.longitude) * rad / 2) ** 2;
  return 12_742_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const limits = { height_m: [1, 5], width_m: [1, 3], length_m: [2, 25], weight_t: [2, 60], axle_load_t: [1, 15] };

export function parseCalculation(input) {
  if (!record(input, ['origin', 'destination', 'waypoints', 'profile', 'truck']))
    throw routeError(400, 'INVALID_REQUEST', 'Unexpected calculation fields');
  if (!['auto', 'truck'].includes(input.profile))
    throw routeError(400, 'UNSUPPORTED_PROFILE', 'Supported profiles are auto and truck');
  const waypoints = input.waypoints === undefined ? [] : input.waypoints;
  if (!Array.isArray(waypoints) || waypoints.length > 8)
    throw routeError(400, 'INVALID_WAYPOINTS', 'At most eight ordered waypoints are allowed');
  const points = [input.origin, ...waypoints, input.destination].map(coordinate);
  let lowerBound = 0;
  for (let i = 1; i < points.length; i++) {
    if (points.slice(0, i).some(other => distance(other, points[i]) < 10))
      throw routeError(400, 'INVALID_WAYPOINTS', 'Stops must be at least ten meters apart');
    lowerBound += distance(points[i - 1], points[i]);
  }
  if (lowerBound > MAX_DISTANCE)
    throw routeError(400, 'INVALID_WAYPOINTS', 'Combined straight-line leg distance exceeds 3000 km');
  const truck = input.truck;
  if (input.profile === 'auto' ? truck !== undefined :
    !record(truck, Object.keys(limits)) ||
    Object.entries(limits).some(([key, [low, high]]) =>
      !Number.isFinite(truck[key]) || truck[key] < low || truck[key] > high ||
      Math.round(truck[key] * 1000) / 1000 !== truck[key]) || truck.axle_load_t > truck.weight_t)
    throw routeError(400, 'INVALID_VEHICLE_DIMENSIONS', 'Provide valid truck dimensions in meters and metric tonnes');
  return { points, profile: input.profile, truck };
}

export function providerRequest(calculation) {
  const { points, profile, truck } = calculation;
  return {
    locations: points.map(({ latitude, longitude }) => ({lat: latitude, lon: longitude, type: 'break'})),
    costing: profile, units: 'kilometers', shape_format: 'polyline6',
    ...(truck && {costing_options: {truck: {
      height: truck.height_m, width: truck.width_m, length: truck.length_m,
      weight: truck.weight_t, axle_load: truck.axle_load_t
    }}})
  };
}

export function decodeShape(shape, limit = MAX_POINTS) {
  if (typeof shape !== 'string' || !shape.length || shape.length > 300_000) throw invalidResponse();
  let index = 0, lat = 0, lon = 0;
  function delta() {
    let decoded = 0;
    for (let shift = 0; shift <= 30; shift += 5) {
      const part = shape.charCodeAt(index++) - 63;
      if (!(part >= 0 && part <= 63)) throw invalidResponse();
      decoded += (part & 31) * 2 ** shift;
      if (part < 32) return (decoded % 2 ? -1 : 1) * Math.ceil(decoded / 2);
    }
    throw invalidResponse();
  }
  const points = [];
  while (index < shape.length) {
    lat += delta();
    lon += delta();
    if (Math.abs(lat) > 90e6 || Math.abs(lon) > 180e6 || points.length >= limit)
      throw invalidResponse();
    points.push({latitude: lat / 1e6, longitude: lon / 1e6});
  }
  if (points.length < 2) throw invalidResponse();
  return points;
}

function meters(summary) {
  if (!Number.isFinite(summary?.length) || summary.length < 0 || summary.length > MAX_DISTANCE / 1000)
    throw invalidResponse();
  return Math.round(summary.length * 1000);
}
function seconds(summary) {
  if (!Number.isFinite(summary?.time) || summary.time < 0 || summary.time > 604800)
    throw invalidResponse();
  return Math.round(summary.time);
}

export function normalizeRoute(payload, calculation, graph, calculatedAt) {
  const trip = payload?.trip;
  if (trip?.status !== 0 || trip.units !== 'kilometers' || !Array.isArray(trip.legs) ||
      trip.legs.length !== calculation.points.length - 1)
    throw invalidResponse();
  let pointCount = 0, maneuverCount = 0;
  const legs = trip.legs.map((leg, index) => {
    const points = decodeShape(leg?.shape, MAX_POINTS - pointCount);
    pointCount += points.length;
    if (distance(calculation.points[index], points[0]) > 1000 ||
        distance(calculation.points[index + 1], points.at(-1)) > 1000 ||
        !Array.isArray(leg.maneuvers) || !leg.maneuvers.length ||
        (maneuverCount += leg.maneuvers.length) > MAX_MANEUVERS)
      throw invalidResponse();
    const maneuvers = leg.maneuvers.map(step => {
      if (step?.travel_mode !== 'drive' || step.travel_type !== (calculation.profile === 'truck' ? 'truck' : 'car') ||
          !Number.isInteger(step.type) || step.type < 0 || step.type > 255 ||
          typeof step.instruction !== 'string' || !step.instruction.length || step.instruction.length > 500 ||
          !step.instruction.isWellFormed() || /[\u0000-\u001f\u007f]/.test(step.instruction) ||
          !Number.isInteger(step.begin_shape_index) || !Number.isInteger(step.end_shape_index) ||
          step.begin_shape_index < 0 || step.end_shape_index < step.begin_shape_index ||
          step.end_shape_index >= points.length)
        throw invalidResponse();
      return {type: step.type, instruction: step.instruction,
        distance_m: meters(step), estimated_duration_s: seconds(step),
        begin_shape_index: step.begin_shape_index, end_shape_index: step.end_shape_index};
    });
    return {shape: leg.shape, distance_m: meters(leg.summary),
      estimated_duration_s: seconds(leg.summary), maneuvers};
  });
  const distance_m = meters(trip.summary), estimated_duration_s = seconds(trip.summary);
  if (!distance_m || !estimated_duration_s ||
      Math.abs(distance_m - legs.reduce((sum, leg) => sum + leg.distance_m, 0)) > legs.length + 1 ||
      Math.abs(estimated_duration_s - legs.reduce((sum, leg) => sum + leg.estimated_duration_s, 0)) > legs.length + 1)
    throw invalidResponse();
  return {
    profile: calculation.profile, ...(calculation.truck && {truck: calculation.truck}),
    graph, calculated_at: calculatedAt,
    route: {geometry_format: 'polyline6', distance_m, estimated_duration_s, legs},
    alternatives: {status: 'unsupported', routes: []},
    warnings: ['STATIC_OSM_SNAPSHOT', 'COVERAGE_MAY_BE_INCOMPLETE',
      ...(calculation.truck ? ['HGV_RESTRICTIONS_MAY_BE_INCOMPLETE'] : [])]
  };
}
