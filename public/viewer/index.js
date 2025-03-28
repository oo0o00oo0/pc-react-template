import {
  BLEND_NORMAL,
  Color,
  Material,
  SEMANTIC_POSITION,
  SEMANTIC_TEXCOORD0,
  ShaderMaterial,
  Vec3,
} from "playcanvas";

import { viewerSettings } from "./config/settings.js";

import * as handlers from "./state/messageHandlers.js";

import FrameScene from "./camera/frame-scene.mjs";
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

    if (this.developmentsData) {
      await this.initializeModels(camera, outliner);
    }
  }

  monitorSplatAssetLoading() {
    const splatAssets = this.app.assets.filter((a) => a.type === "gsplat");
    if (!splatAssets.length) return;

    const splatAsset = splatAssets[0];

    console.log(splatAsset.entity);
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
      const entity = modelElement.entity;

      const immediateLayer = app.scene.layers.getLayerByName("Immediate");

      const renderComponents = entity.findComponents("render");

      const col1 = new Color(0.24, 0.84, 0.90);
      const col2 = new Color(0.37, 0.71, 0.77);

      renderComponents.forEach((renderComp) => {
        renderComp.layers = [immediateLayer.id];

        const name = renderComp.entity.name;
        console.log(name);

        renderComp.meshInstances.forEach((meshInstance) => {
          const material = meshInstance.material;
          // material.emissive = name === "03F" ? col1 : col2;
          material.diffuse = name === "03F" ? col1 : col2;
          material.specular = new Color(0.91, 0.33, 0.09);
          material.shininess = 100;
          material.opacity = 1;
          // material.opacity = Math.random() > 0.5
          //   ? name === "03F" ? 0.9 : 0.4
          //   : 0.0;
          material.blendType = BLEND_NORMAL;
          material.update();
        });
      });
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
          this.developmentsData,
        );
        await this.initializeModels(camera);

        const frameSceneScript = camera.script.frameScene;
        frameSceneScript.frameScene(
          new Vec3(0, 0, 0),
          20,
          0,
          [-183, 160, -183],
          [0, 2, 5],
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
