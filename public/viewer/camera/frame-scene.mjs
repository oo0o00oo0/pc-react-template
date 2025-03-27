import { Mat4, Script, Vec3 } from "playcanvas";
import { nearlyEquals, viewerSettings } from "../config/settings.js";

//https://stackblitz.com/edit/pc-react-gaussian-splats-hpsx2yzo?file=src%2FApp.tsx,src%2Fcomponents%2FSplatViewer.tsx,src%2Fcomponents%2FCustomGSplat.tsx

class FrameScene extends Script {
  constructor(args) {
    super(args);

    const { camera } = viewerSettings;
    const { position, target } = camera;

    this.position = position && new Vec3(position);
    this.target = target && new Vec3(target);
  }

  frameScene(centerPoint, groupSize, zFactor, camPositionEXLP, camTargetEXLP) {
    console.log(
      "frameScene",
      centerPoint,
      groupSize,
      zFactor,
      camPositionEXLP,
      camTargetEXLP
    );
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
            distance + 0
          )
        );
    }

    // Call the focus function to smoothly move the camera
    this.entity.script.cameraControls.focus(target, cameraPosition, true);
  }

  specificPosition(position, target, smooth = true) {
    this.entity.script.cameraControls.focus(target, position, smooth);
  }

  initCamera() {
    const { app } = this;
    const { graphicsDevice } = app;

    // get the gsplat component
    const gsplatComponent = app.root.findComponent("gsplat");

    console.log(gsplatComponent.entity.gsplat.resource);

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
      // console.log("update", deltaTime);
      // handle camera animation
    });

    const prevProj = new Mat4();
    const prevWorld = new Mat4();

    app.on("framerender", () => {
      console.log("FRAME RENDER");
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

        // window.parent.postMessage({ type: "firstFrame" }, "*");
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
    const assets = this.app.assets.filter((asset) => asset.type === "gsplat");
    if (assets.length > 0) {
      const asset = assets[0];

      if (asset.loaded) {
        this.initCamera();
      } else {
        asset.on("load", () => {
          this.setupCustomShader(asset);
          this.initCamera();
        });
      }
    }
  }

  setupCustomShader(gsplatAsset) {
    // Access the original material
    const material = gsplatAsset.resource.splat;

    console.log(material);
    // Create a new shader using your custom fragment shader and the original vertex shader
    // const customShader = this.app.graphicsDevice.createShader({
    //   vshader: material.shader.vshader, // use the existing vertex shader
    //   fshader: customFragmentShader, // override fragment shader
    // });

    // // Replace the material's shader
    // material.shader = customShader;
  }
}

export default FrameScene;
