import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { parseCSV, parseTabDelimited } from './services/csvParser';
import { geocodeAddress } from './services/geocoding';
import { generateRoutePDF } from './services/pdfService';
import TableControls from './components/TableControls';
import AddressTable from './components/AddressTable';
import MapControls from './components/MapControls';
import MapComponent from './components/MapComponent';
import TabDelimitedModal from './components/TabDelimitedModal';
import { Address, StartingPoint, RouteData } from './types/index';
import { signIn, signUp, logout, subscribeToAuth } from './services/authService';
import { User } from 'firebase/auth';

function App() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isTabModalOpen, setIsTabModalOpen] = useState(false);
  const [startingPoint, setStartingPoint] = useState<StartingPoint>({
    address: '6691 Frontier Dr, Springfield, VA 22150',
    isValid: false
  });
  const [isGeocodingStart, setIsGeocodingStart] = useState(false);
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [hasRoute, setHasRoute] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<google.maps.DirectionsResult | null>(null);
  const [mapKey, setMapKey] = useState(0); // Force map re-render when needed
  const [showStatsToast, setShowStatsToast] = useState(false);
  const [stats, setStats] = useState({ total: 0, geocoded: 0, errors: 0 });
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Memoized computed values to prevent unnecessary re-renders
  const selectedAddresses = useMemo(() => 
    addresses.filter(addr => addr.isSelected), 
    [addresses]
  );

  const hasAddresses = useMemo(() => 
    addresses.length > 0, 
    [addresses.length]
  );

  const hasSelectedPoints = useMemo(() => 
    selectedAddresses.length > 0, 
    [selectedAddresses.length]
  );

  // Detect duplicates with useCallback to prevent recreation
  const detectDuplicates = useCallback((addressList: Address[]): Address[] => {
    const addressMap = new Map<string, Address[]>();
    
    addressList.forEach(addr => {
      const key = addr.address.toLowerCase().trim();
      if (!addressMap.has(key)) {
        addressMap.set(key, []);
      }
      addressMap.get(key)!.push(addr);
    });

    return addressList.map(addr => ({
      ...addr,
      isDuplicate: addressMap.get(addr.address.toLowerCase().trim())!.length > 1
    }));
  }, []);

  // Stable event handlers
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const parsedAddresses = await parseCSV(file);
      setAddresses(prev => {
        const combined = [...prev, ...parsedAddresses];
        return detectDuplicates(combined);
      });
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Error parsing CSV file. Please check the format.');
    }
  }, [detectDuplicates]);

  const handleTabDelimitedSubmit = useCallback((text: string) => {
    try {
      const parsedAddresses = parseTabDelimited(text);
      setAddresses(prev => {
        const combined = [...prev, ...parsedAddresses];
        return detectDuplicates(combined);
      });
    } catch (error) {
      console.error('Error parsing tab-delimited data:', error);
      alert('Error parsing tab-delimited data.');
    }
  }, [detectDuplicates]);

  const handleClearTable = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all addresses?')) {
      setAddresses([]);
      setCurrentRoute(null);
      setHasRoute(false);
    }
  }, []);

  const handleGeocodeAll = useCallback(async () => {
    const addressesToGeocode = addresses.filter(addr => 
      addr.address && (!addr.latitude || !addr.longitude)
    );
    
    if (addressesToGeocode.length === 0) {
      alert('No addresses to geocode.');
      return;
    }

    setIsGeocoding(true);
    
    try {
      for (const addr of addressesToGeocode) {
        const result = await geocodeAddress(addr.address);
        if (result) {
          // Update the address immediately after geocoding
          setAddresses(prev => prev.map(a => 
            a.id === addr.id 
              ? { ...a, latitude: result.lat, longitude: result.lng }
              : a
          ));
        }
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error geocoding addresses:', error);
      alert('Error geocoding addresses. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  }, [addresses]);

  const handleUpdateAddress = useCallback((id: string, updates: Partial<Address>) => {
    setAddresses(prev => prev.map(addr => 
      addr.id === id 
        ? { ...addr, ...updates, isHighlighted: false }
        : { ...addr, isHighlighted: false }
    ));
  }, []);

  const handleDeleteAddress = useCallback((id: string) => {
    setAddresses(prev => prev.filter(addr => addr.id !== id));
  }, []);

  const handleGeocodeAddress = useCallback(async (id: string) => {
    const address = addresses.find(addr => addr.id === id);
    if (!address?.address) return;

    setIsGeocoding(true);
    
    try {
      const result = await geocodeAddress(address.address);
      if (result) {
        // Update the address immediately after geocoding
        setAddresses(prev => prev.map(addr => 
          addr.id === id 
            ? { ...addr, latitude: result.lat, longitude: result.lng }
            : addr
        ));
      } else {
        alert('Could not geocode this address.');
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      alert('Error geocoding address.');
    } finally {
      setIsGeocoding(false);
    }
  }, [addresses]);

  const handleAddressClick = useCallback((address: Address) => {
    setAddresses(prev => prev.map(addr => ({
      ...addr,
      isHighlighted: addr.id === address.id
    })));

    // Scroll to address in table
    setTimeout(() => {
      const element = document.getElementById(`address-row-${address.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const handlePolygonComplete = useCallback((selectedAddresses: Address[]) => {
    setAddresses(prev => prev.map(addr => ({
      ...addr,
      isSelected: selectedAddresses.some(selected => selected.id === addr.id),
      isHighlighted: selectedAddresses.some(selected => selected.id === addr.id)
    })));
  }, []);

  // Starting point handlers
  const handleStartingAddressChange = useCallback((address: string) => {
    setStartingPoint(prev => ({
      ...prev,
      address,
      isValid: false,
      latitude: undefined,
      longitude: undefined
    }));
  }, []);

  const handleGeocodeStartingPoint = useCallback(async () => {
    if (!startingPoint.address) return;

    setIsGeocodingStart(true);
    
    try {
      const result = await geocodeAddress(startingPoint.address);
      if (result) {
        setStartingPoint(prev => ({
          ...prev,
          latitude: result.lat,
          longitude: result.lng,
          isValid: true
        }));
      } else {
        alert('Could not geocode starting point address.');
        setStartingPoint(prev => ({ ...prev, isValid: false }));
      }
    } catch (error) {
      console.error('Error geocoding starting point:', error);
      alert('Error geocoding starting point.');
      setStartingPoint(prev => ({ ...prev, isValid: false }));
    } finally {
      setIsGeocodingStart(false);
    }
  }, [startingPoint.address]);

  const handleClearStartingPoint = useCallback(() => {
    setStartingPoint({
      address: '',
      isValid: false,
      latitude: undefined,
      longitude: undefined
    });
  }, []);

  // Route handlers
  const handleCreateRoute = useCallback(() => {
    if (!startingPoint.isValid) {
      alert('Starting point is invalid or not geocoded.');
      return;
    }
    
    if (selectedAddresses.length === 0) {
      alert('Please select addresses by drawing a polygon on the map.');
      return;
    }

    // Check waypoint limit before creating route
    if (selectedAddresses.length > 25) {
      alert(`Too many addresses selected (${selectedAddresses.length}). Google Maps allows a maximum of 25 waypoints per route. Please reduce the number of selected addresses or split into multiple routes.`);
      return;
    }

    setIsCreatingRoute(true);
  }, [startingPoint.isValid, selectedAddresses.length]);

  const handleRouteCreated = useCallback((route: google.maps.DirectionsResult) => {
    setAddresses(prev => prev.map(addr => ({
      ...addr,
      isOnRoute: addr.isSelected
    })));
    
    setCurrentRoute(route);
    setHasRoute(true);
    setIsCreatingRoute(false);
  }, []);

  const handleClearRoute = useCallback(() => {
    setAddresses(prev => prev.map(addr => ({ ...addr, isOnRoute: false })));
    setCurrentRoute(null);
    setHasRoute(false);
  }, []);

  const handleClearPoints = useCallback(() => {
    setAddresses(prev => prev.map(addr => ({ 
      ...addr, 
      isSelected: false, 
      isOnRoute: false 
    })));
    setCurrentRoute(null);
    setHasRoute(false);
    setMapKey(prev => prev + 1); // Force map refresh
  }, []);

  const handleDownloadRoute = useCallback(() => {
    if (!currentRoute || !startingPoint.isValid) {
      alert('No route available to download.');
      return;
    }

    const route = currentRoute.routes[0];
    
    const routeData: RouteData = {
      startingPoint,
      selectedAddresses,
      route: currentRoute,
      totalDistance: route.legs.reduce((total, leg) => total + (leg.distance?.value || 0), 0) / 1000 + ' km',
      totalDuration: Math.round(route.legs.reduce((total, leg) => total + (leg.duration?.value || 0), 0) / 60) + ' minutes'
    };

    try {
      generateRoutePDF(routeData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  }, [currentRoute, startingPoint, selectedAddresses]);

  // Auto-detect coordinates visibility
  useEffect(() => {
    const hasCoordinates = addresses.some(addr => addr.latitude && addr.longitude);
    setShowCoordinates(hasCoordinates);
  }, [addresses]);

  // Auto-geocode default starting address on mount
  useEffect(() => {
    if (startingPoint.address && !startingPoint.isValid) {
      (async () => {
        try {
          const result = await geocodeAddress(startingPoint.address);
          if (result) {
            setStartingPoint(prev => ({
              ...prev,
              latitude: result.lat,
              longitude: result.lng,
              isValid: true
            }));
          }
        } catch (error) {
          // Optionally handle error
        }
      })();
    }
  }, []);

  // Show toast with table statistics when addresses change and there is at least one address
  useEffect(() => {
    const total = addresses.length;
    const geocoded = addresses.filter(addr => addr.latitude && addr.longitude).length;
    const errors = addresses.filter(addr => addr.address && (!addr.latitude || !addr.longitude)).length;
    setStats({ total, geocoded, errors });
    if (total > 0) {
      setShowStatsToast(true);
      const timeout = setTimeout(() => setShowStatsToast(false), 3000);
      return () => clearTimeout(timeout);
    } else {
      setShowStatsToast(false);
    }
  }, [addresses]);

  useEffect(() => {
    const unsubscribe = subscribeToAuth(setAuthUser);
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await signIn(authEmail, authPassword);
      } else {
        await signUp(authEmail, authPassword);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleAuth} className="bg-white p-6 rounded shadow-md w-full max-w-xs space-y-4">
          <h2 className="text-lg font-bold mb-2 text-center">{authMode === 'login' ? 'Login' : 'Register'}</h2>
          <input
            type="email"
            className="w-full border px-3 py-2 rounded"
            placeholder="Email"
            value={authEmail}
            onChange={e => setAuthEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full border px-3 py-2 rounded"
            placeholder="Password"
            value={authPassword}
            onChange={e => setAuthPassword(e.target.value)}
            required
          />
          {authError && <div className="text-red-600 text-sm">{authError}</div>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
            disabled={authLoading}
          >
            {authLoading ? 'Please wait...' : (authMode === 'login' ? 'Login' : 'Register')}
          </button>
          <div className="text-center text-sm">
            {authMode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button type="button" className="text-blue-600 underline" onClick={() => setAuthMode('register')}>
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="text-blue-600 underline" onClick={() => setAuthMode('login')}>
                  Login
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="p-2 flex items-center justify-end bg-gray-100 border-b">
        <div className="flex items-center space-x-2">
          <span className="text-sm">{authUser.email}</span>
          <button
            onClick={handleLogout}
            className="px-2 py-1 bg-red-500 text-white rounded text-xs"
          >
            Logout
          </button>
        </div>
      </div>
      <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">
            Address Mapping & Route Planner
          </h1>
        </div>
      </header>

      {/* Toast for table statistics */}
      {showStatsToast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-gray-300 shadow-lg rounded-lg px-6 py-3 flex items-center space-x-6 animate-fade-in">
          <div className="flex items-center space-x-1">
            <span className="font-medium text-gray-700 text-xs">Total:</span>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold min-w-[1.5rem] text-center">{stats.total}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-medium text-gray-700 text-xs">Geocoded:</span>
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold min-w-[1.5rem] text-center">{stats.geocoded}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="font-medium text-gray-700 text-xs">Errors:</span>
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-semibold min-w-[1.5rem] text-center">{stats.errors}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Table (60% width) */}
        <div className="w-3/5 flex flex-col bg-white border-r border-gray-200 min-h-0">
          <TableControls
            onFileUpload={handleFileUpload}
            onClearTable={handleClearTable}
            onGeocodeAll={handleGeocodeAll}
            onToggleCoordinates={() => setShowCoordinates(!showCoordinates)}
            onAddTabDelimited={() => setIsTabModalOpen(true)}
            showCoordinates={showCoordinates}
            isGeocoding={isGeocoding}
            hasAddresses={hasAddresses}
            addresses={addresses}
          />
          
          <AddressTable
            addresses={addresses}
            onUpdateAddress={handleUpdateAddress}
            onDeleteAddress={handleDeleteAddress}
            onGeocodeAddress={handleGeocodeAddress}
            showCoordinates={showCoordinates}
            isGeocoding={isGeocoding}
          />
        </div>

        {/* Right Panel - Map (40% width) */}
        <div className="w-2/5 flex flex-col bg-white min-h-0">
          <MapControls
            startingAddress={startingPoint.address}
            onStartingAddressChange={handleStartingAddressChange}
            onGeocodeStartingPoint={handleGeocodeStartingPoint}
            onClearStartingPoint={handleClearStartingPoint}
            onCreateRoute={handleCreateRoute}
            onClearRoute={handleClearRoute}
            onClearPoints={handleClearPoints}
            onDownloadRoute={handleDownloadRoute}
            isStartingPointValid={startingPoint.isValid}
            hasSelectedPoints={hasSelectedPoints}
            hasRoute={hasRoute}
            isCreatingRoute={isCreatingRoute}
            isGeocodingStart={isGeocodingStart}
          />
          
          <div className="flex-1 min-h-0">
            <MapComponent
              key={mapKey}
              addresses={addresses}
              onAddressClick={handleAddressClick}
              onPolygonComplete={handlePolygonComplete}
              startingPoint={startingPoint}
              onRouteCreated={handleRouteCreated}
              shouldCreateRoute={isCreatingRoute}
              onRouteCreationComplete={() => setIsCreatingRoute(false)}
              onClearRoute={() => {}}
              onClearPoints={() => {}}
              shouldClearRoute={false}
              shouldClearPoints={false}
            />
          </div>
        </div>
      </div>

      <TabDelimitedModal
        isOpen={isTabModalOpen}
        onClose={() => setIsTabModalOpen(false)}
        onSubmit={handleTabDelimitedSubmit}
      />
    </div>
  );
}

export default App;