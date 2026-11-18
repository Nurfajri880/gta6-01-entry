// Wanted level and police in Teluk Senja. Stealing a car raises the wanted
// level; police cars spawn at nearby intersections and chase the player, ramming
// to slow the getaway. Stay clean and out of sight and the heat cools off on
// its own. Arrest and combat belong to H+3 — here the police only chase and ram.
import { createCar, stepCar } from './car.js';
import {
  MAX_POLICE,
  MAX_WANTED,
  POLICE_CATCH_DISTANCE,
  POLICE_SPEED,
  POLICE_SPAWN_DISTANCE,
  STEAL_STARS,
  WANTED_DECAY_SECONDS,
} from './config.js';

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function createPolice(scene, city, random) {
  const cars = [];
  let wanted = 0;
  let quietSeconds = 0;

  function addWanted(stars) {
    wanted = Math.min(MAX_WANTED, wanted + stars);
    quietSeconds = 0;
  }

  function crimeCommitted(stars) {
    addWanted(stars);
  }

  function spawnNear(px, pz) {
    // A road node roughly a block or two away from the player.
    let best = null;
    let bestScore = Infinity;
    for (let tries = 0; tries < 12; tries += 1) {
      const node = city.nodes[random.int(0, city.nodes.length - 1)];
      const dist = Math.hypot(node.x - px, node.z - pz);
      const score = Math.abs(dist - POLICE_SPAWN_DISTANCE);
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    }
    if (!best) return;
    const heading = Math.atan2(px - best.x, pz - best.z);
    const car = createCar(scene, best.x, best.z, heading, 0xe8e8e8, true);
    car.cruise = POLICE_SPEED;
    cars.push(car);
  }

  function step(dt, player, collide) {
    // Spawn up to one police car per wanted star.
    const want = Math.min(wanted, MAX_POLICE);
    while (cars.length < want) spawnNear(player.x, player.z);

    const playerNode = city.nearestNode(player.x, player.z);
    let nearest = Infinity;
    for (const car of cars) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < nearest) nearest = dist;
      // Close in: steer straight at the player. Far away: navigate the road
      // graph toward the player's intersection, one greedy hop at a time.
      let targetHeading;
      if (dist < 25) {
        targetHeading = Math.atan2(dx, dz);
      } else {
        const here = city.nearestNode(car.x, car.z);
        const node = city.nodes[here];
        const target = city.nodes[playerNode];
        let bestNext = node.neighbours[0];
        let bestScore = Infinity;
        for (const next of node.neighbours) {
          const n = city.nodes[next];
          const score = Math.abs(n.x - target.x) + Math.abs(n.z - target.z);
          if (score < bestScore) {
            bestScore = score;
            bestNext = next;
          }
        }
        const hop = city.nodes[bestNext];
        targetHeading = Math.atan2(hop.x - car.x, hop.z - car.z);
      }
      const diff = wrapAngle(targetHeading - car.heading);
      const throttle = dist > POLICE_CATCH_DISTANCE ? 0.9 : 0.25;
      stepCar(car, dt, { throttle, steer: Math.max(-1, Math.min(1, diff * 1.8)), brake: false }, collide);
      // Ramming: touching the player's car shoves it away from the police car
      // and bleeds its speed.
      if (dist < POLICE_CATCH_DISTANCE + 1.2 && player.car) {
        const push = 3.5 * dt;
        player.car.x += (dx / Math.max(0.1, dist)) * push;
        player.car.z += (dz / Math.max(0.1, dist)) * push;
        player.car.speed *= 1 - 0.9 * dt;
      }
    }

    // Cool off: no crime for a while and no police close by, one star fades.
    if (wanted > 0) {
      if (nearest > 60) {
        quietSeconds += dt;
        if (quietSeconds >= WANTED_DECAY_SECONDS) {
          wanted -= 1;
          quietSeconds = 0;
        }
      } else {
        quietSeconds = 0;
      }
    } else {
      quietSeconds = 0;
    }

    // No heat, no police: despawn cars that drifted far away.
    if (wanted === 0) {
      for (let index = cars.length - 1; index >= 0; index -= 1) {
        const car = cars[index];
        const dist = Math.hypot(car.x - player.x, car.z - player.z);
        if (dist > 160) {
          car.group.removeFromParent();
          cars.splice(index, 1);
        }
      }
    }
  }

  return {
    cars,
    get wanted() {
      return wanted;
    },
    crimeCommitted,
    stealStars: STEAL_STARS,
    step,
  };
}
