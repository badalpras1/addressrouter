const GEOCODING_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GEOCODING_API_KEY) {
    throw new Error('Google Maps API key not found');
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function geocodeAddresses(addresses: string[]): Promise<Array<{ address: string; coordinates: { lat: number; lng: number } | null }>> {
  const results = [];
  
  for (const address of addresses) {
    const coordinates = await geocodeAddress(address);
    results.push({ address, coordinates });
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}