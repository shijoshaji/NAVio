import React, { useState, useEffect } from 'react';
import { X, Calendar, IndianRupee, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const RedeemModal = ({ isOpen, onClose, onRedeem, holding, loading }) => {
    const [units, setUnits] = useState('');
    const [nav, setNav] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [remarks, setRemarks] = useState('');
    const [redeemAll, setRedeemAll] = useState(false);

    useEffect(() => {
        if (holding) {
            setNav(holding.current_nav);
            setUnits(''); // Reset units
            setRemarks('');
            setRedeemAll(false);
        }
    }, [holding]);

    useEffect(() => {
        if (redeemAll && holding) {
            setUnits(holding.total_units.toString());
        }
    }, [redeemAll, holding]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const unitsNum = parseFloat(units);
        const navNum = parseFloat(nav);

        if (!unitsNum || unitsNum <= 0) {
            toast.error('Please enter valid units');
            return;
        }
        if (unitsNum > holding.total_units) {
            toast.error(`Cannot redeem more than available units (${holding.total_units.toFixed(4)})`);
            return;
        }

        onRedeem({
            scheme_code: holding.scheme_code,
            units: unitsNum,
            nav: navNum,
            date: date,
            remarks: remarks,
            account_name: holding.account_name
        });
    };

    if (!isOpen || !holding) return null;

    const estimatedValue = (parseFloat(units) || 0) * (parseFloat(nav) || 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-semibold text-slate-100">Redeem / Sell Units</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">Scheme</label>
                        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-slate-200 text-sm font-medium truncate">
                            {holding.scheme_name}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400 flex justify-between items-center">
                                Units to Redeem
                            </label>
                            <input
                                type="number"
                                step="0.0001"
                                value={units}
                                onChange={(e) => setUnits(e.target.value)}
                                disabled={redeemAll}
                                className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono ${redeemAll ? 'opacity-50 cursor-not-allowed' : ''}`}
                                placeholder={`Max: ${holding.total_units.toFixed(4)}`}
                                required
                            />
                            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                                <span>Available: {holding.total_units.toFixed(4)}</span>
                                <label className="flex items-center gap-1 cursor-pointer hover:text-blue-400 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={redeemAll}
                                        onChange={(e) => setRedeemAll(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/50 h-3 w-3"
                                    />
                                    <span>Redeem All</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400">NAV</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={nav}
                                onChange={(e) => setNav(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">Redemption Date</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                required
                            />
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-center justify-between">
                        <span className="text-xs text-blue-300 font-medium">Estimated Value</span>
                        <span className="text-lg font-bold text-blue-400 flex items-center gap-1">
                            <IndianRupee className="h-4 w-4" />
                            {estimatedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></span>
                            ) : 'Redeem Units'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RedeemModal;
