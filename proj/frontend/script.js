const API_BASE = "http://127.0.0.1:5000";

const bins = [];
const priorityBins = new Set();

const form = document.getElementById("bin-form");
const outputBox = document.getElementById("output-box");
const startNodeSelect = document.getElementById("start-node");
const endNodeSelect = document.getElementById("end-node");
const methodSelect = document.getElementById("method");
const trucksInput = document.getElementById("trucks");
const canvas = document.getElementById("route-canvas");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("canvas-tooltip");

let lastNaive = [];
let lastOptimized = [];
let lastPerTruckDistance = [];
let lastTruckRoutes = [];
let currentNodesScreen = [];
let hoveredNodeId = null;
const truckColors = ["#2563eb", "#9333ea", "#ea580c", "#0d9488", "#be123c"];

function showMessage(message) {
  outputBox.innerHTML = `<div class="output-empty">${message}</div>`;
}

function friendlyErrorMessage(err) {
  if (!err || !err.message) return "Unexpected error.";
  if (err.message.includes("Failed to fetch")) {
    return "Cannot reach backend API. Start backend with: .\\.venv\\Scripts\\python.exe .\\backend\\app.py";
  }
  return err.message;
}

function formatSecondsToHhmmss(totalSeconds) {
  const total = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderOutput(data) {
  const optimizedFallback = formatSecondsToHhmmss((Number(data.total_distance) || 0) * 2.2 * 60);
  const naiveFallback = formatSecondsToHhmmss((Number(data.naive_distance) || 0) * 2.2 * 60);
  const savedFallback = formatSecondsToHhmmss(
    Math.max(0, ((Number(data.naive_distance) || 0) - (Number(data.total_distance) || 0)) * 2.2 * 60)
  );
  const optimizedTime =
    data.metrics?.optimized_time_estimate_hhmmss ??
    (data.metrics?.time_estimate != null ? formatSecondsToHhmmss(Number(data.metrics.time_estimate) * 60) : optimizedFallback);
  const naiveTime = data.metrics?.naive_time_estimate_hhmmss ?? naiveFallback;
  const savedTime = data.metrics?.time_difference_hhmmss ?? savedFallback;
  const parallelFleetFallback = formatSecondsToHhmmss(
    Math.max(...(data.per_truck_distance || [Number(data.total_distance) || 0])) * 2.2 * 60
  );
  const parallelFleetTime = data.metrics?.parallel_fleet_time_estimate_hhmmss ?? parallelFleetFallback;
  const parallelSavedFallback = formatSecondsToHhmmss(
    Math.max(
      0,
      ((Number(data.total_distance) || 0) - Math.max(...(data.per_truck_distance || [Number(data.total_distance) || 0]))) *
        2.2 *
        60
    )
  );
  const parallelSavedTime = data.metrics?.parallel_time_saved_hhmmss ?? parallelSavedFallback;

  const trucksHTML = (data.truck_routes || [])
    .map((route, idx) => {
      const dist = data.per_truck_distance?.[idx] ?? "N/A";
      return `<div>Truck ${idx + 1}: ${route.join(" -> ")} (distance: ${dist})</div>`;
    })
    .join("");
  const dijkstraHTML = data.dijkstra
    ? `<div class="output-card">
      <h3>Dijkstra (Start -> End)</h3>
      <div>Path: ${(data.dijkstra.path || []).join(" -> ")}</div>
      <div>Distance: ${data.dijkstra.distance}</div>
    </div>`
    : "";

  outputBox.innerHTML = `
    <div class="output-card">
      <h3>Optimized Route</h3>
      <div>${(data.optimized_route || []).join(" -> ")}</div>
      <div>Total Distance: ${data.total_distance}</div>
      <div>Improvement: ${data.improvement_percent}%</div>
    </div>
    <div class="output-card">
      <h3>Naive Route</h3>
      <div>${(data.naive_route || []).join(" -> ")}</div>
      <div>Naive Distance: ${data.naive_distance}</div>
    </div>
    <div class="output-card">
      <h3>Truck Routes</h3>
      ${trucksHTML || "<div>No truck routes available.</div>"}
    </div>
    <div class="output-card">
      <h3>Metrics</h3>
      <div>Optimized Time Estimate: ${optimizedTime}</div>
      <div>Naive Time Estimate: ${naiveTime}</div>
      <div>Time Saved: ${savedTime}</div>
      <div>Parallel Fleet Time (${(data.truck_routes || []).length} trucks): ${parallelFleetTime}</div>
      <div>Parallel Gain vs Single Truck: ${parallelSavedTime}</div>
      <div>Fuel Estimate: ${data.metrics?.fuel_estimate ?? "N/A"}</div>
    </div>
    ${dijkstraHTML}
  `;
}

function refreshNodeSelectors() {
  const options = bins
    .map((b) => `<option value="${b.id}">${b.id}</option>`)
    .join("");
  startNodeSelect.innerHTML = options;
  endNodeSelect.innerHTML = `<option value="">(none)</option>${options}`;
}

function normalizeCoordinates() {
  if (!bins.length) return [];
  const xs = bins.map((b) => b.x);
  const ys = bins.map((b) => b.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 45;

  return bins.map((b) => {
    const nx = maxX === minX ? canvas.width / 2 : pad + ((b.x - minX) / (maxX - minX)) * (canvas.width - pad * 2);
    const nyRaw = maxY === minY ? canvas.height / 2 : pad + ((b.y - minY) / (maxY - minY)) * (canvas.height - pad * 2);
    // Invert y-axis for screen coordinates.
    const ny = canvas.height - nyRaw;
    return { ...b, sx: nx, sy: ny };
  });
}

function drawArrow(fromX, fromY, toX, toY, color) {
  const nodeRadius = 9;
  const headLength = 12;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const startX = fromX + Math.cos(angle) * (nodeRadius + 2);
  const startY = fromY + Math.sin(angle) * (nodeRadius + 2);
  const endX = toX - Math.cos(angle) * (nodeRadius + 2);
  const endY = toY - Math.sin(angle) * (nodeRadius + 2);

  if (Math.hypot(endX - startX, endY - startY) < 4) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawRoute(route, color, pointsById) {
  for (let i = 0; i < route.length - 1; i++) {
    const from = pointsById.get(route[i]);
    const to = pointsById.get(route[i + 1]);
    if (!from || !to) continue;
    drawArrow(from.sx, from.sy, to.sx, to.sy, color);
  }
}

function drawNodes(points) {
  const startId = startNodeSelect.value;
  for (const p of points) {
    const isPriority = priorityBins.has(p.id);
    const isStart = p.id === startId;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, 9, 0, Math.PI * 2);
    if (isStart) {
      ctx.fillStyle = "#2563eb";
    } else if (isPriority) {
      ctx.fillStyle = "#f59e0b";
    } else {
      ctx.fillStyle = "#1f2937";
    }
    ctx.fill();
    if (hoveredNodeId === p.id) {
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.font = "bold 12px Arial";
    ctx.strokeStyle = "rgba(2, 6, 23, 0.95)";
    ctx.lineWidth = 3;
    ctx.strokeText(p.id, p.sx + 12, p.sy - 10);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(p.id, p.sx + 12, p.sy - 10);
  }
}

function drawGraph() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const points = normalizeCoordinates();
  currentNodesScreen = points;
  const pointsById = new Map(points.map((p) => [p.id, p]));

  if (lastNaive.length) drawRoute(lastNaive, "#b91c1c", pointsById);
  if (lastTruckRoutes.length > 1) {
    lastTruckRoutes.forEach((route, idx) => {
      drawRoute(route, truckColors[idx % truckColors.length], pointsById);
    });
  } else if (lastOptimized.length) {
    drawRoute(lastOptimized, "#047857", pointsById);
  }
  drawNodes(points);
}

async function animateRoutes(stepDelayMs = 200) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const pointsById = new Map(currentNodesScreen.map((p) => [p.id, p]));

  const drawStep = (route, color, index) => {
    if (index >= route.length - 1) return;
    const from = pointsById.get(route[index]);
    const to = pointsById.get(route[index + 1]);
    if (from && to) drawArrow(from.sx, from.sy, to.sx, to.sy, color);
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < lastNaive.length - 1; i++) {
    drawStep(lastNaive, "#b91c1c", i);
    drawNodes(currentNodesScreen);
    await sleep(stepDelayMs);
  }
  if (lastTruckRoutes.length > 1) {
    const maxLen = Math.max(...lastTruckRoutes.map((r) => r.length), 0);
    for (let i = 0; i < maxLen - 1; i++) {
      lastTruckRoutes.forEach((route, idx) => {
        drawStep(route, truckColors[idx % truckColors.length], i);
      });
      drawNodes(currentNodesScreen);
      await sleep(stepDelayMs);
    }
  } else {
    for (let i = 0; i < lastOptimized.length - 1; i++) {
      drawStep(lastOptimized, "#047857", i);
      drawNodes(currentNodesScreen);
      await sleep(stepDelayMs);
    }
  }
}

async function saveNodesToBackend() {
  if (!bins.length) {
    showMessage("Add at least one bin first.");
    return;
  }
  const response = await fetch(`${API_BASE}/add_nodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes: bins })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Failed to save nodes.");
  showMessage(`Saved ${data.node_count} nodes to backend.`);
}

async function generateRoute() {
  const start = startNodeSelect.value;
  const end = endNodeSelect.value;
  if (!start) {
    showMessage("Select a start node.");
    return;
  }

  await saveNodesToBackend();

  const payload = {
    start,
    end: end || undefined,
    method: methodSelect.value,
    trucks: Number(trucksInput.value || 1),
    priority_bins: [...priorityBins]
  };
  const response = await fetch(`${API_BASE}/compute_route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const rawData = await response.json();
  if (!response.ok) throw new Error(rawData.error || "Failed to compute route.");
  const data = {
    ...rawData,
    optimized_route: rawData.optimized_route || rawData.route || []
  };

  lastNaive = data.naive_route || [];
  lastOptimized = data.optimized_route || [];
  lastPerTruckDistance = data.per_truck_distance || [];
  lastTruckRoutes = data.truck_routes || [];
  drawGraph();
  await animateRoutes(200);

  renderOutput(data);
}

async function compareRoutes() {
  const start = startNodeSelect.value;
  const end = endNodeSelect.value;
  if (!start) {
    showMessage("Select a start node.");
    return;
  }

  await saveNodesToBackend();

  const response = await fetch(`${API_BASE}/compute_route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start,
      end: end || undefined,
      method: methodSelect.value,
      trucks: Number(trucksInput.value || 1),
      priority_bins: [...priorityBins]
    })
  });
  const rawData = await response.json();
  if (!response.ok) throw new Error(rawData.error || "Failed to compare routes.");
  const data = {
    ...rawData,
    optimized_route: rawData.optimized_route || rawData.route || []
  };

  lastNaive = data.naive_route || [];
  lastOptimized = data.optimized_route || [];
  lastPerTruckDistance = data.per_truck_distance || [];
  lastTruckRoutes = data.truck_routes || [];
  drawGraph();
  await animateRoutes(450);
  renderOutput(data);
}

function getMousePos(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

function nodeAt(x, y) {
  return currentNodesScreen.find((n) => Math.hypot(n.sx - x, n.sy - y) <= 10) || null;
}

function addRandomDataset() {
  bins.length = 0;
  priorityBins.clear();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const count = 8;

  for (let i = 0; i < count; i++) {
    const node = {
      id: letters[i],
      x: Math.floor(Math.random() * 100),
      y: Math.floor(Math.random() * 100)
    };
    bins.push(node);
    if (Math.random() < 0.3) priorityBins.add(node.id);
  }

  refreshNodeSelectors();
  drawGraph();
  showMessage("Random dataset generated. Click Generate Route or Compare Routes.");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.getElementById("bin-id").value.trim();
  const x = Number(document.getElementById("bin-x").value);
  const y = Number(document.getElementById("bin-y").value);
  const isPriority = document.getElementById("bin-priority").checked;

  if (!id) {
    showMessage("Bin ID is required.");
    return;
  }
  if (bins.some((b) => b.id === id)) {
    showMessage(`Bin '${id}' already exists.`);
    return;
  }

  bins.push({ id, x, y });
  if (isPriority) priorityBins.add(id);

  form.reset();
  refreshNodeSelectors();
  drawGraph();
  showMessage(`Added bin ${id} at (${x}, ${y}).`);
});

document.getElementById("push-nodes-btn").addEventListener("click", async () => {
  try {
    await saveNodesToBackend();
  } catch (err) {
    showMessage(friendlyErrorMessage(err));
  }
});

document.getElementById("random-btn").addEventListener("click", addRandomDataset);

document.getElementById("route-btn").addEventListener("click", async () => {
  try {
    await generateRoute();
  } catch (err) {
    showMessage(friendlyErrorMessage(err));
  }
});

document.getElementById("compare-btn").addEventListener("click", async () => {
  try {
    await compareRoutes();
  } catch (err) {
    showMessage(friendlyErrorMessage(err));
  }
});

canvas.addEventListener("mousemove", (event) => {
  const pos = getMousePos(event);
  const node = nodeAt(pos.x, pos.y);
  hoveredNodeId = node ? node.id : null;
  if (node) {
    tooltip.style.display = "block";
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY + 10}px`;
    tooltip.textContent = `${node.id} (${node.x}, ${node.y})`;
  } else {
    tooltip.style.display = "none";
  }
  drawGraph();
});

canvas.addEventListener("mouseleave", () => {
  hoveredNodeId = null;
  tooltip.style.display = "none";
  drawGraph();
});

canvas.addEventListener("click", (event) => {
  const pos = getMousePos(event);
  const node = nodeAt(pos.x, pos.y);
  if (!node) return;
  if (priorityBins.has(node.id)) {
    priorityBins.delete(node.id);
  } else {
    priorityBins.add(node.id);
  }
  drawGraph();
  showMessage(`Priority toggled for node ${node.id}.`);
});

startNodeSelect.addEventListener("change", drawGraph);

drawGraph();

