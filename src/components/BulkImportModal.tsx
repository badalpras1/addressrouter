import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { AddressData } from '../types/index';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (addresses: AddressData[]) => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [bulkText, setBulkText] = useState('');

  const handleImport = () => {
    const lines = bulkText.trim().split('\n');
    const addresses: AddressData[] = lines.map((line, index) => {
      const [businessName = '', address = ''] = line.split('\t');
      return {
        id: `bulk-${Date.now()}-${index}`,
        businessName: businessName.trim(),
        address: address.trim()
      };
    }).filter(addr => addr.businessName || addr.address);

    if (addresses.length > 0) {
      onImport(addresses);
      setBulkText('');
      onClose();
    } else {
      alert('No valid addresses found. Please check your input format.');
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-lg font-medium text-gray-900">
                    Bulk Import Addresses
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">
                    Paste your business names and addresses below, with each entry on a new line.
                    Separate the business name and address with a tab character.
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Example format:<br />
                    <code className="bg-gray-100 px-2 py-1 rounded">
                      Business Name[Tab]123 Main St, City, State<br />
                      Another Business[Tab]456 Oak Ave, Town, State
                    </code>
                  </p>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="w-full h-64 px-3 py-2 text-base text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Paste your data here..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Import
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default BulkImportModal;