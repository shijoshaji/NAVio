import { useState, useEffect, useMemo } from 'react';
import { getPortfolio } from '../services/api';
import { RefreshCw, ChevronRight, ChevronDown, Layers, ChevronLeft } from 'lucide-react';

const Holdings = () => {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);

    // Grouping State
    const [groupBy, setGroupBy] = useState('none'); // 'none', 'amc', 'category', 'asset'
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [expandAll, setExpandAll] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Reset pagination when grouping changes
    useEffect(() => {
        setCurrentPage(1);
    }, [groupBy]);

    const fetchPortfolio = async () => {
        try {
            const { data } = await getPortfolio();
            setPortfolio(data);
        } catch (error) {
            console.error("Failed to fetch portfolio", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPortfolio();
    }, []);

    // Effect to handle Expand All toggle
    useEffect(() => {
        if (expandAll && groupedData) {
            setExpandedGroups(new Set(Object.keys(groupedData)));
        } else {
            setExpandedGroups(new Set());
        }
    }, [expandAll]);

    // Derived Data: Grouping Logic
    const groupedData = useMemo(() => {
        if (!portfolio?.holdings || groupBy === 'none') return null;

        const groups = {};

        portfolio.holdings.forEach(item => {
            let key = 'Other';

            // 1. Group By AMC
            if (groupBy === 'amc') {
                let amc = item.fund_house
                    ? item.fund_house.replace(" Mutual Fund", "").trim()
                    : null;

                if (!amc || amc === 'Other') {
                    // Smart Fallback (copied from Dashboard)
                    const name = item.scheme_name || '';
                    const knownAMCs = [
                        'Aditya Birla', 'SBI', 'HDFC', 'ICICI Prudential', 'Axis', 'Kotak', 'Nippon India', 'UTI', 'Bandhan', 'IDFC', 'DSP', 'Mirae Asset', 'Tata', 'HSBC', 'Franklin Templeton', 'Sundaram', 'PGIM India', 'Invesco', 'LIC', 'Union', 'Quant', 'Parag Parikh', 'PPFAS', 'Edelweiss', 'Canara Robeco', 'Bajaj Finserv', 'Mahindra Manulife', '360 ONE', 'Trust', 'WhiteOak', 'Samco', 'Navi', 'Quantum', 'Motilal Oswal', 'Baroda BNP Paribas', 'JM Financial', 'Bank of India', 'Helios', 'Zerodha', 'Groww', 'Old Bridge'
                    ];
                    const matched = knownAMCs.find(k => name.toLowerCase().includes(k.toLowerCase()));
                    amc = matched || (name.includes(' - ') ? name.split(' - ')[0] : name.split(' ')[0]);
                }
                key = amc || 'Other';
            }
            // 2. Group By Category or Asset
            else if (groupBy === 'category' || groupBy === 'asset') {
                const cat = item.category || 'Other';
                let cleanCat = cat.includes('(') ? cat.split('(')[1].split(')')[0].trim() : cat;

                if (groupBy === 'asset') {
                    // Asset Class (Equity, Debt)
                    if (cleanCat.includes(' - ')) key = cleanCat.split(' - ')[0].trim().replace(/ Scheme$/i, '');
                    else key = 'Other';
                } else {
                    // Sub-Category (Large Cap, Liquid)
                    if (cleanCat.includes(' - ')) key = cleanCat.split(' - ').pop().trim().replace(/ Fund$/i, '').replace(/ Scheme$/i, '');
                    else key = cleanCat;
                }
            }

            if (!groups[key]) {
                groups[key] = {
                    items: [],
                    totalInvested: 0,
                    totalCurrent: 0,
                };
            }
            groups[key].items.push(item);
            groups[key].totalInvested += item.invested_amount;
            groups[key].totalCurrent += item.current_value;
        });

        // Sort groups by total current value (descending)
        return Object.fromEntries(
            Object.entries(groups).sort(([, a], [, b]) => b.totalCurrent - a.totalCurrent)
        );
    }, [portfolio, groupBy]);

    // Pagination Logic
    const paginatedData = useMemo(() => {
        let allItems = [];
        if (groupBy === 'none') {
            allItems = portfolio?.holdings || [];
        } else if (groupedData) {
            allItems = Object.entries(groupedData);
        }

        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / rowsPerPage);
        const start = (currentPage - 1) * rowsPerPage;
        const currentItems = allItems.slice(start, start + rowsPerPage);

        return { currentItems, totalItems, totalPages };
    }, [portfolio, groupedData, groupBy, currentPage, rowsPerPage]);

    const toggleGroup = (groupName) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupName)) next.delete(groupName);
            else next.add(groupName);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                    <p className="text-slate-400">Loading Holdings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Holdings</h2>
                    <p className="text-slate-400 mt-1">
                        Detailed view of your current investment portfolio.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Expand All Toggle (Only when grouped) */}
                    {groupBy !== 'none' && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">Expand All</span>
                            <button
                                onClick={() => setExpandAll(!expandAll)}
                                className={`w-9 h-5 rounded-full relative transition-colors ${expandAll ? 'bg-blue-600' : 'bg-slate-700'}`}
                            >
                                <span className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${expandAll ? 'translate-x-4' : ''}`} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 relative">
                        <Layers className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-400">Group by:</span>

                        <div className="relative">
                            <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                                className="flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white transition-colors outline-none"
                            >
                                <span>
                                    {groupBy === 'none' && 'None'}
                                    {groupBy === 'category' && 'Category'}
                                    {groupBy === 'amc' && 'AMC'}
                                    {groupBy === 'asset' && 'Asset Class'}
                                </span>
                                <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {dropdownOpen && (
                                <div className="absolute top-full right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 overflow-hidden">
                                    {[
                                        { label: 'None', value: 'none' },
                                        { label: 'Category', value: 'category' },
                                        { label: 'AMC', value: 'amc' },
                                        { label: 'Asset Class', value: 'asset' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                setGroupBy(opt.value);
                                                setExpandAll(false);
                                                setDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${groupBy === opt.value
                                                ? 'bg-blue-600/10 text-blue-400'
                                                : 'text-slate-200 hover:bg-slate-700'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-50 shadow overflow-hidden flex flex-col">
                <div className="relative w-full overflow-auto flex-1">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b bg-slate-950/50 sticky top-0">
                            <tr className="border-b border-slate-800">
                                <th className="h-12 px-4 text-left align-middle font-medium text-slate-400 w-[40%]">Scheme</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Info</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Invested</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">Current</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-slate-400">XIRR</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {/* FLAT LIST VIEW */}
                            {groupBy === 'none' && paginatedData.currentItems.map((item) => (
                                <Row key={item.scheme_code} item={item} />
                            ))}

                            {/* GROUPED VIEW */}
                            {groupBy !== 'none' && paginatedData.currentItems.map(([groupName, group]) => (
                                <>
                                    {/* Group Header Row */}
                                    <tr
                                        key={`group-${groupName}`}
                                        onClick={() => toggleGroup(groupName)}
                                        className="bg-slate-900/80 cursor-pointer hover:bg-slate-800 border-b border-slate-800 select-none"
                                    >
                                        <td className="p-4 align-middle font-semibold text-blue-400 flex items-center gap-2">
                                            {expandedGroups.has(groupName) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            {groupName}
                                            <span className="text-xs text-slate-500 font-normal ml-2 bg-slate-800 px-2 py-0.5 rounded-full">
                                                {group.items.length} Funds
                                            </span>
                                        </td>
                                        <td className="p-4 align-middle text-right"></td>
                                        <td className="p-4 align-middle text-right font-bold text-slate-300">₹{group.totalInvested.toLocaleString()}</td>
                                        <td className="p-4 align-middle text-right font-bold text-slate-200">₹{group.totalCurrent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className="p-4 align-middle text-right"></td>
                                    </tr>

                                    {/* Child Rows */}
                                    {expandedGroups.has(groupName) && group.items.map(item => (
                                        <Row key={item.scheme_code} item={item} isChild />
                                    ))}
                                </>
                            ))}

                            {(!portfolio?.holdings || portfolio.holdings.length === 0) && (
                                <tr>
                                    <td colSpan={5} className="p-4 text-center text-slate-400">No holdings found. Start investing!</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 bg-slate-950/30">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Rows per page:</span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => {
                                setRowsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded focus:ring-blue-500 focus:border-blue-500 block p-1"
                        >
                            {[5,10, 20, 30, 40].map(pageSize => (
                                <option key={pageSize} value={pageSize}>{pageSize}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400">
                            Page {currentPage} of {paginatedData.totalPages || 1}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1 rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(paginatedData.totalPages, p + 1))}
                                disabled={currentPage === paginatedData.totalPages}
                                className="p-1 rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Reusable Row Component
const Row = ({ item, isChild = false }) => (
    <tr className={`border-b border-slate-800 transition-colors hover:bg-slate-800/50 ${isChild ? 'bg-slate-900/30' : ''}`}>
        <td className={`p-4 align-middle font-medium ${isChild ? 'pl-10 relative' : ''}`}>
            {isChild && (
                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-2 h-px bg-slate-600"></div>
            )}
            <div className="flex flex-col">
                <span>{item.scheme_name}</span>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{item.category || 'N/A'}</span>
                    <span className="text-xs text-slate-500">{item.scheme_code}</span>
                </div>
            </div>
        </td>
        <td className="p-4 align-middle text-right">
            <div className="flex flex-col text-xs text-slate-400">
                <span>Units: {item.total_units.toFixed(2)}</span>
                <span>Avg: ₹{item.average_nav.toFixed(1)}</span>
            </div>
        </td>
        <td className="p-4 align-middle text-right font-medium">₹{item.invested_amount.toLocaleString()}</td>
        <td className="p-4 align-middle text-right font-medium">
            <div>₹{item.current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className={`text-xs ${item.return_percentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {item.return_percentage >= 0 ? '+' : ''}{item.return_percentage.toFixed(1)}%
            </div>
        </td>
        <td className={`p-4 align-middle text-right font-bold ${item.xirr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {item.xirr ? item.xirr.toFixed(2) + '%' : '-'}
        </td>
    </tr>
);

export default Holdings;
