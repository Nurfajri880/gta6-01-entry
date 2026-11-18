// Deterministic randomness for Teluk Senja: the same seed builds the same city,
// the same traffic and the same pedestrians, so a screenshot staged with ?shot=
// and &seed= always shows the same frame. A tiny xorshift generator with helpers
// for the shapes of randomness the game actually needs.
export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  }
  return {
    next,
    // Uniform float in [low, high).
    range(low, high) {
      return low + (high - low) * next();
    },
    // Uniform integer in [low, high] inclusive.
    int(low, high) {
      return low + Math.floor(next() * (high - low + 1));
    },
    // One element of an array, uniformly.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // True with the given probability.
    chance(p) {
      return next() < p;
    },
  };
}
