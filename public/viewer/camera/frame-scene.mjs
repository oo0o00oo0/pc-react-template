import { Mat4, Script, Vec3 } from "playcanvas";
import { nearlyEquals, viewerSettings } from "../config/settings.js";

// console.log(vert);

// console.log(pc.version);

//https://stackblitz.com/edit/pc-react-gaussian-splats-hpsx2yzo?file=src%2FApp.tsx,src%2Fcomponents%2FSplatViewer.tsx,src%2Fcomponents%2FCustomGSplat.tsx

class FrameScene extends Script {
  constructor(args) {
    super(args);

    const { camera } = viewerSettings;
    const { position, target } = camera;

    this.position = position && new Vec3(position);
    this.target = target && new Vec3(target);
    this.isAnimatingSwirl = false;
  }

  frameScene(centerPoint, groupSize, zFactor, camPositionEXLP, camTargetEXLP) {
    let target;

    if (camTargetEXLP) {
      target = new Vec3(camTargetEXLP);
    } else {
      target = centerPoint;
    }

    // Convert FOV from degrees to radians
    const fovRad = this.entity.camera.fov * (Math.PI / 180);
    const distanceFactor = 0.5;
    const distance = (groupSize / Math.tan(fovRad * 0.5)) * distanceFactor;

    let cameraPosition;

    if (camPositionEXLP) {
      cameraPosition = new Vec3(camPositionEXLP);
    } else {
      cameraPosition = centerPoint
        .clone()
        .add(
          new Vec3(
            distance - 0.5 * Math.random() - 0.5,
            distance + 0.3 + zFactor,
            distance + 0,
          ),
        );
    }

    // Call the focus function to smoothly move the camera
    this.entity.script.cameraControls.focus(target, cameraPosition, true);
  }

  specificPosition(position, target, smooth = true) {
    this.entity.script.cameraControls.focus(target, position, smooth);
  }

  animateSwirl(duration = 1000, targetSwirl) {
    if (this.isAnimatingSwirl) return;
    this.isAnimatingSwirl = true;
    const startTime = Date.now();

    // Retrieve the current swirl value from the material.
    const gsplat = this.app.root.findComponent("gsplat");
    let startSwirl = 0;
    if (gsplat && gsplat.material) {
      // If the parameter is not defined, default to 0.
      startSwirl = gsplat.material.getParameter("uSplatSize").data || 0;

      console.log("startSwirl", startSwirl);
    }

    const animate = () => {
      const currentTime = Date.now();
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const newSwirl = startSwirl * (1 - progress) + targetSwirl * progress;

      if (gsplat && gsplat.material) {
        console.log("newSwirl", newSwirl);
        gsplat.material.setParameter("uSplatSize", newSwirl);
        this.app.renderNextFrame = true;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimatingSwirl = false;
      }
    };

    animate();
  }

  initCamera() {
    const { app } = this;
    const { graphicsDevice } = app;

    // get the gsplat component
    const gsplatComponent = app.root.findComponent("gsplat");

    const events = ["wheel", "pointerdown", "contextmenu"];

    const handler = (e) => {
      events.forEach((event) =>
        app.graphicsDevice.canvas.removeEventListener(event, handler)
      );
    };

    events.forEach((event) =>
      app.graphicsDevice.canvas.addEventListener(event, handler)
    );

    app.on("update", (deltaTime) => {
    });

    const prevProj = new Mat4();
    const prevWorld = new Mat4();

    app.on("framerender", () => {
      if (!app.autoRender && !app.renderNextFrame) {
        const world = this.entity.getWorldTransform();
        const target = new Vec3();
        this.entity
          .getWorldTransform()
          .transformPoint(this.entity.forward, target);

        if (!nearlyEquals(world.data, prevWorld.data)) {
          app.renderNextFrame = true;
        }

        const proj = this.entity.camera.projectionMatrix;
        if (!nearlyEquals(proj.data, prevProj.data)) {
          app.renderNextFrame = true;
        }

        if (app.renderNextFrame) {
          prevWorld.copy(world);
          prevProj.copy(proj);
        }
      }
    });

    // wait for first gsplat sort
    const handle = gsplatComponent?.instance?.sorter?.on("updated", () => {
      handle.off();

      app.renderNextFrame = true;

      const frameHandle = app.on("frameend", () => {
        frameHandle.off();

        if (this.cameraAnim) {
          animating = true;
        }
      });
    });

    const updateHorizontalFov = (width, height) => {
      this.entity.camera.horizontalFov = width > height;
    };

    graphicsDevice.on("resizecanvas", (width, height) => {
      updateHorizontalFov(width, height);
      app.renderNextFrame = true;
    });

    // configure on-demand rendering
    app.autoRender = false;
    updateHorizontalFov(graphicsDevice.width, graphicsDevice.height);
  }

  postInitialize() {
    console.log("postInitialize");
    this.initCamera();
  }
}

// // helper function to create a splat instance
// const createSplatInstance = (
//   name,
//   asset,
//   px,
//   py,
//   pz,
//   scale,
//   vertex,
//   fragment,
// ) => {
//   const entity = new pc.Entity(name);
//   entity.addComponent("gsplat", {
//     asset: asset,
//   });
//   entity.setLocalPosition(px, py, pz);
//   entity.setLocalEulerAngles(180, 90, 0);
//   entity.setLocalScale(scale, scale, scale);
//   app.root.addChild(entity);

//   return entity;
// };

export default FrameScene;
