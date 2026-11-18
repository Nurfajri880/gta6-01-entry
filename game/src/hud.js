// Heads-up display for Teluk Senja: wanted stars, speed, the context prompt,
// and a 2D minimap drawn on a canvas (sea, roads, buildings, the player, cars,
// police). The title and pause overlays live here too. Pure DOM and 2D canvas —
// no game rules, only what the player sees.
import { CITY_NAME } from './config.js';

const MAP_SIZE = 190;
const WORLD_EXTENT = 210;

export function createHud(city) {
  const starsEl = document.getElementById('stars');
  const speedEl = document.getElementById('speed');
  const promptEl = document.getElementById('prompt');
  const titleEl = document.getElementById('title');
  const pausedEl = document.getElementById('paused');
  const minimap = document.getElementById('minimap');
  const mapCtx = minimap.getContext('2d');
  minimap.width = MAP_SIZE;
  minimap.height = MAP_SIZE;

  function toMap(x, z) {
    const scale = MAP_SIZE / (WORLD_EXTENT * 2);
    return [(x + WORLD_EXTENT) * scale, (z + WORLD_EXTENT) * scale];
  }

  function setWanted(level) {
    if (level <= 0) {
      starsEl.textContent = '';
      starsEl.style.display = 'none';
      return;
    }
    starsEl.style.display = 'block';
    starsEl.textContent = '★'.repeat(level) + '☆'.repeat(5 - level);
  }

  function setSpeed(kmh, driving) {
    if (!driving) {
      speedEl.style.display = 'none';
      return;
    }
    speedEl.style.display = 'block';
    speedEl.textContent = `${Math.round(kmh)} km/h`;
  }

  function setPrompt(text) {
    if (!text) {
      promptEl.style.display = 'none';
      promptEl.textContent = '';
      return;
    }
    promptEl.style.display = 'block';
    promptEl.textContent = text;
  }

  function showTitle() {
    titleEl.style.display = 'flex';
    titleEl.querySelector('h1').textContent = CITY_NAME;
  }
  function hideTitle() {
    titleEl.style.display = 'none';
  }
  function showPaused() {
    pausedEl.style.display = 'flex';
  }
  function hidePaused() {
    pausedEl.style.display = 'none';
  }

  function drawMinimap(state) {
    const ctx = mapCtx;
    ctx.fillStyle = '#10141c';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Sea on the west edge.
    const [seaX] = toMap(-195, 0);
    ctx.fillStyle = '#14324a';
    ctx.fillRect(0, 0, Math.max(0, seaX), MAP_SIZE);
    // Roads.
    ctx.strokeStyle = '#5a5f6a';
    ctx.lineWidth = 2;
    for (const line of city.lines) {
      const [x0, y0] = toMap(line, -210);
      const [, y1] = toMap(line, 210);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0, y1);
      ctx.stroke();
      const [hx0, hy0] = toMap(-210, line);
      const [hx1] = toMap(210, line);
      ctx.beginPath();
      ctx.moveTo(hx0, hy0);
      ctx.lineTo(hx1, hy0);
      ctx.stroke();
    }
    // Buildings as dark blocks.
    ctx.fillStyle = '#2a2f3a';
    for (const b of city.buildings) {
      const [bx, by] = toMap(b.x - b.width / 2, b.z - b.depth / 2);
      const scale = MAP_SIZE / (WORLD_EXTENT * 2);
      ctx.fillRect(bx, by, Math.max(1, b.width * scale), Math.max(1, b.depth * scale));
    }
    function dot(x, z, color, size) {
      const [px, py] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.trafficCars) dot(car.x, car.z, '#f2c94c', 2);
    for (const car of state.parkedCars) dot(car.x, car.z, '#8a93a3', 2);
    for (const car of state.policeCars) dot(car.x, car.z, '#ff4444', 2.5);
    for (const ped of state.pedestrians) dot(ped.x, ped.z, '#c9c9c9', 1.2);
    // The player: a white triangle pointing where it faces. Map north is -world z,
    // so a heading of 0 (facing +z, south) points straight down on the map.
    const [px, py] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - state.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    setWanted,
    setSpeed,
    setPrompt,
    showTitle,
    hideTitle,
    showPaused,
    hidePaused,
    drawMinimap,
  };
}
