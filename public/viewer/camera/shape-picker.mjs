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

    // Get the world position of the hit
    const worldPos = new pc.Vec3();
    this.cameraEntity.camera.screenToWorld(
      scaledX,
      scaledY,
      meshInstance.distance,
      worldPos,
    );
    this.hitPosition.copy(worldPos);

    // Execute any registered callbacks for this entity and event type
    this.executePointerCallback(entity.name, eventType, this.hitPosition);

    // Send message to parent when overlay is clicked
    window.parent.postMessage(
      { type: "infoPoint", name: entity.name, eventType: eventType },
      "*",
    );

    if (this.hitMarkerEntity) {
      this.hitMarkerEntity.setPosition(this.hitPosition);
      this.hitMarkerEntity.enabled = true;
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
      });
    });
  }
};
