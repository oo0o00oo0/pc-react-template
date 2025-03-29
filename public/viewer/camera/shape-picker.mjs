import * as pc from "playcanvas";
var ShapePicker = pc.createScript("shapePicker");

console.log("ShapePicker");

ShapePicker.attributes.add("cameraEntity", {
  type: "entity",
  title: "Camera Entity",
});
ShapePicker.attributes.add("hitMarkerEntity", {
  type: "entity",
  title: "Hit Marker Entity",
});

// initialize code called once per entity
ShapePicker.prototype.initialize = function () {
  console.log("ShapePicker initialized");

  // Create a PlayCanvas Picker for more accurate mesh picking
  this.picker = new pc.Picker(
    this.app,
    this.app.graphicsDevice.width,
    this.app.graphicsDevice.height,
  );

  // Add event callbacks storage for pointer events
  this.pointerCallbacks = {};

  // Register events for when pickable entities are created
  this.app.on("shapepicker:registerEvent", this.registerPointerEvent, this);

  // Register the mouse down and touch start event so we know when the user has clicked
  this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);

  // Add mouse move event for hover effects
  // this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);

  if (this.app.touch) {
    this.app.touch.on(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
  }

  this.hitPosition = new pc.Vec3();

  this.on("destroy", function () {
    // Clean up our event handlers if the script is destroyed
    this.app.mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
    this.app.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);

    if (this.app.touch) {
      this.app.touch.off(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
    }
  }, this);
};

ShapePicker.prototype.doPickerSelection = function (screenPosition, eventType) {
  console.log(
    "doPickerSelection called with position:",
    screenPosition,
    "event:",
    eventType,
  );

  if (!this.cameraEntity || !this.cameraEntity.camera) {
    console.warn("Camera entity not properly initialized in ShapePicker");
    return;
  }

  // Get screen coordinates properly from mouse or touch event
  let x, y;
  if (screenPosition.x !== undefined) {
    // It's already a position object
    x = screenPosition.x;
    y = screenPosition.y;
  } else {
    // It's a mouse/touch event
    x = screenPosition.x || screenPosition.clientX;
    y = screenPosition.y || screenPosition.clientY;
  }

  // Get canvas dimensions for scaling
  const canvas = this.app.graphicsDevice.canvas;
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;

  // Scale the coordinates
  const scaledX = x * scaleX;
  const scaledY = y * scaleY;

  // Prepare the picker with the current camera and scene
  this.picker.prepare(this.cameraEntity.camera, this.app.scene);

  // Perform the picking
  const result = this.picker.getSelection(scaledX, scaledY);

  if (result.length > 0) {
    const meshInstance = result[0];
    const entity = meshInstance.node;

    console.log("Hit detected on entity:", entity.name);

    // Create a ray from the camera through the screen point
    const ray = new pc.Ray();
    this.cameraEntity.camera.screenToWorld(
      scaledX,
      scaledY,
      this.cameraEntity.camera.farClip,
      ray.direction,
    );
    ray.origin.copy(this.cameraEntity.getPosition());
    ray.direction.sub(ray.origin).normalize();

    // Calculate the hit position using the mesh distance
    this.hitPosition.copy(ray.direction).scale(meshInstance.distance).add(
      ray.origin,
    );

    console.log("Hit position:", this.hitPosition);

    // Get the specific mesh instance's AABB for camera framing
    // This uses the actual clicked mesh, not the entire entity hierarchy
    let aabb = meshInstance.aabb.clone();
    let centerPoint = aabb.center.clone();
    let size =
      Math.max(aabb.halfExtents.x, aabb.halfExtents.y, aabb.halfExtents.z) * 2;

    console.log("Mesh AABB center:", centerPoint, "size:", size);

    // Execute any registered callbacks for this entity and event type
    this.executePointerCallback(entity.name, eventType, this.hitPosition, {
      aabb: aabb,
      centerPoint: centerPoint,
      size: size,
    });

    // Send message to parent when overlay is clicked
    window.parent.postMessage(
      {
        type: "infoPoint",
        name: entity.name,
        eventType: eventType,
        position: {
          x: this.hitPosition.x,
          y: this.hitPosition.y,
          z: this.hitPosition.z,
        },
        aabb: {
          center: {
            x: centerPoint.x,
            y: centerPoint.y,
            z: centerPoint.z,
          },
          size: size,
        },
      },
      "*",
    );

    if (this.hitMarkerEntity) {
      this.hitMarkerEntity.setPosition(this.hitPosition);
      this.hitMarkerEntity.enabled = true;
    }

    // If it's a click event, frame the camera on this object
    if (eventType === "click") {
      console.log("FRAME");
      this.frameCameraOnEntity(entity, centerPoint, size);
    }

    return true;
  } else {
    console.log("No hit detected");
    if (this.hitMarkerEntity) {
      this.hitMarkerEntity.enabled = false;
    }
    return false;
  }
};

ShapePicker.prototype.onMouseDown = function (event) {
  if (event.button == pc.MOUSEBUTTON_LEFT) {
    this.doPickerSelection(event, "click");
  }
};

ShapePicker.prototype.onMouseMove = function (event) {
  this.doPickerSelection(event, "hover");
};

ShapePicker.prototype.onTouchStart = function (event) {
  // On perform the raycast logic if the user has one finger on the screen
  if (event.touches.length == 1) {
    this.doPickerSelection(event.touches[0], "touch");

    // Android registers the first touch as a mouse event so it is possible for
    // the touch event and mouse event to be triggered at the same time
    // Doing the following line will prevent the mouse down event from triggering
    event.event.preventDefault();
  }
};

// Register a pointer event callback for a specific entity
ShapePicker.prototype.registerPointerEvent = function (
  entityName,
  eventType,
  callback,
) {
  if (!this.pointerCallbacks[entityName]) {
    this.pointerCallbacks[entityName] = {};
  }

  if (!this.pointerCallbacks[entityName][eventType]) {
    this.pointerCallbacks[entityName][eventType] = [];
  }

  this.pointerCallbacks[entityName][eventType].push(callback);
  console.log(`Registered ${eventType} event for ${entityName}`);
};

// Execute registered callbacks for an entity and event type
ShapePicker.prototype.executePointerCallback = function (
  entityName,
  eventType,
  position,
  aabbInfo,
) {
  if (
    this.pointerCallbacks[entityName] &&
    this.pointerCallbacks[entityName][eventType]
  ) {
    const callbacks = this.pointerCallbacks[entityName][eventType];
    callbacks.forEach((callback) => {
      callback({
        entityName: entityName,
        position: position,
        type: eventType,
        aabb: aabbInfo,
      });
    });
  }
};

// Get the AABB of an entity, including all child meshes
ShapePicker.prototype.getEntityAABB = function (entity) {
  let aabb = new pc.BoundingBox();
  let initialized = false;

  // Function to process a single entity
  const processEntity = (ent) => {
    // Check if entity has a model component
    if (
      ent.model && ent.model.meshInstances && ent.model.meshInstances.length > 0
    ) {
      // Get the model's AABB in world space
      const modelAabb = ent.model.aabb;

      if (!initialized) {
        aabb.copy(modelAabb);
        initialized = true;
      } else {
        aabb.add(modelAabb);
      }
    }

    // Process all children recursively
    for (let i = 0; i < ent.children.length; i++) {
      processEntity(ent.children[i]);
    }
  };

  // Start processing from the given entity
  processEntity(entity);

  // If no model was found, create a default AABB based on entity position
  if (!initialized) {
    const worldPos = entity.getPosition();
    const defaultSize = 1; // Default size if no model is found

    aabb.center = worldPos;
    aabb.halfExtents = new pc.Vec3(defaultSize, defaultSize, defaultSize);
  }

  return aabb;
};

// Frame the camera on an entity using the FrameScene script
ShapePicker.prototype.frameCameraOnEntity = function (
  entity,
  centerPoint,
  size,
) {
  // Find the camera with the FrameScene script

  console.log("Framing camera on entity:", entity.name);

  // Default Z factor (adjust as needed)
  const zFactor = 0;

  const cameraEntity = this.app.root.findByName("camera");
  const frameSceneScript = cameraEntity.script.frameScene;
  frameSceneScript.frameScene(centerPoint, 100, 0);
};
