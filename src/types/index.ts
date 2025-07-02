export interface Address {
  id: string;
  businessName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isSelected?: boolean;
  isOnRoute?: boolean;
  isDuplicate?: boolean;
  isHighlighted?: boolean;
}

export interface AddressData {
  id: string;
  businessName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isSelected?: boolean;
  isOnRoute?: boolean;
  isDuplicate?: boolean;
  isHighlighted?: boolean;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  address: Address;
}

export interface StartingPoint {
  address: string;
  latitude?: number;
  longitude?: number;
  isValid: boolean;
}

export interface MapState {
  isDrawing: boolean;
  polygon: google.maps.Polygon | null;
  selectedAddresses: Address[];
  route: google.maps.DirectionsResult | null;
  isPolygonDrawn: boolean;
  pendingPolygon: google.maps.Polygon | null;
}

export interface RouteData {
  startingPoint: StartingPoint;
  selectedAddresses: Address[];
  route: google.maps.DirectionsResult;
  totalDistance: string;
  totalDuration: string;
}