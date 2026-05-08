"""Routing algorithms for campus waste collection optimization."""

from __future__ import annotations

from itertools import combinations
import math
from typing import Dict, List, Sequence, Tuple

import networkx as nx


NodeId = str
Coords = Tuple[float, float]


def haversine_distance(a: Coords, b: Coords) -> float:
    """Return Haversine distance between two lat/lon points in kilometers."""
    lat1, lon1 = a
    lat2, lon2 = b
    R = 6371.0 # Earth radius in km

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a_val = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a_val), math.sqrt(1 - a_val))
    return R * c


def build_complete_graph(nodes: Dict[NodeId, Coords]) -> nx.Graph:
    """Build a complete weighted graph from node coordinates."""
    graph = nx.Graph()
    for node_id, (lat, lng) in nodes.items():
        graph.add_node(node_id, lat=lat, lng=lng, label=node_id)
    for u, v in combinations(nodes.keys(), 2):
        graph.add_edge(u, v, weight=haversine_distance(nodes[u], nodes[v]))
    return graph


def route_distance(route: Sequence[NodeId], nodes: Dict[NodeId, Coords]) -> float:
    """Compute total geometric distance of a route."""
    if len(route) < 2:
        return 0.0
    return sum(
        haversine_distance(nodes[route[i]], nodes[route[i + 1]])
        for i in range(len(route) - 1)
    )


def dijkstra_path(graph: nx.Graph, start: NodeId, end: NodeId) -> Tuple[List[NodeId], float]:
    """
    Dijkstra shortest path:
    Finds minimum path cost between two nodes in a weighted graph.
    """
    path = nx.shortest_path(graph, source=start, target=end, weight="weight")
    distance = nx.shortest_path_length(graph, source=start, target=end, weight="weight")
    return path, float(distance)


def nearest_neighbor_route(nodes: Dict[NodeId, Coords], start: NodeId) -> Tuple[List[NodeId], float]:
    """
    Greedy nearest-neighbor:
    Repeatedly chooses the closest unvisited node from the current node.
    """
    if start not in nodes:
        raise ValueError(f"Start node '{start}' does not exist.")
    unvisited = set(nodes.keys())
    unvisited.remove(start)
    route = [start]
    current = start
    while unvisited:
        next_node = min(unvisited, key=lambda n: haversine_distance(nodes[current], nodes[n]))
        route.append(next_node)
        unvisited.remove(next_node)
        current = next_node
    return route, route_distance(route, nodes)


def two_opt(route: List[NodeId], nodes: Dict[NodeId, Coords]) -> Tuple[List[NodeId], float]:
    """
    2-opt local search:
    Tries swapping route segments to reduce crossing edges and shorten total distance.
    Runs in roughly O(n^2) per improvement pass and works well up to 50+ nodes.
    """
    if len(route) < 4:
        return route, route_distance(route, nodes)

    best_route = route[:]
    best_distance = route_distance(best_route, nodes)
    improved = True

    while improved:
        improved = False
        for i in range(1, len(best_route) - 2):
            for j in range(i + 1, len(best_route) - 1):
                candidate = best_route[:i] + best_route[i : j + 1][::-1] + best_route[j + 1 :]
                candidate_dist = route_distance(candidate, nodes)
                if candidate_dist + 1e-9 < best_distance:
                    best_route = candidate
                    best_distance = candidate_dist
                    improved = True
        # Continue until no segment swap improves the route.
    return best_route, best_distance


def enforce_priority_window(
    route: List[NodeId], priority_bins: Sequence[NodeId], start: NodeId
) -> List[NodeId]:
    """
    Ensure priority bins appear within first 30% of route positions.
    Keeps start at index 0 and preserves relative order where possible.
    """
    if not route:
        return route

    pset = set(priority_bins)
    if not pset:
        return route

    locked_start = [route[0]] if route[0] == start else []
    working = route[1:] if locked_start else route[:]

    priorities = [n for n in working if n in pset]
    normals = [n for n in working if n not in pset]
    reordered = locked_start + priorities + normals

    max_priority_index = max(1, math.ceil(0.3 * len(reordered)))
    for node in reordered[1:]:
        if node in pset and reordered.index(node) > max_priority_index:
            reordered.remove(node)
            reordered.insert(max_priority_index, node)

    return reordered


def naive_route(nodes: Dict[NodeId, Coords], start: NodeId) -> Tuple[List[NodeId], float]:
    """Build a naive route from insertion order, rotated to begin at start."""
    keys = list(nodes.keys())
    if start not in nodes:
        raise ValueError(f"Start node '{start}' does not exist.")
    if not keys:
        return [], 0.0
    start_idx = keys.index(start)
    ordered = keys[start_idx:] + keys[:start_idx]
    return ordered, route_distance(ordered, nodes)


def tsp_approx_route(graph: nx.Graph, start: NodeId) -> Tuple[List[NodeId], float]:
    """Approximate TSP cycle via NetworkX and return route (without repeated start)."""
    if start not in graph.nodes:
        raise ValueError(f"Start node '{start}' does not exist.")
    cycle = nx.approximation.traveling_salesman_problem(graph, cycle=True, weight="weight")
    if cycle and cycle[0] != start and start in cycle:
        idx = cycle.index(start)
        cycle = cycle[idx:] + cycle[1 : idx + 1]
    distance = sum(graph[cycle[i]][cycle[i + 1]]["weight"] for i in range(len(cycle) - 1))
    route_no_repeat = cycle[:-1] if cycle and cycle[0] == cycle[-1] else cycle
    return route_no_repeat, float(distance)


def efficiency_improvement(naive_dist: float, optimized_dist: float) -> float:
    """Return percentage improvement over naive route."""
    if naive_dist <= 0:
        return 0.0
    return ((naive_dist - optimized_dist) / naive_dist) * 100.0

