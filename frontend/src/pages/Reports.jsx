import { useState, useEffect, useMemo } from 'react';
import { getPortfolio } from '../services/api';
import { ArrowUp, ArrowDown, RefreshCw, FileText } from 'lucide-react';
import PrivacyGuard from '../components/PrivacyGuard';

const Reports = () => {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPortfolio();
    }, []);

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

    // Helper: Calculate Financial Year
    const getFinancialYear = (dateString) => {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const month = date.getMonth(); // 0-11
        const year = date.getFullYear();

        let fyStart = year;
        if (month < 3) fyStart = year - 1;

        const fyEnd = (fyStart + 1).toString().slice(-2);
        return `FY ${fyStart}-${fyEnd}`;
    };

    const reportData = useMemo(() => {
        if (!portfolio?.holdings) return [];

        const fyMap = {};

        portfolio.holdings.forEach(item => {
            // Consider only items with realized P&L or sold history
            if (item.realized_pnl !== 0 || item.total_units_sold > 0) {
                const fy = getFinancialYear(item.last_sell_date || item.purchase_date); // Fallback to purchase if distinct sell date missing? rare. items with realized pnl should have sell date.

                if (!fyMap[fy]) {
                    fyMap[fy] = {
                        fy,
                        shortTerm: 0,
                        longTerm: 0,
                        total: 0,
                        invested: 0,
                        exited: 0
                    };
                }

                const pnl = item.realized_pnl || 0;
                const exitValue = item.realized_value || 0;
                // Cost of Sold = Exit Value - P&L
                const investedValue = exitValue - pnl;

                fyMap[fy].total += pnl;
                fyMap[fy].exited += exitValue;
                fyMap[fy].invested += investedValue;

                if (item.tax_status === 'Long Term') {
                    fyMap[fy].longTerm += pnl;
                } else {
                    // Default to Short Term if not explicitly Long Term
                    fyMap[fy].shortTerm += pnl;
                }
            }
        });

        // Convert to array and sort by FY descending (approx string sort works for FY YYYY)
        return Object.values(fyMap).sort((a, b) => b.fy.localeCompare(a.fy));
    }, [portfolio]);

    const grandTotals = useMemo(() => {
        return reportData.reduce((acc, curr) => ({
            shortTerm: acc.shortTerm + curr.shortTerm,
            longTerm: acc.longTerm + curr.longTerm,
            total: acc.total + curr.total,
            invested: acc.invested + curr.invested,
            exited: acc.exited + curr.exited
        }), { shortTerm: 0, longTerm: 0, total: 0, invested: 0, exited: 0 });
    }, [reportData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <FileText className="h-6 w-6 text-blue-400" />
                        Capital Gains Report
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Realized Profit & Loss aggregated by Financial Year
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-950 text-slate-400 font-medium border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-4">Financial Year</th>
                            <th className="px-6 py-4 text-right">Total Invested</th>
                            <th className="px-6 py-4 text-right">Total Exited</th>
                            <th className="px-6 py-4 text-right">Short Term P&L</th>
                            <th className="px-6 py-4 text-right">Long Term P&L</th>
                            <th className="px-6 py-4 text-right">Total Realized P&L</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {reportData.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    No realized gains/losses found.
                                </td>
                            </tr>
                        ) : (
                            reportData.map((row) => (
                                <tr key={row.fy} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-200">
                                        {row.fy}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-400">
                                        <PrivacyGuard>₹{row.invested.toLocaleString()}</PrivacyGuard>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-blue-300">
                                        <PrivacyGuard>₹{row.exited.toLocaleString()}</PrivacyGuard>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-medium ${row.shortTerm >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        <PrivacyGuard>
                                            {row.shortTerm >= 0 ? '+' : ''}₹{row.shortTerm.toLocaleString()}
                                        </PrivacyGuard>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-medium ${row.longTerm >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        <PrivacyGuard>
                                            {row.longTerm >= 0 ? '+' : ''}₹{row.longTerm.toLocaleString()}
                                        </PrivacyGuard>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold text-base ${row.total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        <PrivacyGuard>
                                            {row.total >= 0 ? '+' : ''}₹{row.total.toLocaleString()}
                                        </PrivacyGuard>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {/* Cumulative Footer */}
                    {reportData.length > 0 && (
                        <tfoot className="bg-slate-950/50 font-bold border-t-2 border-slate-800">
                            <tr>
                                <td className="px-6 py-4 text-slate-100">Cumulative Total</td>
                                <td className="px-6 py-4 text-right text-slate-400 font-mono">
                                    <PrivacyGuard>₹{grandTotals.invested.toLocaleString()}</PrivacyGuard>
                                </td>
                                <td className="px-6 py-4 text-right text-blue-300 font-mono">
                                    <PrivacyGuard>₹{grandTotals.exited.toLocaleString()}</PrivacyGuard>
                                </td>
                                <td className={`px-6 py-4 text-right ${grandTotals.shortTerm >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    <PrivacyGuard>
                                        {grandTotals.shortTerm >= 0 ? '+' : ''}₹{grandTotals.shortTerm.toLocaleString()}
                                    </PrivacyGuard>
                                </td>
                                <td className={`px-6 py-4 text-right ${grandTotals.longTerm >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    <PrivacyGuard>
                                        {grandTotals.longTerm >= 0 ? '+' : ''}₹{grandTotals.longTerm.toLocaleString()}
                                    </PrivacyGuard>
                                </td>
                                <td className={`px-6 py-4 text-right text-lg ${grandTotals.total >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    <PrivacyGuard>
                                        {grandTotals.total >= 0 ? '+' : ''}₹{grandTotals.total.toLocaleString()}
                                    </PrivacyGuard>
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            <div className="text-xs text-slate-500 italic mt-4">
                * Based on data currently available in the system. Ensure all NAVs and transactions are synced.
            </div>
        </div>
    );
};

export default Reports;
