# SmartRoute: Waste Collection Network

A modern, full-stack web application that optimizes municipal waste collection routes using Graph Algorithms, actual GPS coordinates, and real-world street routing.

## 🚀 Features

- **Interactive Uber-Like Map Interface:** Drop pins directly on a live street map (powered by Leaflet) instead of typing abstract coordinates.
- **Real-World Routing:** Utilizes the Open Source Routing Machine (OSRM) to snap routes to exact city streets, showing realistic road distances instead of "crow flies" straight lines.
- **Smart Pathfinding Algorithms:**
  - **Greedy Nearest Neighbor** heuristic for rapid Traveling Salesperson Problem (TSP) optimization.
  - **TSP Approximation** for alternative route computations.
- **Realistic Fleet Metrics:** Calculates estimated driving times dynamically and factors in a 5-minute collection stop penalty for every bin. Provides estimated fuel usage.
- **Priority Bin Scheduling:** Tag specific bins as "Full/Priority" and the algorithm forces them to the front of the collection route.
- **Sleek UX:** Features a dark-mode splash screen, glassmorphism floating panels, and smooth animations.

## 📂 Project Structure

```text
backend/
  app.py            # Flask REST API handling algorithm requests
  algorithms.py     # Graph processing, Haversine logic, TSP solvers
frontend/
  index.html        # Main mapping interface and splash screen
  style.css         # UI styling (Uber-themed dark components)
  script.js         # Leaflet map logic, OSRM API integration
requirements.txt    # Python dependencies
```

## 🧠 How the Algorithms Work

1. **The Problem:** Visiting multiple points (bins) in the most efficient order is known as the **Traveling Salesperson Problem (TSP)**, which is NP-Hard. Using basic Dijkstra's algorithm only tells us how to get from point A to B, not the best *order* to visit A, B, C, and D.
2. **The Backend Heuristic:** The Flask backend calculates the **Haversine Distance** (real Earth-curvature distance) between all selected pins. It uses the **Greedy Nearest Neighbor** algorithm to quickly generate a highly optimized order of operations.
3. **The Street Mapping:** Once the backend determines the optimal order (e.g., Depot -> Bin C -> Bin A -> Bin B), the frontend pings the **OSRM API** to draw the actual road-following path between those exact GPS coordinates.

## ⚙️ Run Instructions (Windows / PowerShell)

1. **Open terminal in the project root:**
```powershell
cd "mini-project\proj1\proj"
```

2. **Create and activate a virtual environment:**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. **Install backend dependencies:**
```powershell
pip install -r requirements.txt
```

4. **Start the Flask backend API:**
```powershell
cd backend
python app.py
```

5. **Start the Frontend Web Server:**
Open a *new* terminal window, navigate to the `frontend` directory, and run:
```powershell
cd frontend
python -m http.server 8080
```

6. **Open the App!**
Navigate to [http://localhost:8080/index.html](http://localhost:8080/index.html) in your browser.

## 🗺️ Usage Guide

1. **Add Bins:** Click anywhere on the map to drop a pin. The first pin defaults to your starting **Depot**.
2. **Set Priorities:** Check the "Next click adds Priority Bin" box if a specific bin is overflowing and needs immediate collection.
3. **Customize:** Open the dropdowns in the side panel to manually change the Start/End points if needed.
4. **Optimize:** Click **Calculate Route**. The app will talk to the backend to sort the bins, fetch street directions from OSRM, and draw the optimal path on your screen along with estimated time and fuel metrics.
