import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { searchSchemes, getAMCs, getSchemesByAMC, getSchemeByCode } from '../services/api';

const FundSelector = ({ onSelect, selectedScheme }) => {
    const [searchMode, setSearchMode] = useState('amc'); // 'amc' or 'code'
    const [searchQuery, setSearchQuery] = useState('');
    const [schemes, setSchemes] = useState([]);
    const [amcs, setAmcs] = useState([]);
    const [filteredAmcs, setFilteredAmcs] = useState([]);
    const [amcQuery, setAmcQuery] = useState('');
    const [selectedAMC, setSelectedAMC] = useState('');
    const [showAmcDropdown, setShowAmcDropdown] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [codeError, setCodeError] = useState('');

    useEffect(() => {
        if (searchMode === 'amc') {
            fetchAMCs();
        }
    }, [searchMode]);

    useEffect(() => {
        // Filter AMCs based on user input
        if (amcQuery) {
            const filtered = amcs.filter(amc =>
                amc.toLowerCase().includes(amcQuery.toLowerCase())
            );
            setFilteredAmcs(filtered);
        } else {
            setFilteredAmcs(amcs);
        }
    }, [amcQuery, amcs]);

    useEffect(() => {
        if (searchMode === 'code') return;

        const delaySearch = setTimeout(() => {
            if (searchQuery.length >= 2) {
                handleSearch();
            } else if (selectedAMC && !searchQuery) {
                // Show AMC funds when AMC is selected but no search query
                fetchSchemesByAMC();
            } else {
                setSchemes([]);
                setIsOpen(false);
            }
        }, 300);

        return () => clearTimeout(delaySearch);
    }, [searchQuery, selectedAMC, searchMode]);

    const fetchAMCs = async () => {
        try {
            const { data } = await getAMCs();
            setAmcs(data);
            setFilteredAmcs(data);
        } catch (error) {
            console.error('Failed to fetch AMCs', error);
        }
    };

    const handleSearch = async () => {
        setLoading(true);
        try {
            const { data } = await searchSchemes(searchQuery);

            // If AMC is selected, filter results to only show funds from that AMC
            let filtered = data;
            if (selectedAMC) {
                filtered = data.filter(s => {
                    const schemeLower = s.scheme_name.toLowerCase();
                    const amcLower = selectedAMC.toLowerCase();
                    // Check if scheme name contains the AMC name
                    return schemeLower.includes(amcLower) || schemeLower.startsWith(amcLower);
                });
            }

            setSchemes(filtered);
            if (filtered.length > 0) {
                setIsOpen(true);
            }
        } catch (error) {
            console.error('Search failed', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSchemesByAMC = async () => {
        setLoading(true);
        try {
            const { data } = await getSchemesByAMC(selectedAMC);
            setSchemes(data);
            if (data.length > 0) {
                setIsOpen(true);
            }
        } catch (error) {
            console.error('Failed to fetch schemes', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeLookup = async () => {
        if (!searchQuery || searchQuery.length < 3) {
            setCodeError('Please enter a valid scheme code');
            return;
        }

        setLoading(true);
        setCodeError('');
        try {
            const { data } = await getSchemeByCode(searchQuery);
            onSelect(data);
            setSearchQuery('');
        } catch (error) {
            setCodeError('Scheme code not found. Please check and try again.');
            console.error('Code lookup failed', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (scheme) => {
        onSelect(scheme);
        setSearchQuery('');
        setIsOpen(false);
    };

    const handleAmcSelect = (amc) => {
        setSelectedAMC(amc);
        setAmcQuery(amc);
        setShowAmcDropdown(false);
        setSearchQuery('');
    };

    const handleModeChange = (mode) => {
        setSearchMode(mode);
        setSearchQuery('');
        setSchemes([]);
        setSelectedAMC('');
        setAmcQuery('');
        setIsOpen(false);
        setCodeError('');
    };

    return (
        <div className="space-y-3">
            {/* Mode Selection */}
            <div>
                <label className="text-sm font-medium mb-2 block">Search Method</label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="searchMode"
                            value="amc"
                            checked={searchMode === 'amc'}
                            onChange={() => handleModeChange('amc')}
                            className="w-4 h-4 text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500"
                        />
                        <span className="text-sm">By AMC / Fund Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="searchMode"
                            value="code"
                            checked={searchMode === 'code'}
                            onChange={() => handleModeChange('code')}
                            className="w-4 h-4 text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500"
                        />
                        <span className="text-sm">By Scheme Code</span>
                    </label>
                </div>
            </div>

            {/* AMC Mode */}
            {searchMode === 'amc' && (
                <>
                    {/* AMC Filter - Searchable */}
                    <div className="relative">
                        <label className="text-sm font-medium mb-1 block">Filter by AMC (Optional)</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={amcQuery}
                                onChange={(e) => setAmcQuery(e.target.value)}
                                onFocus={() => setShowAmcDropdown(true)}
                                onBlur={() => setTimeout(() => setShowAmcDropdown(false), 200)}
                                placeholder="Type to search AMC (e.g., HDFC, Aditya Birla)"
                                className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {selectedAMC && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedAMC('');
                                        setAmcQuery('');
                                        setSchemes([]);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* AMC Dropdown */}
                        {showAmcDropdown && filteredAmcs.length > 0 && (
                            <div
                                className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg"
                                onMouseDown={(e) => e.preventDefault()} // Prevent blur on input when clicking dropdown
                            >
                                {filteredAmcs.map((amc) => (
                                    <button
                                        key={amc}
                                        type="button"
                                        onClick={() => handleAmcSelect(amc)}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800 border-b border-slate-800 last:border-0 transition-colors"
                                    >
                                        {amc}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                        <label className="text-sm font-medium mb-1 block">
                            {selectedAMC ? `Search within ${selectedAMC}` : 'Search Fund Name'}
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => schemes.length > 0 && setIsOpen(true)}
                                placeholder={selectedAMC ? "Type any part of fund name (e.g., IDCW, Growth, Regular)" : "Type any part of fund name (e.g., Equity, IDCW)"}
                                className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 pl-10 pr-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {loading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>

                        {/* Dropdown Results */}
                        {isOpen && schemes.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
                                {schemes.map((scheme) => (
                                    <button
                                        key={scheme.scheme_code}
                                        type="button"
                                        onClick={() => handleSelect(scheme)}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800 last:border-0 transition-colors"
                                    >
                                        <div className="text-sm font-medium text-slate-50 line-clamp-2">{scheme.scheme_name}</div>
                                        <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                                            <span>Code: {scheme.scheme_code}</span>
                                            <span className="text-green-500">NAV: ₹{scheme.net_asset_value}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {isOpen && schemes.length === 0 && searchQuery.length >= 2 && !loading && (
                            <div className="absolute z-50 w-full mt-1 rounded-md border border-slate-700 bg-slate-900 shadow-lg p-4 text-center text-slate-400 text-sm">
                                No funds found{selectedAMC ? ` in ${selectedAMC}` : ''}. Try a different search term.
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Code Mode */}
            {searchMode === 'code' && (
                <div>
                    <label className="text-sm font-medium mb-1 block">Enter Scheme Code</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCodeError('');
                            }}
                            onKeyPress={(e) => e.key === 'Enter' && handleCodeLookup()}
                            placeholder="e.g., 100033"
                            className="flex h-10 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="button"
                            onClick={handleCodeLookup}
                            disabled={loading}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Looking up...' : 'Lookup'}
                        </button>
                    </div>
                    {codeError && (
                        <p className="text-xs text-red-400 mt-1">{codeError}</p>
                    )}
                </div>
            )}

            {/* Selected Fund Display */}
            {selectedScheme && (
                <div className="bg-blue-950/30 border border-blue-800 p-3 rounded-md">
                    <div className="text-xs text-blue-400 font-medium mb-1">SELECTED FUND</div>
                    <div className="text-sm font-semibold text-slate-50 line-clamp-2">{selectedScheme.scheme_name}</div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                            <span className="text-slate-400">Code: </span>
                            <span className="text-blue-400 font-mono">{selectedScheme.scheme_code}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-slate-400">NAV: </span>
                            <span className="text-green-500">₹{selectedScheme.net_asset_value}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="text-slate-400">Date: </span>
                            <span className="text-slate-300">{selectedScheme.date}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FundSelector;
