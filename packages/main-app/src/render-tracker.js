// src/render-tracker.js
const renderData = [];
const componentRenderCounts = new Map();
const componentTree = { id: "root", children: [] };
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
    const renderFrequency = renderData.length / ((performance.now() - renderData[0]?.renderTime) / 1000) || 0;
    console.log("render-tracker.js: Render frequency", renderFrequency.toFixed(2), "renders/sec");
  };

  function traverseFiberTree(fiber, previousFibers, commitStartTime, parentChanged = false, parentName = null, treeNode = componentTree, modulePath = "") {
    if (!fiber) return;

    if (!fiber.type) {
      if (fiber.child) traverseFiberTree(fiber.child, previousFibers, commitStartTime, parentChanged, parentName, treeNode, modulePath);
      if (fiber.sibling) traverseFiberTree(fiber.sibling, previousFibers, commitStartTime, parentChanged, parentName, treeNode, modulePath);
      return;
    }

    console.log("render-tracker.js: Visiting fiber", fiber.type?.name || fiber.type || "Unknown");

    if (typeof fiber.type !== "function" && !fiber.type?.prototype?.isReactComponent) {
      if (fiber.child) traverseFiberTree(fiber.child, previousFibers, commitStartTime, parentChanged, parentName, treeNode, modulePath);
      if (fiber.sibling) traverseFiberTree(fiber.sibling, previousFibers, commitStartTime, parentChanged, parentName, treeNode, modulePath);
      return;
    }

    const currentModulePath = modulePath ? `${modulePath}/${fiber.type?.name || "Anonymous"}` : fiber.type?.name || "Anonymous";
    const fiberId = fiber.key || `${currentModulePath}_${fiber.index || 0}`;
    const componentName = currentModulePath;

    const prevFiber = previousFibers.get(fiberId);
    const renderCount = (componentRenderCounts.get(fiberId) || 0) + 1;
    componentRenderCounts.set(fiberId, renderCount);

    const propsChanges = prevFiber ? getChangedKeys(prevFiber.memoizedProps, fiber.memoizedProps, true, true) : [];
    const stateChanges = prevFiber ? getChangedKeys(getComponentState(prevFiber), getComponentState(fiber), true) : [];

    const isMemoized = fiber.type?.$$typeof === Symbol.for("react.memo");
    const memoWarning =
      isMemoized && !propsChanges.length && !stateChanges.length && parentChanged
        ? "Unnecessary re-render (memoized component)"
        : !isMemoized && !propsChanges.length && !stateChanges.length && parentChanged && renderCount > 1
        ? "Consider React.memo to prevent unnecessary re-renders"
        : null;

    const reasons = [];
    let causedBy = null;
    let propagationPath = parentName ? [parentName] : [];
    let contextProvider = null;

    if (!prevFiber || renderCount === 1) {
      reasons.push("Mounted");
    } else {
      if (propsChanges.length) {
        reasons.push(`Props: ${propsChanges.map((c) => c.key).join(", ")}`);
        let parentFiber = fiber.return;
        while (parentFiber && !causedBy) {
          const parentId = parentFiber.key || `${parentFiber.type?.name || "Anonymous"}_${parentFiber.index || 0}`;
          const parentPrevFiber = previousFibers.get(parentId);
          if (parentPrevFiber) {
            const parentStateChanges = getChangedKeys(getComponentState(parentPrevFiber), getComponentState(parentFiber), true);
            const matchedStateKeys = parentStateChanges
              .filter((change) => propsChanges.some((prop) => prop.key === change.key || JSON.stringify(prop.to) === JSON.stringify(change.to)))
              .map((change) => change.key);
            if (matchedStateKeys.length) {
              causedBy = `${parentFiber.type?.name || "Anonymous"}:State:${matchedStateKeys.join(", ")}`;
              propagationPath = [parentFiber.type?.name || "Anonymous"];
            }
          }
          parentFiber = parentFiber.return;
        }
      }
      if (stateChanges.length) reasons.push(`State: ${stateChanges.map((c) => c.key).join(", ")}`);
      if (fiber.dependencies && prevFiber.dependencies && !deepEqual(fiber.dependencies, prevFiber.dependencies)) {
        reasons.push("Context");
        let providerFiber = fiber.return;
        while (providerFiber) {
          if (providerFiber.type?.$$typeof === Symbol.for("react.provider")) {
            contextProvider = providerFiber.type?.name || "AnonymousProvider";
            causedBy = causedBy || `${contextProvider}:Context`;
            break;
          }
          providerFiber = providerFiber.return;
        }
      }
      if (!reasons.length && parentChanged) {
        reasons.push("Parent re-render");
        causedBy = parentName ? `${parentName}:Parent re-render` : null;
      }
    }

    let treeChild = treeNode.children.find((child) => child.id === fiberId);
    if (!treeChild) {
      treeChild = { id: fiberId, name: componentName, children: [] };
      treeNode.children.push(treeChild);
    }

    const hookDeps = getHookDependencies(fiber);

    const renderInfo = {
      component: componentName,
      renderCount,
      reasons: reasons.length ? reasons.join(", ") : "Unknown",
      propsChanges: propsChanges.length ? propsChanges : null,
      stateChanges: stateChanges.length ? stateChanges : null,
      contextChanged: reasons.includes("Context"),
      contextNames: fiber.dependencies ? getContextNames(fiber.dependencies) : null,
      contextProvider,
      hookDependencies: hookDeps.length ? hookDeps : null,
      parentChanged: !!parentChanged,
      parent: parentName,
      causedBy,
      propagationPath: propagationPath.length > 1 ? propagationPath : propagationPath[0] ? [propagationPath[0]] : null,
      timestamp: new Date().toISOString(),
      duration: (performance.now() - commitStartTime).toFixed(2),
      renderTime: performance.now(),
      memoWarning,
    };

    renderData.push(renderInfo);
    console.log("render-tracker.js: Render info:", JSON.stringify(renderInfo, null, 2));

    const fiberChanged = propsChanges.length || stateChanges.length || renderInfo.contextChanged;
    if (fiber.child) traverseFiberTree(fiber.child, previousFibers, commitStartTime, fiberChanged || parentChanged, componentName, treeChild, currentModulePath);
    if (fiber.sibling) traverseFiberTree(fiber.sibling, previousFibers, commitStartTime, parentChanged, parentName, treeNode, modulePath);
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

  function getHookDependencies(fiber) {
    if (!fiber.memoizedState) return [];
    const deps = [];
    let hook = fiber.memoizedState;
    let index = 0;
    while (hook) {
      if (hook.memoizedState?.deps) {
        deps.push({ hook: `effect${index}`, dependencies: sanitizeObject(hook.memoizedState.deps) });
      }
      hook = hook.next;
      index++;
    }
    return deps;
  }

  function getContextNames(dependencies) {
    if (!dependencies?.contexts) return [];
    return dependencies.contexts.map((ctx) => ctx._currentValue?.displayName || "UnknownContext");
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
    const events = [
      { event: "input", selectors: ["input", "textarea", "select"] },
      { event: "change", selectors: ['input[type="checkbox"]', 'input[type="radio"]', "select"] },
      { event: "click", selectors: ["button", "a", 'div[role="button"]', "[data-clickable]"] },
      { event: "submit", selectors: ["form"] },
    ];

    const customEvents = window.renderTrackerConfig?.events || [];
    const allEvents = [...events, ...customEvents];

    allEvents.forEach(({ event, selectors }) => {
      document.addEventListener(
        event,
        (e) => {
          const target = selectors.find((sel) => e.target.matches(sel));
          if (target) {
            const parent = e.target.closest("[class]") || e.target.closest("[data-component]");
            const componentName = parent?.dataset?.component || parent?.className || "Unknown";
            const actionDetail = event === "click" ? e.target.textContent || e.target.getAttribute("aria-label") || "Unknown" : event;
            lastAction = `${event}:${componentName}:${actionDetail}`;
            console.log(`render-tracker.js: ${event} action`, lastAction);
          }
        },
        { capture: true }
      );
    });
  }

  setupActionListeners();
  window.getRenderData = () => ({ renderData, componentTree });
  window.clearRenderData = () => {
    renderData.length = 0;
    componentRenderCounts.clear();
    previousFibers.clear();
    componentTree.children = [];
    console.log("render-tracker.js: Render data cleared");
  };
}
