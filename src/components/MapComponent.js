import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Check, X, MapPin, Navigation } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';
import { calculateOptimalRoute } from '../services/routeService';

const MapComponent = ({
  addresses,
  onAddressClick,
  onPolygonComplete,
  startingPoint,
  onRouteCreated,
  shouldCreateRoute,
  onRouteCreationComplete,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const startingMarkerRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const polygonRef = useRef(null);
  const pendingPolygonRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const initializationRef = useRef(false);
  const loaderRef = useRef(null);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showPolygonControls, setShowPolygonControls] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [locationPermission, setLocationPermission] = useState('prompt');
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingMap, setIsLoadingMap] = useState(false);

  // Request user location with better UX
  const requestLocation = useCallback(() => {
    setIsLoadingLocation(true);
    setLocationPermission('requesting');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(userLocation);
          setLocationPermission('granted');
          setShowLocationPrompt(false);
          setIsLoadingLocation(false);
        },
        (error) => {
          console.warn('Location access denied or failed:', error);
          // Fallback to New York
          setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
          setLocationPermission('denied');
          setShowLocationPrompt(false);
          setIsLoadingLocation(false);
        },
        { 
          timeout: 10000,
          enableHighAccuracy: false,
          maximumAge: 600000 // 10 minutes
        }
      );
    } else {
      console.warn('Geolocation not supported');
      setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
      setLocationPermission('denied');
      setShowLocationPrompt(false);
      setIsLoadingLocation(false);
    }
  }, []);

  // Skip location request and use default
  const skipLocationRequest = useCallback(() => {
    setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
    setLocationPermission('denied');
    setShowLocationPrompt(false);
    setIsLoadingLocation(false);
  }, []);

  // Load Google Maps API using @googlemaps/js-api-loader
  const loadGoogleMapsAPI = useCallback(() => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.google && window.google.maps && window.google.maps.Map) {
        resolve();
        return;
      }

      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      
      // Better API key validation
      if (!apiKey) {
        reject(new Error('Google Maps API key is missing. Please add REACT_APP_GOOGLE_MAPS_API_KEY to your .env file.'));
        return;
      }
      
      if (apiKey === 'your_google_maps_api_key_here') {
        reject(new Error('Please replace the placeholder API key in your .env file with a valid Google Maps API key.'));
        return;
      }

      // Initialize loader if not already done
      if (!loaderRef.current) {
        loaderRef.current = new Loader({
          apiKey: apiKey,
          version: "weekly",
          libraries: ["drawing", "geometry"]
        });
      }

      // Load the API
      loaderRef.current.load()
        .then(() => {
          // Double-check that the API is actually available
          if (!window.google || !window.google.maps || !window.google.maps.Map) {
            reject(new Error('Google Maps API failed to load properly. Please check your API key and enabled services.'));
            return;
          }
          resolve();
        })
        .catch((error) => {
          console.error('Error loading Google Maps API:', error);
          let errorMessage = 'Failed to load Google Maps API. ';
          
          if (error.message && error.message.includes('ApiNotActivatedMapError')) {
            errorMessage += 'Please enable the Maps JavaScript API in Google Cloud Console.';
          } else if (error.message && error.message.includes('InvalidKeyMapError')) {
            errorMessage += 'Invalid API key. Please check your Google Maps API key.';
          } else if (error.message && error.message.includes('RefererNotAllowedMapError')) {
            errorMessage += 'This domain is not authorized for this API key.';
          } else {
            errorMessage += 'Please check your API key and ensure Maps JavaScript API, Geocoding API, and Directions API are enabled.';
          }
          
          reject(new Error(errorMessage));
        });
    });
  }, []);

  // Initialize map once location is determined
  useEffect(() => {
    if (!currentLocation || isMapLoaded || initializationRef.current) return;

    initializationRef.current = true;
    setIsLoadingMap(true);

    const initMap = async () => {
      try {
        await loadGoogleMapsAPI();

        if (!mapRef.current) {
          throw new Error('Map container not available');
        }

        if (!window.google || !window.google.maps) {
          throw new Error('Google Maps API not available');
        }

        const map = new window.google.maps.Map(mapRef.current, {
          center: currentLocation,
          zoom: locationPermission === 'granted' ? 14 : 12,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          mapTypeId: 'roadmap',
          gestureHandling: 'greedy'
        });

        mapInstanceRef.current = map;

        // Add user location marker if permission was granted
        if (locationPermission === 'granted') {
          new window.google.maps.Marker({
            position: currentLocation,
            map: map,
            title: 'Your Current Location',
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8" fill="#4285f4" stroke="white" stroke-width="3"/>
                  <circle cx="12" cy="12" r="3" fill="white"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(24, 24),
              anchor: new window.google.maps.Point(12, 12)
            },
            zIndex: 1000
          });
        }

        // Initialize drawing manager
        const drawingManager = new window.google.maps.drawing.DrawingManager({
          drawingMode: null,
          drawingControl: true,
          drawingControlOptions: {
            position: window.google.maps.ControlPosition.TOP_RIGHT,
            drawingModes: [window.google.maps.drawing.OverlayType.POLYGON]
          },
          polygonOptions: {
            fillColor: '#3b82f6',
            fillOpacity: 0.2,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            clickable: false,
            editable: true,
            zIndex: 1
          }
        });

        drawingManager.setMap(map);
        drawingManagerRef.current = drawingManager;

        // Initialize directions
        directionsServiceRef.current = new window.google.maps.DirectionsService();
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#ef4444',
            strokeWeight: 4,
            strokeOpacity: 0.8
          }
        });
        directionsRendererRef.current.setMap(map);

        // Handle polygon completion
        window.google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon) => {
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
  }, [currentLocation, locationPermission, loadGoogleMapsAPI]);

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
      const point = new window.google.maps.LatLng(address.latitude, address.longitude);
      return window.google.maps.geometry.poly.containsLocation(point, polygonRef.current);
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

  // Update markers when addresses change
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Create new markers
    const geocodedAddresses = addresses.filter(addr => addr.latitude && addr.longitude);
    
    geocodedAddresses.forEach(address => {
      let iconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
      let size = new window.google.maps.Size(32, 32);
      
      if (address.isOnRoute) {
        iconUrl = 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';
      } else if (address.isSelected) {
        iconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      }

      const marker = new window.google.maps.Marker({
        position: { lat: address.latitude, lng: address.longitude },
        map: mapInstanceRef.current,
        title: address.businessName,
        icon: { url: iconUrl, scaledSize: size }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div class="p-2">
            <h3 class="font-semibold">${address.businessName}</h3>
            <p class="text-sm text-gray-600">${address.address}</p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
        onAddressClick(address);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if we have addresses
    if (geocodedAddresses.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      geocodedAddresses.forEach(address => {
        bounds.extend({ lat: address.latitude, lng: address.longitude });
      });
      
      // Include user location in bounds if available
      if (locationPermission === 'granted' && currentLocation) {
        bounds.extend(currentLocation);
      }
      
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [addresses, isMapLoaded, onAddressClick, currentLocation, locationPermission]);

  // Update starting point marker
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapLoaded) return;

    // Clear existing starting marker
    if (startingMarkerRef.current) {
      startingMarkerRef.current.setMap(null);
      startingMarkerRef.current = null;
    }

    // Create starting point marker if valid
    if (startingPoint.isValid && startingPoint.latitude && startingPoint.longitude) {
      const marker = new window.google.maps.Marker({
        position: { lat: startingPoint.latitude, lng: startingPoint.longitude },
        map: mapInstanceRef.current,
        title: 'Starting Point',
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new window.google.maps.Size(40, 40)
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div class="p-2">
            <h3 class="font-semibold text-red-600">Starting Point</h3>
            <p class="text-sm text-gray-600">${startingPoint.address}</p>
          </div>
        `
      });

      marker.addListener('click', () => {
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

        const waypoints = selectedAddresses.map(addr => ({
          lat: addr.latitude,
          lng: addr.longitude
        }));

        const route = await calculateOptimalRoute(
          { lat: startingPoint.latitude, lng: startingPoint.longitude },
          waypoints,
          directionsServiceRef.current
        );

        directionsRendererRef.current.setDirections(route);
        onRouteCreated(route);
      } catch (error) {
        console.error('Error creating route:', error);
        alert('Failed to create route. Please try again.');
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
          <div className="text-center p-6 max-w-lg">
            <div className="bg-red-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <MapPin className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Loading Error</h3>
            <p className="text-gray-600 mb-4 text-sm">{mapError}</p>
            <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-lg text-left">
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
                <li>Replace the placeholder in your .env file with your actual API key</li>
                <li>Restart the development server</li>
              </ol>
              <p className="mt-3 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                <strong>Note:</strong> It may take a few minutes for newly created API keys or enabled services to become active.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Location Prompt Overlay */}
      {showLocationPrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md mx-4 border border-gray-200">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Navigation className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Center Map on Your Location?
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Allow location access to center the map on your current position for a better experience. 
                This helps with navigation and finding nearby addresses.
              </p>
              <div className="flex flex-col space-y-3">
                <button
                  onClick={requestLocation}
                  disabled={isLoadingLocation}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
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
                  className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors font-medium"
                >
                  Skip & Use Default Location
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Your location data is only used to center the map and is not stored or shared.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {(!isMapLoaded || isLoadingMap) && !mapError && !showLocationPrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-40">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading map...</p>
            {locationPermission === 'granted' && (
              <p className="text-sm text-green-600 mt-2 flex items-center justify-center">
                <Navigation className="h-4 w-4 mr-1" />
                Using your location
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">This may take a few moments</p>
          </div>
        </div>
      )}
      
      {/* Polygon Accept/Cancel Controls */}
      {showPolygonControls && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10 border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">Accept polygon selection?</p>
          <div className="flex space-x-2">
            <button
              onClick={handleAcceptPolygon}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              title="Accept polygon and select addresses"
            >
              <Check size={16} className="mr-2" />
              Accept
            </button>
            <button
              onClick={handleCancelPolygon}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              title="Cancel polygon selection"
            >
              <X size={16} className="mr-2" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Map Legend</h4>
        <div className="space-y-2 text-xs">
          {locationPermission === 'granted' && (
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 border-2 border-white shadow-sm"></div>
              <span className="text-gray-700">Your Location</span>
            </div>
          )}
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-600 rounded-full mr-3"></div>
            <span className="text-gray-700">Starting Point / Regular Points</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-600 rounded-full mr-3"></div>
            <span className="text-gray-700">Selected Points</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-600 rounded-full mr-3"></div>
            <span className="text-gray-700">Route Points</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;