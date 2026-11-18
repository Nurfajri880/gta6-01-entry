// Traffic in Teluk Senja: AI cars that drive the road graph, plus parked cars
// waiting along the kerb to be stolen. A moving car always heads for a random
// neighbouring intersection; when it arrives it picks the next one. Cars slow
// down for the car ahead so the flow reads as traffic, not a demolition derby.
import { CAR_COLORS, createCar, stepCar } from './car.js';
import { GRID, HALF, ROAD_WIDTH, TRAFFIC_COUNT, TRAFFIC_MIN_GAP, TRAFFIC_SPEED } from './config.js';

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function createTraffic(scene, city, random) {
  const cars = [];
  const parked = [];

  for (let index = 0; index < TRAFFIC_COUNT; index += 1) {
    const node = city.nodes[random.int(0, city.nodes.length - 1)];
    const neighbour = node.neighbours[random.int(0, node.neighbours.length - 1)];
    const car = createCar(scene, node.x + random.range(-2, 2), node.z + random.range(-2, 2), random.range(0, Math.PI * 2), random.pick(CAR_COLORS));
    car.cruise = TRAFFIC_SPEED * random.range(0.8, 1.15);
    car.from = city.nodes.indexOf(node);
    car.target = neighbour;
    cars.push(car);
  }

  // Parked cars along the kerb, parallel to the road, ready to be stolen.
  const parkSpots = [];
  for (const x of city.lines) {
    for (let z = -HALF + 20; z <= HALF - 20; z += 40) {
      parkSpots.push({ x: x + ROAD_WIDTH / 2 + 2.4, z, heading: 0 });
      parkSpots.push({ x: x - ROAD_WIDTH / 2 - 2.4, z: z + 20, heading: Math.PI });
    }
  }
  // Guarantee one parked car near the spawn so the first mission is reachable.
  const spawn = (city.sidewalkPoints && city.sidewalkPoints[0]) || { x: 0, z: 0 };
  let nearest = parkSpots[0];
  let nearestDist = Infinity;
  for (const spot of parkSpots) {
    const d = Math.hypot(spot.x - spawn.x, spot.z - spawn.z);
    if (d < nearestDist) { nearestDist = d; nearest = spot; }
  }
  const nearCar = createCar(scene, nearest.x, nearest.z, nearest.heading, random.pick(CAR_COLORS));
  nearCar.parked = true;
  parked.push(nearCar);
  parkSpots.splice(parkSpots.indexOf(nearest), 1);
  for (let index = 0; index < 7; index += 1) {
    const spot = parkSpots[random.int(0, parkSpots.length - 1)];
    const car = createCar(scene, spot.x, spot.z, spot.heading, random.pick(CAR_COLORS));
    car.parked = true;
    parked.push(car);
  }

  function step(dt, collide) {
    for (const car of cars) {
      const target = city.nodes[car.target];
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        // Arrived: pick a next intersection, preferring not to turn straight back.
        const node = city.nodes[car.target];
        const options = node.neighbours.filter((n) => n !== car.from);
        car.from = car.target;
        car.target = options.length > 0 ? options[random.int(0, options.length - 1)] : node.neighbours[0];
        continue;
      }
      const targetHeading = Math.atan2(dx, dz);
      const diff = wrapAngle(targetHeading - car.heading);
      // Slow for the car ahead: if another car is close and roughly in front.
      let throttle = 0.55;
      for (const other of cars) {
        if (other === car) continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (ahead > 0 && ahead < TRAFFIC_MIN_GAP + 4 && side < 3) {
          throttle = 0;
          break;
        }
      }
      if (car.speed > car.cruise) throttle = 0;
      stepCar(car, dt, { throttle, steer: Math.max(-1, Math.min(1, diff * 1.5)), brake: false }, collide);
    }
  }

  return { cars, parked, step };
}
