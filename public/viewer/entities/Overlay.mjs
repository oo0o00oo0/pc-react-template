import { BLEND_NORMAL, Color, Vec3 } from "playcanvas";

class OverlayModel {
  constructor(app, camera, model) {
    const applyMaterialSettings = (entity) => {
      const immediateLayer = app.scene.layers.getLayerByName("Immediate");

      const renderComponents = entity.findComponents("render");

      renderComponents.forEach((renderComp) => {
        const col1 = new Color(0.24, 0.84, 0.90);
        const col2 = new Color(0.37, 0.71, 0.77);
        renderComp.layers = [immediateLayer.id];

        const name = renderComp.entity.name;

        renderComp.meshInstances.forEach((meshInstance) => {
          const material = meshInstance.material;
          material.emissive = name === "03F" ? col1 : col2;
          material.shininess = 100;
          material.opacity = Math.random() > 0.5
            ? name === "03F" ? 0.9 : 0.4
            : 0.0;
          material.blendType = BLEND_NORMAL;
          material.update();
        });
      });
    };

    this.app = app;
    this.camera = camera;
    this.model = model;
    this.name = model.entity.name.toLowerCase();

    const renderComponents = this.model.entity.findComponents("render");
    this.center = new Vec3();
    this.halfExtents = new Vec3();

    applyMaterialSettings(model.entity);

    renderComponents.forEach((renderComp) => {
      renderComp.meshInstances.forEach((meshInstance) => {
        this.center.copy(meshInstance.aabb.center);
        this.halfExtents.copy(meshInstance.aabb.halfExtents);
      });
    });

    // initialise off
    this.model.entity.enabled = true;
  }

  focusCamera() {
    const cameraEntity = this.app.root.findByName("camera");
    const frameSceneScript = cameraEntity.script.frameScene;
    frameSceneScript.frameScene(this.center, this.halfExtents.length(), 0);
  }

  // setMaterialBlendMode(blendType) {
  //   const renderComponents = this.model.entity.findComponents("render");
  //   renderComponents.forEach((renderComp) => {
  //     renderComp.meshInstances.forEach((meshInstance) => {
  //       if (blendType === "default") {
  //         // Restore the original blend mode
  //         meshInstance.material.blendType = this.originalBlendModes.get(
  //           meshInstance,
  //         );
  //       } else {
  //         meshInstance.material.blendType = blendType;
  //       }
  //       meshInstance.material.update();
  //     });
  //   });
  // }

  // setMaterialColor(color) {
  //   const renderComponents = this.model.entity.findComponents("render");
  //   renderComponents.forEach((renderComp) => {
  //     renderComp.meshInstances.forEach((meshInstance) => {
  //       meshInstance.material.emissive = color;
  //     });
  //   });
  // }

  // outline() {
  //   this.model.entity.enabled = true;
  //   this.infoPoint.entity.enabled = false;
  //   this.setMaterialBlendMode(7); // The blend mode you're using for outline
  // }

  zoom() {
    // console.log("ZOOM");
    // this.model.entity.enabled = true;
    // this.infoPoint.entity.enabled = false;
    // this.setMaterialBlendMode("default");
    this.focusCamera();
  }
}

export default OverlayModel;
