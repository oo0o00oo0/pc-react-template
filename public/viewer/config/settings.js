const viewerSettings = {
  camera: {
    fov: 65,
    position: [50.5, 50.5, 50.5],
    target: [0, 0, 0],
    startAnim: "none",
    animTrack: null,
  },
  background: {
    color: [0.7, 0.73, 0.78],
  },
  animTracks: [],
};

const nearlyEquals = (a, b, epsilon = 1e-4) => {
  return !a.some((v, i) => Math.abs(v - b[i]) >= epsilon);
};

export { nearlyEquals, viewerSettings };
