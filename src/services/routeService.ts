export function calculateOptimalRoute(
  startPoint: { lat: number; lng: number },
  waypoints: Array<{ lat: number; lng: number }>,
  directionsService: google.maps.DirectionsService
): Promise<google.maps.DirectionsResult> {
  return new Promise((resolve, reject) => {
    if (waypoints.length === 0) {
      reject(new Error('No waypoints provided'));
      return;
    }

    const waypointObjects = waypoints.map(point => ({
      location: new google.maps.LatLng(point.lat, point.lng),
      stopover: true
    }));

    directionsService.route({
      origin: new google.maps.LatLng(startPoint.lat, startPoint.lng),
      destination: new google.maps.LatLng(startPoint.lat, startPoint.lng),
      waypoints: waypointObjects,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        resolve(result);
      } else {
        reject(new Error(`Directions request failed: ${status}`));
      }
    });
  });
}