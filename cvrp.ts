/**
 * This implementation is based on the following source:
 * https://web.mit.edu/urban_or_book/www/book/chapter6/6.4.12.html.
 *
 * Author: dullkingsman and Abenezer Seifu
 */

/** */
enum NodeType {
  ORDER,
  VENDOR,
}

type IDType = string | number;

interface Coordinate {
  lat: number;
  long: number;
}

type Vehicle = Coordinate & {
  id: number;
  capacity?: number;
};

type NodeV = Coordinate & {
  id: IDType;
  type: NodeType;
  demand: number; // this is how much load the drop-off at the order or the pick-up at the vendor

  // order properties
  vendorId?: IDType;
};

interface Saving {
  i: IDType;
  j: IDType;
  saving: number;
}

interface Route {
  nodes: Array<IDType>;
  capacityUsed: number;
  vehicleCapacity: number;
}

const VEHICLE_INITIAL_CAPACITY = 10; // in kilo grams

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 	Calculates the haversine distance.
 */
function distance(nodeA: Coordinate, nodeB: Coordinate): number {
  const RADIUS_OF_EARTH = 6371; // Earth's radius in kilometers

  const diffLat = degreesToRadians(nodeB.lat - nodeA.lat);
  const diffLon = degreesToRadians(nodeB.long - nodeA.long);

  const halfChordSquared =
    Math.sin(diffLat / 2) * Math.sin(diffLat / 2) +
    Math.cos(degreesToRadians(nodeA.lat)) *
      Math.cos(degreesToRadians(nodeB.lat)) *
      Math.sin(diffLon / 2) *
      Math.sin(diffLon / 2);

  const angularDistance =
    2 *
    Math.atan2(Math.sqrt(halfChordSquared), Math.sqrt(1 - halfChordSquared));

  return RADIUS_OF_EARTH * angularDistance;
}

function calculateSavings(
  depot: Vehicle,
  nodeList: Array<NodeV>,
): Array<Saving> {
  let savingsList: Array<Saving> = [];

  for (let i = 0; i < nodeList.length; i++) {
    for (let j = i + 1; j < nodeList.length; j++) {
      if (
        nodeList[i].type === NodeType.ORDER &&
        nodeList[j].type === NodeType.ORDER
      ) {
        let savingValue =
          distance(depot, nodeList[i]) +
          distance(depot, nodeList[j]) -
          distance(nodeList[i], nodeList[j]);
        savingsList.push({
          i: nodeList[i].id,
          j: nodeList[j].id,
          saving: savingValue,
        });
      }
    }
  }

  return savingsList;
}

// single-depot
function clarkWright(depot: Vehicle, nodeList: Array<NodeV>): Array<Route> {
  let routes: Array<Route> = [];
  let nodeToRoute: Map<IDType, Route> = new Map();

  // Step 1: Calculate the savings
  const savingsList: Array<Saving> = calculateSavings(depot, nodeList);

  // Step 2: Rank the savings s(i, j) and list them in descending order
  savingsList.sort((a, b) => b.saving - a.saving);

  for (let saving of savingsList) {
    let route_i = nodeToRoute.get(saving.i);
    let route_j = nodeToRoute.get(saving.j);

    let node_i = nodeList.find((node) => node.id === saving.i);
    let node_j = nodeList.find((node) => node.id === saving.j);

    if (!node_i || !node_j) continue;

    // Step 3a: Neither i nor j have been assigned to a route
    if (!route_i && !route_j) {
      let newCapacityUsed =
        (depot.capacity ?? VEHICLE_INITIAL_CAPACITY) -
        (node_i.type === NodeType.ORDER ? node_i.demand : -node_i.demand) -
        (node_j.type === NodeType.ORDER ? node_j.demand : -node_j.demand);

      if (newCapacityUsed >= 0) {
        let newRoute: Route = {
          nodes: [saving.i, saving.j],
          capacityUsed: newCapacityUsed,
          vehicleCapacity: depot.capacity ?? VEHICLE_INITIAL_CAPACITY,
        };

        routes.push(newRoute);
        nodeToRoute.set(saving.i, newRoute);
        nodeToRoute.set(saving.j, newRoute);
      }
    }
    // Step 3b: One of i or j is already in a route
    else if (route_i && !route_j) {
      let newCapacityUsed =
        route_i.capacityUsed -
        (node_j.type === NodeType.ORDER ? node_j.demand : -node_j.demand);

      if (newCapacityUsed >= 0) {
        if (route_i.nodes[0] == saving.i) route_i.nodes.unshift(saving.j);
        else route_i.nodes.push(saving.j);

        route_i.capacityUsed = newCapacityUsed;
        nodeToRoute.set(saving.j, route_i);
      }
    } else if (!route_i && route_j) {
      let newCapacityUsed =
        route_j.capacityUsed -
        (node_i.type === NodeType.ORDER ? node_i.demand : -node_i.demand);

      if (newCapacityUsed >= 0) {
        if (route_j.nodes[0] == saving.j) route_j.nodes.unshift(saving.i);
        else route_j.nodes.push(saving.i);

        route_j.capacityUsed = newCapacityUsed;
        nodeToRoute.set(saving.i, route_j);
      }
    }
    // Step 3c: Both i and j have been included in two different existing routes
    else if (route_i && route_j && route_i !== route_j) {
      let newCapacityForRouteI =
        route_i.capacityUsed -
        (node_j.type === NodeType.ORDER ? node_j.demand : -node_j.demand);

      let newCapacityForRouteJ =
        route_j.capacityUsed -
        (node_i.type === NodeType.ORDER ? node_i.demand : -node_i.demand);

      if (newCapacityForRouteI >= 0 && newCapacityForRouteJ >= 0) {
        if (
          route_i.nodes[route_i.nodes.length - 1] == saving.i &&
          route_j.nodes[0] == saving.j
        ) {
          route_i.nodes = route_i.nodes.concat(route_j.nodes);
          route_i.capacityUsed = newCapacityForRouteI;

          nodeToRoute.set(saving.j, route_i);
          routes.splice(routes.indexOf(route_j), 1);
        } else if (
          route_i.nodes[0] == saving.i &&
          route_j.nodes[route_j.nodes.length - 1] == saving.j
        ) {
          route_i.nodes = route_j.nodes.concat(route_i.nodes);
          route_i.capacityUsed = newCapacityForRouteJ;

          nodeToRoute.set(saving.i, route_i);
          routes.splice(routes.indexOf(route_j), 1);
        }
      }
    }
  }

  // for any remaining nodes that have not been assigned to any route
  for (let node of nodeList) {
    if (!nodeToRoute.has(node.id)) {
      if (
        node.type === NodeType.ORDER &&
        node.demand <= (depot.capacity ?? VEHICLE_INITIAL_CAPACITY)
      ) {
        let newRoute: Route = {
          nodes: [node.id],
          capacityUsed:
            (depot.capacity ?? VEHICLE_INITIAL_CAPACITY) - node.demand,
          vehicleCapacity: depot.capacity ?? VEHICLE_INITIAL_CAPACITY,
        };

        routes.push(newRoute);
        nodeToRoute.set(node.id, newRoute);
      } else if (
        node.type === NodeType.VENDOR &&
        Math.abs(node.demand) <= (depot.capacity ?? VEHICLE_INITIAL_CAPACITY)
      ) {
        let newRoute: Route = {
          nodes: [node.id],
          capacityUsed:
            (depot.capacity ?? VEHICLE_INITIAL_CAPACITY) + node.demand, // node.demand is negative for pickups
          vehicleCapacity: depot.capacity ?? VEHICLE_INITIAL_CAPACITY,
        };

        routes.push(newRoute);
        nodeToRoute.set(node.id, newRoute);
      }

      /*
       TODO: If neither of the above conditions are met, the node's demand violates the capacity constraint.
			 TODO: Additional logic might be needed to handle such cases. But I don't know how errors are handled in
			 TODO: the backend, so I will leave this one as a to-do for now.
       */
    }
  }

  return routes;
}

// ============================================= Clusters ====================================================

type VendorOrderCluster = {
  vendor: NodeV;
  orders: Array<NodeV>;
};

function isAssociatedWithVendor(order: NodeV, vendor: NodeV): boolean {
  return order.vendorId === vendor.id;
}

function getNearestDepot(
  depotList: Array<Vehicle>,
  location: Coordinate,
): IDType | null {
  let nearestDepotId: IDType | null = null;
  let nearestDepotDistance = Infinity;

  for (let depot of depotList) {
    let _distance = distance(depot, location);

    if (_distance < nearestDepotDistance) {
      nearestDepotId = depot.id;
      nearestDepotDistance = _distance;
    }
  }

  return nearestDepotId;
}

function formDepotClusters(
  depotList: Array<Vehicle>,
  vendorList: Array<NodeV>,
  orderList: Array<NodeV>,
): Map<IDType, Array<VendorOrderCluster>> {
  let depotClusters = new Map<IDType, Array<VendorOrderCluster>>();

  for (let vendor of vendorList) {
    let associatedOrders = orderList.filter((order) =>
      isAssociatedWithVendor(order, vendor),
    );

    let nearestDepotId = getNearestDepot(depotList, vendor);

    if (nearestDepotId !== null) {
      if (!depotClusters.has(nearestDepotId))
        depotClusters.set(nearestDepotId, []);

      depotClusters.get(nearestDepotId)!.push({
        vendor: vendor,
        orders: associatedOrders,
      });
    }
  }

  return depotClusters;
}

function routeWithinClusters(
  depotList: Array<Vehicle>,
  depotClusters: Map<IDType, Array<VendorOrderCluster>>,
): Map<IDType, Array<Route>> {
  let depotRoutes = new Map<IDType, Array<Route>>();

  for (let depot of depotList) {
    if (depotClusters.has(depot.id)) {
      let clusters = depotClusters.get(depot.id)!;
      let allRoutesForDepot: Array<Route> = [];

      for (let cluster of clusters) {
        let nodesForCluster = [cluster.vendor, ...cluster.orders];
        let routesForCluster = clarkWright(depot, nodesForCluster);

        allRoutesForDepot.push(...routesForCluster);
      }

      depotRoutes.set(depot.id, allRoutesForDepot);
    }
  }

  return depotRoutes;
}

// multi-depot
function multiDepotVehicleRouter(
  vehicleList: Array<Vehicle>,
  vendorList: Array<NodeV>,
  orderList: Array<NodeV>,
): Map<IDType, Array<Route>> {
  return routeWithinClusters(
    vehicleList,
    formDepotClusters(vehicleList, vendorList, orderList),
  );
}