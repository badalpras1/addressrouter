export interface AddressData {
  id: string;
  name: string;
  address: string;
  coordinates?: [number, number]; // [latitude, longitude]
  isSelected?: boolean;
  lineNumber?: number;
}

export interface GeocodingResult {
  address: string;
  coordinates: [number, number];
}

export interface RouteData {
  points: AddressData[];
  startingPoint: AddressData;
}