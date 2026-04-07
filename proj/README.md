# Campus Waste Collection Route Optimizer

A beginner-friendly full-stack project that models campus waste bins as a graph and computes efficient collection routes.

## Features

- Graph modeling of waste bins using coordinates (`node = bin`, `edge = distance`)
- Algorithms:
  - Dijkstra shortest path between two selected bins
  - Greedy Nearest Neighbor route over all bins
  - Bonus: TSP approximation (`networkx.approximation`)
- API endpoints:
  - `POST /add_nodes`
  - `POST /compute_route`
  - `POST /compare`
- Frontend dashboard:
  - Add bins manually
  - Select start/end, method, number of trucks
  - Compare naive vs optimized routes
  - Canvas-based visualization with arrows and route colors
- Extra features:
  - Priority bins highlighting (simulate full bins)
  - Multiple truck route splitting
  - Random dataset generator

## Project Structure

```text
backend/
  app.py
  algorithms.py
frontend/
  index.html
  style.css
  script.js
sample_dataset.json
requirements.txt
README.md
```

## Algorithms Used

1. **Dijkstra's Algorithm**
   - Finds shortest path between selected start and end nodes.
   - Implemented with `networkx.shortest_path` and weighted edges.

2. **Greedy Nearest Neighbor**
   - Starts from selected start bin.
   - Repeatedly visits nearest unvisited bin.
   - Fast and simple, but not always globally optimal.

3. **TSP Approximation (Bonus)**
   - Uses NetworkX approximation utilities to compute a near-optimal cycle.

## API Usage

### `POST /add_nodes`

Request:

```json
{
  "nodes": [
    { "id": "A", "x": 10, "y": 20 },
    { "id": "B", "x": 30, "y": 50 }
  ]
}
```

### `POST /compute_route`

Request:

```json
{
  "start": "A",
  "end": "D",
  "method": "nearest_neighbor",
  "trucks": 2,
  "priority_bins": ["B", "E"]
}
```

Response includes route, total distance, optional Dijkstra result, and split truck routes.

### `POST /compare`

Request:

```json
{
  "start": "A",
  "method": "nearest_neighbor"
}
```

Response includes naive route, optimized route, and efficiency improvement (%).

## Run Instructions (Windows PowerShell)

1. Open terminal in project root:

```powershell
cd "D:\mini proj\proj"
```

2. Create and activate virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Install dependencies:

```powershell
pip install -r requirements.txt
```

4. Start Flask backend:

```powershell
cd "D:\mini proj\proj\backend"
python app.py
```

5. Open frontend:
   - Open `D:\mini proj\proj\frontend\index.html` in your browser
   - Or serve it with a simple local server (optional)

## Try the Sample Dataset

- Use the "Generate Random Dataset" button in the UI, or
- Manually add points from `sample_dataset.json`
- Set start node to `A`, then click:
  - **Generate Route**
  - **Compare Routes**

You will see:
- Ordered routes
- Total distance
- Improvement percentage
- Colored route lines and arrows on the canvas

