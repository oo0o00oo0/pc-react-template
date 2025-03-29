import {
  BLEND_NORMAL,
  Color,
  Material,
  SEMANTIC_POSITION,
  SEMANTIC_TEXCOORD0,
  ShaderMaterial,
  Vec3,
} from "playcanvas";

import * as pc from "playcanvas";
import vert from "./glsl/vertex.mjs";

import { viewerSettings } from "./config/settings.js";

import * as handlers from "./state/messageHandlers.js";

import FrameScene from "./camera/frame-scene.mjs";
import OverlayModel from "./entities/Overlay.mjs";
//https://playcanvas.vercel.app/#/graphics/shader-burn
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

    // if (this.developmentsData) {
    //   await this.initializeModels(camera, outliner);
    // }
  }

  monitorSplatAssetLoading() {
    const splatAssets = this.app.assets.filter((a) => a.type === "gsplat");

    if (!splatAssets.length) return;

    const splatAsset = splatAssets[0];

    splatAsset.on("progress", (received, length) => {
      const percent = (Math.min(1, received / length) * 100).toFixed(0);
      window.parent.postMessage({ type: "loading", received, v: percent }, "*");
    });

    splatAsset.on("load", () => {
      this.setupCustomShader(splatAsset);
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

    const blendModels = await Promise.all(
      [...document.querySelectorAll("[blend]")].map((el) => el.ready()),
    );

    const solidModels = await Promise.all(
      [...document.querySelectorAll("[solid]")].map((el) => el.ready()),
    );

    const custom_material = new ShaderMaterial({
      uniqueName: "GreenMaterial",
      vertexCode: /* glsl */ `
          attribute vec3 vertex_position;
          uniform mat4 matrix_model;
          uniform mat4 matrix_viewProjection;
          attribute vec2 aUv0;
          varying vec2 vUv0;
          varying vec3 vPosition;
          
          void main() {
              vUv0 = aUv0;
              vPosition = vertex_position;
              gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
          }
        `,
      fragmentCode: /* glsl */ `
          precision mediump float;
          varying vec2 vUv0;
          varying vec3 vPosition;
          void main() {
            vec3 color = vec3(0.91, 0.33, 0.09);
              gl_FragColor = vec4(color, 1.0); // Alpha is set to 0.3
          }
        `,
      attributes: {
        vertex_position: SEMANTIC_POSITION,
        aUv0: SEMANTIC_TEXCOORD0,
      },
    });

    // blendModels.forEach((modelElement) => {
    //   const entity = modelElement.entity;

    //   const immediateLayer = app.scene.layers.getLayerByName("Immediate");

    //   const renderComponents = entity.findComponents("render");

    //   renderComponents.forEach((renderComp) => {
    //     renderComp.layers = [3];

    //     renderComp.meshInstances.forEach((meshInstance) => {
    //       meshInstance.material = custom_material;
    //       const material = meshInstance.material;
    //       material.blendType = 7;
    //       material.depthWrite = true;
    //       material.depthTest = true;
    //       material.emissive = new Color(0.91, 0.33, 0.09);
    //       material.update();
    //     });
    //   });
    // });

    const occlusionModels = await Promise.all(
      [...document.querySelectorAll("[occlusion]")].map((el) => el.ready()),
    );

    const lights = await Promise.all(
      [...document.querySelectorAll("[light]")].map((el) => el.ready()),
    );

    lights.forEach((lightElement) => {
      const immediateLayer = app.scene.layers.getLayerByName("Immediate");
      const entity = lightElement.entity;
      console.log("light", entity);
      entity.layers = [immediateLayer.id];
    });

    solidModels.forEach((modelElement) => {
      const model = new OverlayModel(this.app, camera, modelElement);
      this.models.set(model.name, model);
    });

    occlusionModels.forEach((modelElement) => {
      const immediateLayer = app.scene.layers.getLayerByName("Immediate");
      const entity = modelElement.entity;
      const renderComponents = entity.findComponents("render");
      renderComponents.forEach((renderComp) => {
        renderComp.layers = [immediateLayer.id];
        renderComp.meshInstances.forEach((meshInstance) => {
          const material = meshInstance.material;

          material.redWrite = false;
          material.greenWrite = false;
          material.blueWrite = false;

          meshInstance.material = material;
        });
      });
    });

    window.parent.postMessage({ type: "scene-ready" }, "*");
  }

  setupCustomShader(gsplatAsset) {
    const scene_splat_entity = document.querySelector(
      "pc-entity[name='splat']",
    );

    scene_splat_entity.entity.destroy();
    const test_splat = gsplatAsset.resource.instantiate({
      vertex: vert,
    });

    const material = test_splat.gsplat.material;

    material.setParameter("uSwirlAmount", .1);

    console.log("material", material);

    test_splat.name = "test_splat";
    test_splat.setLocalPosition(0, 0, 0);
    test_splat.setLocalScale(1, 1, 1);
    app.root.addChild(test_splat);
  }

  async handleMessage(event) {
    if (!this.app) return;
    const { type, data } = event.data;

    if (type === "initialize") {
      const { camera: cameraData } = data;
      this.developmentsData = data.developmentData;
      const { camera } = this.pendingInitialization || {};

      if (camera) {
        await this.initializeModels(camera);

        const frameSceneScript = camera.script.frameScene;
        frameSceneScript.frameScene(
          new Vec3(0, 0, 0),
          20,
          0,
          cameraData.position,
          cameraData.target,
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
