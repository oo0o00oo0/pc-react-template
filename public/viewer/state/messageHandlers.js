import ViewerReconciler from "./reconciler.js";
import { getCombinedSize, getAverageCenter } from "./vec.js";
import { Vec3 } from "playcanvas";

const reconciler = new ViewerReconciler();

export const set0 = async (viewerApp, event) => {
  console.log("set0", event);

  const app = viewerApp.app;
  const { activeObjects, camPositionEXLP, camTargetEXLP } = event.data;

  const changes = reconciler.reconcile({
    visibleModels: activeObjects,
  });

  console.log("changes", changes);

  changes.forEach((change) => {
    const model = viewerApp.models.get(change.model);
    if (model && change.state.length > 0) {
      model[change.state](camPositionEXLP);
    }
  });

  const cameraEntity = app.root.findByName("camera");
  const frameSceneScript = cameraEntity.script.frameScene;
  const centers = [];
  const halfExtents = [];

  activeObjects.forEach((object) => {
    const model = viewerApp.models.get(object.id);
    if (model) {
      centers.push(model.center);
      halfExtents.push(model.halfExtents);
    }
  });

  const averageCenter = getAverageCenter(centers);
  const combinedSize = getCombinedSize(centers, halfExtents);
  const length = combinedSize?.length();

  if (frameSceneScript) {
    frameSceneScript.frameScene(
      averageCenter,
      length,
      0,
      camPositionEXLP,
      camTargetEXLP
    );
  }

  app.renderNextFrame = true;
};

//

export const setMap = (viewerApp, event) => {
  const app = viewerApp.app;
  const { visible } = event.data;

  const hotelLabels = Array.from(viewerApp.hotelsLabels.values());
  const connectionLabels = Array.from(viewerApp.connectionsLabels.values());

  if (hotelLabels.length) {
    if (visible.hotels) {
      hotelLabels.forEach((mapLabel) => {
        mapLabel.enable();
      });
    } else {
      hotelLabels.forEach((mapLabel) => {
        mapLabel.disable();
      });
    }
  }

  if (connectionLabels.length) {
    if (visible.connections) {
      connectionLabels.forEach((mapLabel) => {
        mapLabel.enable();
      });
    } else {
      connectionLabels.forEach((mapLabel) => {
        mapLabel.disable();
      });
    }
  }
  app.renderNextFrame = true;
};

export const setCameraPosition = (viewerApp, event) => {
  const app = viewerApp.app;
  const { position, target } = event.data;
  const positionVec = new Vec3(position);
  const targetVec = new Vec3(target);
  const cameraEntity = app.root.findByName("camera");
  const frameSceneScript = cameraEntity.script.frameScene;

  frameSceneScript.specificPosition(positionVec, targetVec);
};
