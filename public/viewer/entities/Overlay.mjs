import { BLEND_NORMAL, Color, OrientedBox, Ray, Vec3 } from "playcanvas";
const vec3A = new Vec3();
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
    this.entity = model.entity;
    this.size = new Vec3();
    this.name = model.entity.name.toLowerCase();

    this.obb = new OrientedBox();
    this.ray = new Ray();

    const renderComponents = this.model.entity.findComponents("render");
    this.center = new Vec3();
    this.halfExtents = new Vec3();

    window.addEventListener("pointerup", (evt) => this._onPointerUp(evt));
    this.app.on("update", this.update, this);

    app.fire("shapepicker:add", this.entity, this.obb);

    applyMaterialSettings(model.entity);

    renderComponents.forEach((renderComp) => {
      renderComp.meshInstances.forEach((meshInstance) => {
        this.center.copy(meshInstance.aabb.center);
        this.size.copy(meshInstance.aabb.halfExtents.mulScalar(2));
        this.halfExtents.copy(meshInstance.aabb.halfExtents);
      });
    });

    this.model.entity.enabled = true;
  }

  focusCamera() {
    const cameraEntity = this.app.root.findByName("camera");
    const frameSceneScript = cameraEntity.script.frameScene;
    frameSceneScript.frameScene(this.center, this.halfExtents.length(), 0);
  }

  _onPointerUp(evt) {
    const point = this.camera.camera.screenToWorld(evt.clientX, evt.clientY, 1);
    const cameraPosition = this.camera.getPosition();
    this.ray.set(cameraPosition, point.sub(cameraPosition).normalize());

    this.obb.worldTransform = this.entity.getWorldTransform();
    console.log(this.size);
    this.obb.halfExtents.set(this.size.x, this.size.y, this.size.z);
    console.log(this.obb.intersectsRay(this.ray, vec3A));

    if (this.obb.intersectsRay(this.ray, vec3A)) {
      window.parent.postMessage(
        { type: "infoPoint", name: this.entity.name },
        "*",
      );
    }
  }

  zoom() {
    this.focusCamera();
  }
}

export default OverlayModel;
