const API_BASE = "http://127.0.0.1:5000";
let map;
let bins = [];
let priorityBins = new Set();
let markers = {};
let polylines = [];
let binCounter = 65; // 'A'

document.addEventListener("DOMContentLoaded", () => {
  // Splash screen logic
  const splashScreen = document.getElementById("splash-screen");
  const openRouteBtn = document.getElementById("open-route-btn");
  openRouteBtn.addEventListener("click", () => {
    splashScreen.classList.add("hidden");
  });

  // Use Geolocation to center map, fallback to New Delhi
  const defaultCoords = [28.6139, 77.2090];
  map = L.map('map', {zoomControl: false}).setView(defaultCoords, 13);
  L.control.zoom({position: 'bottomright'}).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  // Try to locate user
  map.locate({setView: true, maxZoom: 14});
  map.on('locationfound', (e) => {
    updateStatus("Location found. Click map to add bins.");
  });
  map.on('locationerror', (e) => {
    updateStatus("Location not available. Using default map. Click map to add bins.");
  });

  map.on('click', onMapClick);
  
  // Prevent clicks on the panel from passing through to the map
  const panel = document.querySelector('.uber-panel');
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  
  document.getElementById("route-btn").addEventListener("click", generateRoute);
  document.getElementById("clear-btn").addEventListener("click", clearAll);
});

function onMapClick(e) {
  const isPriority = document.getElementById("priority-mode").checked;
  const id = String.fromCharCode(binCounter++);
  
  const bin = { id, lat: e.latlng.lat, lng: e.latlng.lng };
  bins.push(bin);
  if (isPriority) priorityBins.add(id);

  addMarker(bin, isPriority);
  refreshNodeSelectors();
  updateStatus(`Added bin ${id}`);
}

function addMarker(bin, isPriority) {
  let className = "custom-marker";
  if (isPriority) className += " priority";
  
  const icon = L.divIcon({
    className: className,
    html: `<span>${bin.id}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const marker = L.marker([bin.lat, bin.lng], { icon }).addTo(map);
  marker.bindPopup(`Bin ${bin.id} ${isPriority ? '(Priority)' : ''}`);
  markers[bin.id] = marker;
}

function refreshNodeSelectors() {
  const startSelect = document.getElementById("start-node");
  const endSelect = document.getElementById("end-node");
  
  const oldStart = startSelect.value;
  const oldEnd = endSelect.value;
  
  const options = bins.map(b => `<option value="${b.id}">Bin ${b.id}</option>`).join("");
  startSelect.innerHTML = options;
  endSelect.innerHTML = `<option value="">(none)</option>${options}`;
  
  if (oldStart && bins.some(b => b.id === oldStart)) {
    startSelect.value = oldStart;
  } else if (bins.length > 0) {
    startSelect.value = bins[0].id;
  }
  
  if (oldEnd && bins.some(b => b.id === oldEnd)) {
    endSelect.value = oldEnd;
  }
}

function updateStatus(msg) {
  document.getElementById("status-text").innerText = msg;
}

function clearMapLayers() {
  polylines.forEach(p => map.removeLayer(p));
  polylines = [];
}

function clearAll() {
  clearMapLayers();
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};
  bins = [];
  priorityBins.clear();
  binCounter = 65;
  refreshNodeSelectors();
  document.getElementById("output-box").innerHTML = "";
  updateStatus("Map cleared. Click to add bins.");
}

async function generateRoute() {
  if (bins.length < 2) {
    updateStatus("Need at least 2 bins to route.");
    return;
  }
  const start = document.getElementById("start-node").value;
  const end = document.getElementById("end-node").value;
  const method = document.getElementById("method").value;

  updateStatus("Calculating route...");
  
  try {
    await fetch(`${API_BASE}/add_nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: bins })
    });

    const res = await fetch(`${API_BASE}/compute_route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start,
        end: end || undefined,
        method,
        priority_bins: Array.from(priorityBins)
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to compute");
    }

    const data = await res.json();
    drawRoutes(data);
    updateStatus("Route generated successfully.");
  } catch (err) {
    updateStatus(`Error: ${err.message}`);
  }
}

const truckColors = ["#000000", "#2563eb", "#ea580c", "#16a34a", "#9333ea"];

let totalRoadDistance = 0;
let totalRoadTime = 0;

function drawRoutes(data) {
  clearMapLayers();
  
  const route = data.route;
  
  totalRoadDistance = 0;
  totalRoadTime = 0;
  let completedRequests = 0;
  
  // Show initial loading state for metrics
  document.getElementById("output-box").innerHTML = `
    <div class="status-bar" style="background:#e0f2fe; color:#0369a1;">
      Fetching road directions...
    </div>
  `;
  
  const latlngs = route.map(id => {
    const bin = bins.find(b => b.id === id);
    return [bin.lat, bin.lng];
  });
  
  const color = truckColors[0];
  
  if (latlngs.length < 2) {
    checkAllRequestsDone(1, 1, data);
    return;
  }

  const coordsString = latlngs.map(ll => `${ll[1]},${ll[0]}`).join(';');
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

  fetch(osrmUrl)
    .then(res => res.json())
    .then(osrmData => {
       if (osrmData.code === "Ok" && osrmData.routes && osrmData.routes[0]) {
           const routeData = osrmData.routes[0];
           const geojson = routeData.geometry;
           
           totalRoadDistance += routeData.distance; // meters
           totalRoadTime += routeData.duration; // seconds

           const polyline = L.geoJSON(geojson, {
              style: { color: color, weight: 5, opacity: 0.9 }
           }).addTo(map);
           polylines.push(polyline);
           
           const group = new L.featureGroup(polylines);
           map.fitBounds(group.getBounds(), { padding: [50, 50] });
       } else {
           // Fallback to straight lines
           drawStraightLineFallback(latlngs, color);
       }
    })
    .catch(err => {
       console.error("OSRM Routing Error:", err);
       drawStraightLineFallback(latlngs, color);
    })
    .finally(() => {
       checkAllRequestsDone(1, 1, data);
    });
  
  Object.values(markers).forEach(m => {
    L.DomUtil.removeClass(m._icon, 'start');
  });
  const startId = document.getElementById("start-node").value;
  if (markers[startId]) {
    L.DomUtil.addClass(markers[startId]._icon, 'start');
  }
}

function drawStraightLineFallback(latlngs, color) {
  const polyline = L.polyline(latlngs, {
     color: color, weight: 4, opacity: 0.8, dashArray: '10, 10'
  }).addTo(map);
  polylines.push(polyline);
  const group = new L.featureGroup(polylines);
  map.fitBounds(group.getBounds(), { padding: [50, 50] });
}

function checkAllRequestsDone(completed, total, data) {
  if (completed === total) {
     displayOutput(data);
  }
}

function displayOutput(data) {
  const box = document.getElementById("output-box");
  
  let distKm = data.total_distance;
  let timeStr = data.metrics.optimized_time_estimate_hhmmss || 'N/A';
  let fuel = data.metrics.fuel_estimate || '0';
  
  if (totalRoadDistance > 0) {
      distKm = totalRoadDistance / 1000;
      fuel = (distKm * 0.5).toFixed(2);
  }
  
  if (totalRoadTime > 0) {
      // Includes 5 mins stop time per bin for collection
      const totalTimeWithStops = totalRoadTime + (data.route.length * 5 * 60);
      const h = Math.floor(totalTimeWithStops / 3600);
      const m = Math.floor((totalTimeWithStops % 3600) / 60);
      const s = Math.floor(totalTimeWithStops % 60);
      timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  box.innerHTML = `
    <div class="metric-card">
      <div class="title">ROAD DISTANCE</div>
      <div class="val">${distKm.toFixed(2)} km</div>
    </div>
    <div class="metric-card">
      <div class="title">EST TIME (INC. STOPS)</div>
      <div class="val">${timeStr}</div>
    </div>
    <div class="metric-card">
      <div class="title">FUEL ESTIMATE</div>
      <div class="val">${fuel} Liters</div>
    </div>
    <div style="font-size: 13px; color: #6b7280; margin-top: 5px;">
      <b>Route:</b> ${data.route.join(" → ")}
    </div>
  `;
}
