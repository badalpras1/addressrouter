import React from 'react';
import { Route, Trash2, RotateCw, MapPin, Download, Map } from 'lucide-react';

interface MapControlsProps {
  startingAddress: string;
  onStartingAddressChange: (address: string) => void;
  onGeocodeStartingPoint: () => void;
  onClearStartingPoint: () => void;
  onCreateRoute: () => void;
  onClearRoute: () => void;
  onClearPoints: () => void;
  onDownloadRoute: () => void;
  isStartingPointValid: boolean;
  hasSelectedPoints: boolean;
  hasRoute: boolean;
  isCreatingRoute: boolean;
  isGeocodingStart: boolean;
}

const MapControls: React.FC<MapControlsProps> = ({
  startingAddress,
  onStartingAddressChange,
  onGeocodeStartingPoint,
  onClearStartingPoint,
  onCreateRoute,
  onClearRoute,
  onClearPoints,
  onDownloadRoute,
  isStartingPointValid,
  hasSelectedPoints,
  hasRoute,
  isCreatingRoute,
  isGeocodingStart
}) => {
  return (
    <div className="p-4 bg-white border-b border-gray-200">
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={startingAddress}
              onChange={(e) => onStartingAddressChange(e.target.value)}
              placeholder="Enter starting point address"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={onGeocodeStartingPoint}
              disabled={!startingAddress.trim() || isGeocodingStart}
              className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              title="Geocode starting point address"
            >
              <RotateCw size={18} className={isGeocodingStart ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClearStartingPoint}
              disabled={!startingAddress.trim()}
              className="inline-flex items-center justify-center w-10 h-10 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              title="Clear starting point"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onCreateRoute}
          disabled={!isStartingPointValid || !hasSelectedPoints || isCreatingRoute}
          className="inline-flex items-center justify-center w-10 h-10 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          title={isCreatingRoute ? 'Creating optimized route...' : 'Create optimized route through selected points'}
        >
          <Route size={18} className={isCreatingRoute ? 'animate-pulse' : ''} />
        </button>

        {hasRoute && (
          <>
            <button
              onClick={onClearRoute}
              className="inline-flex items-center justify-center w-10 h-10 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              title="Clear route but keep selected points"
            >
              <Route size={18} />
            </button>
            
            <button
              onClick={onDownloadRoute}
              className="inline-flex items-center justify-center w-10 h-10 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              title="Download route as PDF"
            >
              <Download size={18} />
            </button>
          </>
        )}

        <button
          onClick={onClearPoints}
          className="inline-flex items-center justify-center w-10 h-10 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          title="Clear all selected points and route"
        >
          <Map size={18} />
        </button>
      </div>

      {!isStartingPointValid && startingAddress.trim() && (
        <div className="mt-2 text-sm text-red-600">
          Starting point is invalid or not geocoded
        </div>
      )}
    </div>
  );
};

export default MapControls;