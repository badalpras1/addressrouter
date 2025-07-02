import React, { useState, useRef, useCallback } from 'react';
import { AddressData } from '../types/index';
import { geocodeAddresses } from '../services/geocoding';
import { parseCSV } from '../services/csvParser';
import { FileUp, MapPin, Trash2, ClipboardList } from 'lucide-react';
import BulkImportModal from './BulkImportModal';
import Spinner from './Spinner';

interface ActionBarProps {
  addresses: AddressData[];
  onAddressesChange: (addresses: AddressData[]) => void;
}

const ActionBar: React.FC<ActionBarProps> = ({ addresses, onAddressesChange }) => {
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGeocodeAddresses = useCallback(async () => {
    const addressesToGeocode = addresses.filter(a => a.address && (a.latitude == null || a.longitude == null));
    
    if (addressesToGeocode.length === 0) {
      alert('No addresses to geocode. Add addresses or make sure they are not already geocoded.');
      return;
    }

    setIsGeocoding(true);
    try {
      const geocodedAddresses = await geocodeAddresses(addressesToGeocode.map(a => a.address));
      
      const updatedAddresses = addresses.map(address => {
        const geocoded = geocodedAddresses.find(g => g.address === address.address);
        if (geocoded) {
          return { ...address, coordinates: geocoded.coordinates };
        }
        return address;
      });
      
      onAddressesChange(updatedAddresses);
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Error geocoding addresses. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  }, [addresses, onAddressesChange]);

  const handleClearAddresses = useCallback(() => {
    if (addresses.length === 0) return;
    
    if (window.confirm('Are you sure you want to clear all addresses?')) {
      onAddressesChange([]);
    }
  }, [addresses, onAddressesChange]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('=== CSV UPLOAD START ===');
    console.log('File:', file.name, file.type, file.size);

    // Validate file
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.csv', '.txt'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      alert(`Please select a CSV or TXT file. Selected: ${file.name}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Please select a file smaller than 10MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size === 0) {
      alert('File is empty. Please choose a file with data.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsImporting(true);
    
    try {
      // Small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const parsedAddresses = await parseCSV(file);
      console.log('Parsed addresses:', parsedAddresses.length);
      
      if (!Array.isArray(parsedAddresses) || parsedAddresses.length === 0) {
        throw new Error('No valid addresses found in file');
      }
      
      // Create new addresses array without mutation
      const currentAddresses = [...addresses];
      const allAddresses = [...currentAddresses, ...parsedAddresses];
      
      // Update line numbers
      const addressesWithLineNumbers = allAddresses.map((addr, index) => ({
        ...addr,
        lineNumber: index + 1
      }));

      console.log('Final addresses:', addressesWithLineNumbers.length);
      
      // Update state
      onAddressesChange(addressesWithLineNumbers);
      
      alert(`✅ Successfully imported ${parsedAddresses.length} addresses. Total: ${addressesWithLineNumbers.length}`);
      
    } catch (error) {
      console.error('CSV import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`❌ Import failed: ${errorMessage}`);
    } finally {
      console.log('=== CSV UPLOAD END ===');
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [addresses, onAddressesChange]);

  const handleBulkImport = useCallback((newAddresses: AddressData[]) => {
    if (newAddresses.length === 0) {
      alert('No addresses to import.');
      return;
    }

    console.log('Bulk import:', newAddresses.length, 'addresses');
    
    // Create new addresses array without mutation
    const currentAddresses = [...addresses];
    const allAddresses = [...currentAddresses, ...newAddresses];
    
    // Update line numbers
    const addressesWithLineNumbers = allAddresses.map((addr, index) => ({
      ...addr,
      lineNumber: index + 1
    }));

    onAddressesChange(addressesWithLineNumbers);
    alert(`Successfully imported ${newAddresses.length} addresses. Total: ${addressesWithLineNumbers.length}`);
  }, [addresses, onAddressesChange]);

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const createTestCSV = useCallback(() => {
    const testData = `name,address
Test Business 1,123 Main St New York NY
Test Business 2,456 Oak Ave Los Angeles CA
Test Business 3,789 Pine Rd Chicago IL
Sample Restaurant,555 Broadway New York NY
Demo Store,321 Market St San Francisco CA`;
    
    const blob = new Blob([testData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-addresses.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    alert('Test CSV downloaded! Try importing it to test the functionality.');
  }, []);

  return (
    <>
      <div className="bg-white mt-6 p-4 rounded-lg shadow-md">
        <div className="flex flex-wrap gap-4 justify-start">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center disabled:bg-blue-300"
            onClick={handleGeocodeAddresses}
            disabled={isGeocoding || addresses.filter(a => a.address && (a.latitude == null || a.longitude == null)).length === 0}
          >
            {isGeocoding ? (
              <Spinner size={16} className="mr-2" />
            ) : (
              <MapPin size={16} className="mr-2" />
            )}
            {isGeocoding ? 'Geocoding...' : 'Geocode Addresses'}
          </button>
          
          <button
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors flex items-center disabled:bg-red-300"
            onClick={handleClearAddresses}
            disabled={addresses.length === 0}
          >
            <Trash2 size={16} className="mr-2" />
            Clear All Addresses
          </button>
          
          <div className="relative">
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center disabled:bg-green-300"
              onClick={triggerFileUpload}
              disabled={isImporting}
            >
              {isImporting ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <FileUp size={16} className="mr-2" />
              )}
              {isImporting ? 'Importing...' : 'Import CSV'}
            </button>
          </div>

          <button
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors flex items-center"
            onClick={() => setIsBulkImportOpen(true)}
          >
            <ClipboardList size={16} className="mr-2" />
            Bulk Import
          </button>

          <button
            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors flex items-center"
            onClick={createTestCSV}
          >
            📄 Download Test CSV
          </button>
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          <p>
            ℹ️ <strong>CSV Format</strong>: Upload a CSV file with columns for business names and addresses. 
            Common column names like "name", "business", "address", "location\" are automatically detected.
          </p>
          <p className="mt-1">
            <strong>Supported formats:</strong>
          </p>
          <ul className="list-disc list-inside mt-1 ml-4 text-xs">
            <li>name,address</li>
            <li>business,location</li>
            <li>company,street_address</li>
            <li>Any combination of name/business/company + address/location/street fields</li>
          </ul>
          <p className="mt-2 text-xs text-gray-400">
            Maximum file size: 10MB. Supported formats: .csv, .txt
          </p>
          <p className="mt-2 text-xs text-blue-600">
            <strong>🔧 Troubleshooting:</strong> If CSV import isn't working, try the "Download Test CSV" button.
          </p>
          <p className="mt-2 text-xs text-orange-600">
            <strong>Note:</strong> All imported addresses will be added - no duplicate checking is performed.
          </p>
        </div>
      </div>

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImport={handleBulkImport}
      />
    </>
  );
};

export default ActionBar;