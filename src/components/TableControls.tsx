import React from 'react';
import { Upload, Trash2, MapPin, Eye, EyeOff, Plus } from 'lucide-react';
import { Address } from '../types/index';

interface TableControlsProps {
  onFileUpload: (file: File) => void;
  onClearTable: () => void;
  onGeocodeAll: () => void;
  onToggleCoordinates: () => void;
  onAddTabDelimited: () => void;
  showCoordinates: boolean;
  isGeocoding: boolean;
  hasAddresses: boolean;
  addresses: Address[];
}

const TableControls: React.FC<TableControlsProps> = ({
  onFileUpload,
  onClearTable,
  onGeocodeAll,
  onToggleCoordinates,
  onAddTabDelimited,
  showCoordinates,
  isGeocoding,
  hasAddresses,
  addresses
}) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  // Calculate statistics
  const totalRows = addresses.length;
  const geocodedRows = addresses.filter(addr => addr.latitude && addr.longitude).length;
  const errorRows = addresses.filter(addr => addr.address && (!addr.latitude || !addr.longitude)).length;

  return (
    <div className="p-3 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between gap-4">
        {/* Control Buttons */}
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="inline-flex items-center justify-center w-9 h-9 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              title="Upload CSV file"
            >
              <Upload size={16} />
            </label>
          </div>

          <button
            onClick={onAddTabDelimited}
            className="inline-flex items-center justify-center w-9 h-9 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            title="Add tab-delimited data"
          >
            <Plus size={16} />
          </button>

          <button
            onClick={onGeocodeAll}
            disabled={errorRows === 0 || isGeocoding}
            className="inline-flex items-center justify-center w-9 h-9 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            title={isGeocoding ? 'Geocoding all addresses...' : `Geocode ${errorRows} addresses`}
          >
            <MapPin size={16} className={isGeocoding ? 'animate-pulse' : ''} />
          </button>

          <button
            onClick={onToggleCoordinates}
            className="inline-flex items-center justify-center w-9 h-9 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            title={showCoordinates ? 'Hide coordinates columns' : 'Show coordinates columns'}
          >
            {showCoordinates ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          <button
            onClick={onClearTable}
            disabled={!hasAddresses}
            className="inline-flex items-center justify-center w-9 h-9 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            title="Clear all addresses from table"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Statistics - Only visible when there are addresses */}
        {totalRows > 0 && (
          <div className="flex items-center space-x-3 text-sm bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-shrink-0">
            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-700 text-xs">Total:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold min-w-[1.5rem] text-center">
                {totalRows}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-700 text-xs">Geocoded:</span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold min-w-[1.5rem] text-center">
                {geocodedRows}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="font-medium text-gray-700 text-xs">Errors:</span>
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-semibold min-w-[1.5rem] text-center">
                {errorRows}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableControls;