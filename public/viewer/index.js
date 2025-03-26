import { BoundingBox, Color, Mat4, Script, Vec3 } from "playcanvas";

import { CubicSpline } from "spline";

import { viewerSettings } from "./config/settings.js";

import FrameScene from "./camera/frame-scene.mjs";

const url = new URL(location.href);

// class FrameScene extends Script {
//   initialize() {
//     const { settings } = this;
//     const { camera, animTracks } = settings;
//     const { position, target } = camera;

//     this.position = position && new Vec3(position);
//     this.target = target && new Vec3(target);

//     // construct camera animation track
//     if (animTracks?.length > 0 && settings.camera.startAnim === "animTrack") {
//       const track = animTracks.find((track) => track.name === camera.animTrack);
//       if (track) {
//         const { keyframes, duration } = track;
//         const { times, values } = keyframes;
//         const { position, target } = values;

//         // construct the points array containing position and target
//         const points = [];
//         for (let i = 0; i < times.length; i++) {
//           points.push(
//             position[i * 3],
//             position[i * 3 + 1],
//             position[i * 3 + 2]
//           );
//           points.push(target[i * 3], target[i * 3 + 1], target[i * 3 + 2]);
//         }

//         this.cameraAnim = {
//           time: 0,
//           spline: CubicSpline.fromPointsLooping(duration, times, points),
//           track,
//           result: [],
//         };
//       }
//     }
//   }

//   initCamera() {
//     const { app } = this;
//     const { graphicsDevice } = app;
//     let animating = false;
//     let animationTimer = 0;

//     // get the gsplat component
//     const gsplatComponent = app.root.findComponent("gsplat");

//     // calculate the bounding box
//     const bbox =
//       gsplatComponent?.instance?.meshInstance?.aabb ?? new BoundingBox();

//     this.frameScene(bbox, false);

//     const cancelAnimation = () => {
//       if (animating) {
//         animating = false;

//         // copy current camera position and target
//         const r = this.cameraAnim.result;
//         this.entity.script.cameraControls.focus(
//           new Vec3(r[3], r[4], r[5]),
//           new Vec3(r[0], r[1], r[2]),
//           false
//         );
//       }
//     };

//     // listen for interaction events
//     const events = ["wheel", "pointerdown", "contextmenu"];
//     const handler = (e) => {
//       cancelAnimation();
//       events.forEach((event) =>
//         app.graphicsDevice.canvas.removeEventListener(event, handler)
//       );
//     };
//     events.forEach((event) =>
//       app.graphicsDevice.canvas.addEventListener(event, handler)
//     );

//     app.on("update", (deltaTime) => {
//       // handle camera animation
//       if (this.cameraAnim && animating && !params.noanim) {
//         const { cameraAnim } = this;
//         const { spline, track, result } = cameraAnim;

//         // update animation timer
//         animationTimer += deltaTime;

//         // update the track cursor
//         if (animationTimer < 5) {
//           // ease in
//           cameraAnim.time += deltaTime * Math.pow(animationTimer / 5, 0.5);
//         } else {
//           cameraAnim.time += deltaTime;
//         }

//         if (cameraAnim.time >= track.duration) {
//           switch (track.loopMode) {
//             case "none":
//               cameraAnim.time = track.duration;
//               break;
//             case "repeat":
//               cameraAnim.time = cameraAnim.time % track.duration;
//               break;
//             case "pingpong":
//               cameraAnim.time = cameraAnim.time % (track.duration * 2);
//               break;
//           }
//         }

//         // evaluate the spline
//         spline.evaluate(
//           cameraAnim.time > track.duration
//             ? track.duration - cameraAnim.time
//             : cameraAnim.time,
//           result
//         );

//         // set camera
//         this.entity.setPosition(result[0], result[1], result[2]);
//         this.entity.lookAt(result[3], result[4], result[5]);
//       }
//     });

//     const prevProj = new Mat4();
//     const prevWorld = new Mat4();

//     app.on("framerender", () => {
//       if (!app.autoRender && !app.renderNextFrame) {
//         const world = this.entity.getWorldTransform();
//         if (!nearlyEquals(world.data, prevWorld.data)) {
//           app.renderNextFrame = true;
//         }

//         const proj = this.entity.camera.projectionMatrix;
//         if (!nearlyEquals(proj.data, prevProj.data)) {
//           app.renderNextFrame = true;
//         }

//         if (app.renderNextFrame) {
//           prevWorld.copy(world);
//           prevProj.copy(proj);
//         }
//       }
//     });

//     // wait for first gsplat sort
//     const handle = gsplatComponent?.instance?.sorter?.on("updated", () => {
//       handle.off();

//       // request frame render
//       app.renderNextFrame = true;

//       // wait for first render to complete
//       const frameHandle = app.on("frameend", () => {
//         console.log("frameend");
//         frameHandle.off();

//         // start animating once the first frame is rendered
//         if (this.cameraAnim) {
//           animating = true;
//         }

//         // emit first frame event on window
//         window.firstFrame?.();
//       });
//     });

//     const updateHorizontalFov = (width, height) => {
//       this.entity.camera.horizontalFov = width > height;
//     };

//     // handle fov on canvas resize
//     graphicsDevice.on("resizecanvas", (width, height) => {
//       updateHorizontalFov(width, height);
//       app.renderNextFrame = true;
//     });

//     // configure on-demand rendering
//     app.autoRender = false;
//     updateHorizontalFov(graphicsDevice.width, graphicsDevice.height);
//   }

//   postInitialize() {
//     const assets = this.app.assets.filter((asset) => asset.type === "gsplat");
//     if (assets.length > 0) {
//       const asset = assets[0];
//       if (asset.loaded) {
//         this.initCamera();
//       } else {
//         asset.on("load", () => {
//           this.initCamera();
//         });
//       }
//     }
//   }
// }

// document.addEventListener("DOMContentLoaded", async () => {
//   const appElement = await document.querySelector("pc-app").ready();
//   const cameraElement = await document
//     .querySelector('pc-entity[name="camera"]')
//     .ready();

//   const app = await appElement.app;
//   const camera = cameraElement.entity;
//   const settings = await window.settings;

//   camera.camera.clearColor = new Color(settings.background.color);
//   camera.camera.fov = settings.camera.fov;
//   camera.script.create(FrameScene, {
//     properties: { settings },
//   });

//   // Update loading indicator
//   this.monitorSplatAssetLoading();
// });

class ViewerApp {
  constructor() {
    this.app = null;
    this.models = new Map();
    this.mapModels = new Map();
    this.hotelsLabels = new Map();
    this.connectionsLabels = new Map();
    this.spacesLabels = new Map();
    this.developmentsData = null;
    this.pendingInitialization = null;

    this.initialize();
  }

  async initialize() {
    await this.handleDOMContentLoaded();
  }

  async handleDOMContentLoaded() {
    document.body.style["-webkit-user-select"] = "none";
    const appElement = await document.querySelector("pc-app").ready();
    const cameraElement = await document
      .querySelector('pc-entity[name="camera"]')
      .ready();

    this.app = await appElement.app;
    window.app = this.app;

    window.addEventListener("message", this.handleMessage.bind(this));

    this.monitorSplatAssetLoading();

    // Camera setup
    const camera = cameraElement.entity;
    camera.camera.clearColor = new Color(viewerSettings.background.color);
    camera.camera.fov = viewerSettings.camera.fov;
    camera.script.create(FrameScene);
    // camera.script.cameraControls.pitchRange.set(-90, -20);
    // camera.script.cameraControls.enableZoom = false;
    // camera.script.cameraControls.on("clamp:angles", (angles) => {
    //   angles.y = Math.max(-60, Math.min(70, angles.y));
    // });
    // camera.script.cameraControls.zoomMin = 1;
    // camera.script.cameraControls.zoomMax = 10;
    camera.camera.frustumCulling = false;
    // const outliner = new Outliner(this.app, camera);

    this.pendingInitialization = { camera };

    if (this.developmentsData) {
      await this.initializeModels(camera, outliner);
    }
  }

  monitorSplatAssetLoading() {
    const splatAssets = this.app.assets.filter((a) => a.type === "gsplat");
    if (!splatAssets.length) return;

    const splatAsset = splatAssets[0];
    splatAsset.on("progress", (received, length) => {
      const percent = (Math.min(1, received / length) * 100).toFixed(0);
      window.parent.postMessage({ type: "loading", received, v: percent }, "*");
    });
  }

  /**
   * Called once the viewer has all devData it needs the async development models.
   */
  async initializeModels(camera) {
    if (!this.developmentsData) {
      console.warn("No developments data found");
      return;
    }

    window.parent.postMessage({ type: "scene-ready" }, "*");
  }

  async handleMessage(event) {
    if (!this.app) return;
    const { type, data } = event.data;

    if (type === "initialize") {
      console.log("initialize", data);
      this.developmentsData = data.developmentData;
      const { camera } = this.pendingInitialization || {};
      if (camera) {
        console.log(
          "initializeModels, developmentsData",
          this.developmentsData
        );
        await this.initializeModels(camera);

        const frameSceneScript = camera.script.frameScene;
        frameSceneScript.frameScene(
          new Vec3(0, 0, 0),
          20,
          0,
          [-13, 10, -13],
          [0, 2, 5]
        );
      }
      return;
    }

    const handler = handlers[type];
    if (handler) {
      handler(this, event);
    }
  }
}

new ViewerApp();
