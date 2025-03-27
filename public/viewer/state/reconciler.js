class ViewerReconciler {
  constructor() {
    this.state = {
      visibleModels: new Map(), // Track models and their states
    };
  }

  // Compare and update state, return changes
  reconcile(newState) {
    const changes = [];

    if (newState.visibleModels) {
      // Get all currently active models and turn them off
      for (const [modelId] of this.state.visibleModels) {
        changes.push({
          type: "visibility",
          model: modelId,
          state: "off",
        });
      }

      // Create new Map from the active objects
      const newModels = new Map(
        newState.visibleModels.map((obj) => {
          if (Array.isArray(obj)) {
            return [obj[0], obj[1]]; // [id, state]
          }
          return [obj.id, obj.state];
        })
      );

      // Add changes for new active models
      for (const [modelId, state] of newModels) {
        changes.push({
          type: "visibility",
          model: modelId,
          state: state,
        });
      }

      this.state.visibleModels = newModels;
    }

    return changes;
  }
}

export default ViewerReconciler;
