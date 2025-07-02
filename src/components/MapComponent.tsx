import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Address, StartingPoint } from '../types/index';
import { calculateOptimalRoute } from '../services/routeService';
import { Check, X, MapPin, Navigation } from 'lucide-react';

interface MapComponentProps {
  addresses: Address[];
  onAddressClick: (address: Address) => void;
  onPolygonComplete: (selectedAddresses: Address[]) => void;
  startingPoint: StartingPoint;
  onRouteCreated: (route: google.maps.DirectionsResult) => void;
  shouldCreateRoute: boolean;
  onRouteCreationComplete: () => void;
  onClearRoute: () => void;
  onClearPoints: () => void;
  shouldClearRoute: boolean;
  shouldClearPoints: boolean;
}

const MapComponent: React.FC<MapComponentProps> = ({
  addresses,
  onAddressClick,
  onPolygonComplete,
  startingPoint,
  onRouteCreated,
  shouldCreateRoute,
  onRouteCreationComplete,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const startingMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const pendingPolygonRef = useRef<google.maps.Polygon | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const initializationRef = useRef(false);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showPolygonControls, setShowPolygonControls] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingMap, setIsLoadingMap] = useState(false);

  // Request user location
  const requestLocation = useCallback(() => {
    setIsLoadingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setShowLocationPrompt(false);
          setIsLoadingLocation(false);
        },
        () => {
          // Fallback to New York
          setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
          setShowLocationPrompt(false);
          setIsLoadingLocation(false);
        },
        { timeout: 5000 }
      );
    } else {
      setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
      setShowLocationPrompt(false);
      setIsLoadingLocation(false);
    }
  }, []);

  // Skip location request
  const skipLocationRequest = useCallback(() => {
    setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
    setShowLocationPrompt(false);
    setIsLoadingLocation(false);
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!currentLocation || isMapLoaded || initializationRef.current) return;

    initializationRef.current = true;
    setIsLoadingMap(true);

    const initMap = async () => {
      try {
        const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          throw new Error('Google Maps API key is missing. Please add REACT_APP_GOOGLE_MAPS_API_KEY to your .env file.');
        }
        
        if (apiKey === 'your_google_maps_api_key_here') {
          throw new Error('Please replace the placeholder API key in your .env file with a valid Google Maps API key.');
        }

        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['drawing', 'geometry', 'marker']
        });

        await loader.load();

        // Verify that Google Maps API is actually available
        if (!window.google || !window.google.maps || !window.google.maps.Map) {
          throw new Error('Google Maps API failed to load properly. Please check your API key and ensure Maps JavaScript API, Geocoding API, and Directions API are enabled in Google Cloud Console.');
        }

        if (!mapRef.current) {
          throw new Error('Map container not available');
        }

        const map = new google.maps.Map(mapRef.current, {
          center: currentLocation,
          zoom: 12,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          mapId: 'DEMO_MAP_ID' // Required for AdvancedMarkerElement
        });

        mapInstanceRef.current = map;

        // Initialize drawing manager with thicker polygon border
        const drawingManager = new google.maps.drawing.DrawingManager({
          drawingMode: null,
          drawingControl: true,
          drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT,
            drawingModes: [google.maps.drawing.OverlayType.POLYGON]
          },
          polygonOptions: {
            fillColor: '#3b82f6',
            fillOpacity: 0.2,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.9,
            strokeWeight: 4, // Increased from 2 to 4 for thicker border
            clickable: false,
            editable: true,
            zIndex: 1
          }
        });

        drawingManager.setMap(map);
        drawingManagerRef.current = drawingManager;

        // Initialize directions
        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#ef4444',
            strokeWeight: 4,
            strokeOpacity: 0.8
          }
        });
        directionsRendererRef.current.setMap(map);

        // Handle polygon completion
        google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
          if (pendingPolygonRef.current) {
            pendingPolygonRef.current.setMap(null);
          }
          pendingPolygonRef.current = polygon;
          setShowPolygonControls(true);
          drawingManager.setDrawingMode(null);
        });

        setIsMapLoaded(true);
        setIsLoadingMap(false);
      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError(error instanceof Error ? error.message : 'Failed to load map');
        setIsLoadingMap(false);
        initializationRef.current = false;
      }
    };

    initMap();
  }, [currentLocation, isMapLoaded]);

  // Handle polygon accept
  const handleAcceptPolygon = useCallback(() => {
    if (!pendingPolygonRef.current || !mapInstanceRef.current) return;

    // Remove existing polygon
    if (polygonRef.current) {
      polygonRef.current.setMap(null);
    }

    // Set as active polygon
    polygonRef.current = pendingPolygonRef.current;
    pendingPolygonRef.current = null;

    // Find addresses inside polygon
    const selectedAddresses = addresses.filter(address => {
      if (!address.latitude || !address.longitude) return false;
      const point = new google.maps.LatLng(address.latitude, address.longitude);
      return google.maps.geometry.poly.containsLocation(point, polygonRef.current!);
    });

    onPolygonComplete(selectedAddresses);
    setShowPolygonControls(false);
  }, [addresses, onPolygonComplete]);

  // Handle polygon cancel
  const handleCancelPolygon = useCallback(() => {
    if (pendingPolygonRef.current) {
      pendingPolygonRef.current.setMap(null);
      pendingPolygonRef.current = null;
    }
    setShowPolygonControls(false);
  }, []);

  // Create dot marker element
  const createDotMarkerElement = (color: string, size: number = 6) => {
    const markerElement = document.createElement('div');
    markerElement.style.width = `${size * 2}px`;
    markerElement.style.height = `${size * 2}px`;
    markerElement.style.backgroundColor = color;
    markerElement.style.border = '2px solid white';
    markerElement.style.borderRadius = '50%';
    markerElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
    markerElement.style.cursor = 'pointer';
    markerElement.style.transition = 'transform 0.2s ease';
    
    // Add hover effect
    markerElement.addEventListener('mouseenter', () => {
      markerElement.style.transform = 'scale(1.3)';
    });
    
    markerElement.addEventListener('mouseleave', () => {
      markerElement.style.transform = 'scale(1)';
    });
    
    return markerElement;
  };

  // Update markers when addresses change
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current = [];

    // Create new markers
    const geocodedAddresses = addresses.filter(addr => addr.latitude && addr.longitude);
    
    geocodedAddresses.forEach(address => {
      let iconColor = '#dc2626'; // red-600 for regular points
      let iconSize = 6;
      
      // Match the legend colors exactly
      if (address.isOnRoute) {
        iconColor = '#16a34a'; // green-600
        iconSize = 7;
      } else if (address.isSelected) {
        iconColor = '#2563eb'; // blue-600
        iconSize = 6;
      }

      const markerElement = createDotMarkerElement(iconColor, iconSize);
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: address.latitude!, lng: address.longitude! },
        map: mapInstanceRef.current,
        title: address.businessName,
        content: markerElement
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-2 min-w-[180px]">
            <h3 class="font-semibold text-gray-900 mb-1 text-sm">${address.businessName}</h3>
            <p class="text-xs text-gray-600">${address.address}</p>
          </div>
        `
      });

      // Add click listener
      markerElement.addEventListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
        onAddressClick(address);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if we have addresses
    if (geocodedAddresses.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      geocodedAddresses.forEach(address => {
        bounds.extend({ lat: address.latitude!, lng: address.longitude! });
      });
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [addresses, isMapLoaded, onAddressClick]);

  // Update starting point marker
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    // Clear existing starting marker
    if (startingMarkerRef.current) {
      startingMarkerRef.current.map = null;
      startingMarkerRef.current = null;
    }

    // Create starting point marker if valid
    if (startingPoint.isValid && startingPoint.latitude && startingPoint.longitude) {
      const markerElement = createDotMarkerElement('#dc2626', 8); // Larger red dot for starting point
      
      // Add a distinctive border for starting point
      markerElement.style.border = '3px solid white';
      markerElement.style.boxShadow = '0 0 0 2px #dc2626, 0 2px 4px rgba(0,0,0,0.3)';
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: startingPoint.latitude, lng: startingPoint.longitude },
        map: mapInstanceRef.current,
        title: 'Starting Point',
        content: markerElement
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-2 min-w-[180px]">
            <h3 class="font-semibold text-red-600 mb-1 text-sm">🚩 Starting Point</h3>
            <p class="text-xs text-gray-600">${startingPoint.address}</p>
          </div>
        `
      });

      markerElement.addEventListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      startingMarkerRef.current = marker;
    }
  }, [startingPoint, isMapLoaded]);

  // Handle route creation
  useEffect(() => {
    if (!shouldCreateRoute || !directionsServiceRef.current || !directionsRendererRef.current) return;

    const createRoute = async () => {
      try {
        const selectedAddresses = addresses.filter(addr => 
          addr.isSelected && addr.latitude && addr.longitude
        );
        
        if (selectedAddresses.length === 0 || !startingPoint.latitude || !startingPoint.longitude) {
          throw new Error('No valid addresses or starting point');
        }

        // Check waypoint limit (Google Maps allows max 25 waypoints)
        if (selectedAddresses.length > 25) {
          throw new Error(`Too many waypoints selected (${selectedAddresses.length}). Google Maps allows a maximum of 25 waypoints per route. Please reduce the number of selected addresses or split into multiple routes.`);
        }

        const waypoints = selectedAddresses.map(addr => ({
          lat: addr.latitude!,
          lng: addr.longitude!
        }));

        const route = await calculateOptimalRoute(
          { lat: startingPoint.latitude, lng: startingPoint.longitude },
          waypoints,
          directionsServiceRef.current!
        );

        directionsRendererRef.current!.setDirections(route);
        onRouteCreated(route);
      } catch (error) {
        console.error('Error creating route:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create route. Please try again.';
        alert(errorMessage);
      } finally {
        onRouteCreationComplete();
      }
    };

    createRoute();
  }, [shouldCreateRoute, addresses, startingPoint, onRouteCreated, onRouteCreationComplete]);

  return (
    <div className="h-full w-full relative">
      {/* Map container - always rendered */}
      <div ref={mapRef} className="h-full w-full" />
      
      {/* Error Overlay */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-50">
          <div className="text-center p-4 max-w-lg">
            <div className="bg-red-100 rounded-full p-3 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Loading Error</h3>
            <p className="text-gray-600 mb-3 text-sm">{mapError}</p>
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg text-left">
              <p className="font-medium mb-2">Setup Instructions:</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Get a Google Maps API key from <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                <li>Enable these APIs for your project:
                  <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                    <li>Maps JavaScript API</li>
                    <li>Geocoding API</li>
                    <li>Directions API</li>
                  </ul>
                </li>
                <li>Add your API key to the .env file as REACT_APP_GOOGLE_MAPS_API_KEY</li>
                <li>Restart the development server</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Location Prompt Overlay */}
      {showLocationPrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 border border-gray-200">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Navigation className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Center Map on Your Location?
              </h3>
              <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                Allow location access to center the map on your current position for a better experience.
              </p>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={requestLocation}
                  disabled={isLoadingLocation}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center text-sm"
                >
                  {isLoadingLocation ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Getting Location...
                    </>
                  ) : (
                    <>
                      <Navigation className="h-4 w-4 mr-2" />
                      Use My Location
                    </>
                  )}
                </button>
                <button
                  onClick={skipLocationRequest}
                  disabled={isLoadingLocation}
                  className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors font-medium text-sm"
                >
                  Skip & Use Default Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {(!isMapLoaded || isLoadingMap) && !mapError && !showLocationPrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-40">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Polygon Accept/Cancel Controls */}
      {showPolygonControls && (
        <div className="absolute top-3 left-3 bg-white rounded-lg shadow-lg p-3 z-10">
          <p className="text-sm font-medium text-gray-700 mb-2">Accept polygon selection?</p>
          <div className="flex space-x-2">
            <button
              onClick={handleAcceptPolygon}
              className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              title="Accept polygon and select addresses"
            >
              <Check size={14} className="mr-1" />
              Accept
            </button>
            <button
              onClick={handleCancelPolygon}
              className="flex items-center px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              title="Cancel polygon selection"
            >
              <X size={14} className="mr-1" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 bg-white rounded-lg shadow-lg p-3 z-10">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-600 rounded-full mr-2 border border-white"></div>
            <span>Starting Point / Regular Points</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-600 rounded-full mr-2 border border-white"></div>
            <span>Selected Points</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-600 rounded-full mr-2 border border-white"></div>
            <span>Route Points</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;