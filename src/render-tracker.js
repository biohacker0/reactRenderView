// src/render-tracker.js
const renderData = [];
const componentRenderCounts = new Map();
let previousFibers = new Map();
let lastAction = null;

if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log("render-tracker.js: DevTools hook found, setting up render tracking...");

  const devTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  devTools.onCommitFiberRoot = (rendererID, root) => {
    console.log("render-tracker.js: Render committed at", new Date().toISOString());
    const startTime = performance.now();
    const currentFiber = root.current;
    traverseFiberTree(currentFiber, previousFibers, startTime);
    const duration = performance.now() - startTime;
    console.log("render-tracker.js: Traversal took", duration.toFixed(2), "ms");
    updatePreviousFibers(currentFiber);
  };

  function traverseFiberTree(fiber, previousFibers, commitStartTime, parentChanged = false, parentName = null) {
    if (!fiber) return;

    // Skip root fibers with no type
    if (!fiber.type) {
      if (fiber.child) traverseFiberTree(fiber.child, previousFibers, commitStartTime, parentChanged, parentName);
      if (fiber.sibling) traverseFiberTree(fiber.sibling, previousFibers, commitStartTime, parentChanged, parentName);
      return;
    }

    console.log("render-tracker.js: Visiting fiber", fiber.type?.name || fiber.type || "Unknown");

    // Process only component fibers
    if (typeof fiber.type !== "function" && !fiber.type?.prototype?.isReactComponent) {
      if (fiber.child) traverseFiberTree(fiber.child, previousFibers, commitStartTime, parentChanged, parentName);
      if (fiber.sibling) traverseFiberTree(fiber.sibling, previousFibers, commitStartTime, parentChanged, parentName);
      return;
    }

    const fiberId = fiber.key || `${fiber.type?.name || "Anonymous"}_${fiber.index || 0}`;
    const prevFiber = previousFibers.get(fiberId);

    // Increment render count
    const renderCount = (componentRenderCounts.get(fiberId) || 0) + 1;
    componentRenderCounts.set(fiberId, renderCount);

    // Compare props and state, excluding functions
    const propsChanges = prevFiber ? getChangedKeys(prevFiber.memoizedProps, fiber.memoizedProps, true, true) : [];
    const stateChanges = prevFiber ? getChangedKeys(getComponentState(prevFiber), getComponentState(fiber), true) : [];

    // Check for memoized component or optimization opportunity
    const isMemoized = fiber.type?.$$typeof === Symbol.for("react.memo");
    const memoWarning =
      isMemoized && !propsChanges.length && !stateChanges.length && parentChanged
        ? "Unnecessary re-render (memoized component)"
        : !isMemoized && !propsChanges.length && !stateChanges.length && parentChanged && renderCount > 1
        ? "Consider React.memo to prevent unnecessary re-renders"
        : null;

    // Determine re-render reason
    const reasons = [];
    if (!prevFiber) {
      reasons.push("Mounted");
    } else {
      if (propsChanges.length) reasons.push(`Props: ${propsChanges.map((c) => c.key).join(", ")}`);
      if (stateChanges.length) reasons.push(`State: ${stateChanges.map((c) => c.key).join(", ")}`);
      if (fiber.dependencies && prevFiber.dependencies && !deepEqual(fiber.dependencies, prevFiber.dependencies)) {
        reasons.push("Context");
      }
      if (!reasons.length && parentChanged) {
        reasons.push("Parent re-render");
      }
    }

    const renderInfo = {
      component: fiber.type?.name || "Anonymous",
      renderCount,
      reasons: reasons.length ? reasons.join(", ") : "Unknown",
      propsChanges: propsChanges.length ? propsChanges : null,
      stateChanges: stateChanges.length ? stateChanges : null,
      contextChanged: reasons.includes("Context"),
      parentChanged: !!parentChanged,
      parent: parentName,
      timestamp: new Date().toISOString(),
      trigger: lastAction || "Unknown",
      duration: (performance.now() - commitStartTime).toFixed(2),
      renderTime: performance.now(),
      memoWarning,
    };

    renderData.push(renderInfo);
    console.log("render-tracker.js: Render info:", JSON.stringify(renderInfo, null, 2));

    // Propagate parentChanged if this fiber re-rendered
    const fiberChanged = propsChanges.length || stateChanges.length || renderInfo.contextChanged;
    if (fiber.child) traverseFiberTree(fiber.child, previousFibers, commitStartTime, fiberChanged || parentChanged, renderInfo.component);
    if (fiber.sibling) traverseFiberTree(fiber.sibling, previousFibers, commitStartTime, parentChanged, parentName);
  }

  function updatePreviousFibers(fiber) {
    if (!fiber) return;
    const fiberId = fiber.key || `${fiber.type?.name || "Anonymous"}_${fiber.index || 0}`;
    previousFibers.set(fiberId, {
      memoizedProps: sanitizeObject({ ...fiber.memoizedProps }),
      memoizedState: sanitizeObject({ ...fiber.memoizedState }),
      dependencies: fiber.dependencies ? sanitizeObject({ ...fiber.dependencies }) : null,
    });
    if (fiber.child) updatePreviousFibers(fiber.child);
    if (fiber.sibling) updatePreviousFibers(fiber.sibling);
  }

  function getComponentState(fiber) {
    if (!fiber.memoizedState) return {};
    const state = {};
    let hook = fiber.memoizedState;
    let index = 0;
    while (hook) {
      if (hook.memoizedState !== null) {
        state[`hook${index}`] = sanitizeObject(hook.memoizedState);
      }
      hook = hook.next;
      index++;
    }
    return state;
  }

  function getChangedKeys(prev, curr, includeValues = false, excludeFunctions = false) {
    if (!prev || !curr) return Object.keys(curr || []).map((key) => ({ key, from: null, to: curr[key] }));
    const changes = [];
    for (const key in curr) {
      if (excludeFunctions && typeof curr[key] === "function") continue;
      if (!deepEqual(prev[key], curr[key])) {
        changes.push(includeValues ? { key, from: prev[key], to: curr[key] } : key);
      }
    }
    return changes;
  }

  function sanitizeObject(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const seen = new WeakSet();
    function sanitize(value) {
      if (!value || typeof value !== "object") return value;
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
      if (value instanceof HTMLElement) return "[HTMLElement]";
      if (typeof value === "function") return "[Function]";
      const result = Array.isArray(value) ? [] : {};
      for (const key in value) {
        result[key] = sanitize(value[key]);
      }
      return result;
    }
    return sanitize(obj);
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  function setupActionListeners() {
    console.log("render-tracker.js: Setting up action listeners");
    document.addEventListener(
      "input",
      (e) => {
        if (e.target.tagName === "INPUT") {
          const parent = e.target.closest("[class]");
          lastAction = `InputChange:${parent?.className || "Unknown"}`;
          console.log("render-tracker.js: Input action", lastAction);
        }
      },
      { capture: true }
    );
    document.addEventListener(
      "click",
      (e) => {
        if (e.target.tagName === "BUTTON") {
          const parent = e.target.closest("[class]");
          lastAction = `ButtonClick:${parent?.className || "Unknown"}:${e.target.textContent || "Unknown"}`;
          console.log("render-tracker.js: Click action", lastAction);
        }
      },
      { capture: true }
    );
  }

  setupActionListeners();
  window.getRenderData = () => renderData;
} else {
  console.log("render-tracker.js: DevTools hook not found. Ensure React DevTools is enabled.");
}
