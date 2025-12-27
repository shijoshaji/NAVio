import { useState, useEffect } from 'react';
import { Plus, Calendar, Trash2, Pencil, Users, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getInvestments, addInvestment, deleteInvestment, updateInvestment, getAccounts } from '../services/api';
import FundSelector from '../components/FundSelector';
import ConfirmModal from '../components/ConfirmModal';
import PrivacyGuard from '../components/PrivacyGuard';

const LumpsumTracker = () => {
    const [investments, setInvestments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [formData, setFormData] = useState({
        amount: '',
        purchase_nav: '',
        purchase_date: new Date().toISOString().split('T')[0],
        account_name: 'Default'
    });

    // Edit/Delete State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const [holdingPeriod, setHoldingPeriod] = useState('');

    const handleHoldingPeriodChange = (e) => {
        setHoldingPeriod(e.target.value);
    };

    const getRedemptionDate = () => {
        if (!formData.purchase_date || !holdingPeriod) return null;
        try {
            const date = new Date(formData.purchase_date);
            const years = parseFloat(holdingPeriod);
            if (isNaN(years)) return null;

            // Add years
            const millisecondsPerYear = 1000 * 60 * 60 * 24 * 365.25;
            const targetTime = date.getTime() + (years * millisecondsPerYear);
            return new Date(targetTime).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
        } catch (e) {
            return null;
        }
    };

    const fetchInvestments = async () => {
        try {
            const { data } = await getInvestments('LUMPSUM', true); // activeOnly=true to hide sold schemes
            setInvestments(data);
        } catch (error) {
            console.error("Failed to fetch Lumpsum investments", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvestments();
        getAccounts().then(({ data }) => setAccounts(data)).catch(err => console.error("Failed to fetch accounts", err));
    }, []);

    const handleSchemeSelect = (scheme) => {
        setSelectedScheme(scheme);
        setFormData({
            ...formData,
            purchase_nav: scheme.net_asset_value.toString()
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedScheme) {
            toast.error("Please select a fund");
            return;
        }

        try {
            const payload = {
                scheme_code: selectedScheme.scheme_code,
                type: 'LUMPSUM',
                holding_period: holdingPeriod ? parseFloat(holdingPeriod) : null,
                ...formData
            };

            if (isEditMode) {
                await updateInvestment(editingId, payload);
                toast.success("Investment updated successfully");
                setIsEditMode(false);
                setEditingId(null);
            } else {
                await addInvestment(payload);
                toast.success("Investment added successfully");
            }

            // Reset Form
            setFormData({
                amount: '',
                purchase_nav: '',
                purchase_date: new Date().toISOString().split('T')[0],
                account_name: 'Default'
            });
            setHoldingPeriod('');
            setSelectedScheme(null);
            fetchInvestments();
            // Refresh accounts list
            getAccounts().then(({ data }) => setAccounts(data));
        } catch (error) {
            console.error("Failed to save Investment", error);
            toast.error(isEditMode ? "Failed to update Investment" : "Failed to add Investment");
        }
    };

    const handleEdit = (inv) => {
        setIsEditMode(true);
        setEditingId(inv.id);

        setFormData({
            amount: inv.amount,
            purchase_nav: inv.purchase_nav,
            purchase_date: inv.purchase_date,
            account_name: inv.account_name || 'Default'
        });
        setHoldingPeriod(inv.holding_period || '');

        setSelectedScheme({
            scheme_code: inv.scheme_code,
            scheme_name: inv.scheme?.scheme_name || inv.scheme_code,
            net_asset_value: inv.purchase_nav
        });
    };

    const initiateDelete = (inv) => {
        setItemToDelete(inv);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteInvestment(itemToDelete.id);
            toast.success("Investment deleted");
            fetchInvestments();
        } catch (error) {
            console.error("Failed to delete", error);
            toast.error("Failed to delete investment");
        } finally {
            setDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const cancelEdit = () => {
        setIsEditMode(false);
        setEditingId(null);
        setFormData({
            amount: '',
            purchase_nav: '',
            purchase_date: new Date().toISOString().split('T')[0],
            account_name: 'Default'
        });
        setHoldingPeriod('');
        setSelectedScheme(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Lumpsum Tracker</h2>
            </div>

            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Investment"
                message="Are you sure you want to delete this investment? This will recalculate your portfolio average NAV."
                confirmText="Delete"
                isDanger={true}
            />

            <div className="grid gap-6 md:grid-cols-2">
                {/* Add/Edit Form */}
                <div className="bg-slate-900 text-slate-50 rounded-lg border border-slate-800 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">{isEditMode ? 'Edit Lumpsum' : 'Add New Lumpsum'}</h3>
                        {isEditMode && (
                            <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-white">Cancel</button>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <FundSelector
                            onSelect={handleSchemeSelect}
                            selectedScheme={selectedScheme}
                        />

                        <div>
                            <label className="text-sm font-medium">Account</label>
                            <div className="relative mt-1">
                                <Users className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 z-10" />
                                <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-slate-500 pointer-events-none z-10" />
                                <select
                                    className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 pl-10 pr-10 py-2 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none relative"
                                    value={formData.account_name}
                                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                                >
                                    <option value="Default">Default</option>
                                    {accounts.map(acc => {
                                        const val = typeof acc === 'object' ? acc.name : acc;
                                        if (val === 'Default') return null;
                                        return <option key={val} value={val}>{val}</option>;
                                    })}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Investment Amount (₹)</label>
                            <input
                                type="number"
                                required
                                className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Avg Purchased NAV</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    required
                                    className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                                    placeholder="0.0000"
                                    value={formData.purchase_nav}
                                    onChange={(e) => setFormData({ ...formData, purchase_nav: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Last invested date</label>
                                <input
                                    type="date"
                                    required
                                    className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                                    value={formData.purchase_date}
                                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Holding Period (Years)</label>
                            <input
                                type="number"
                                step="0.1"
                                className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                                placeholder="Enter years to auto-calculate date"
                                value={holdingPeriod}
                                onChange={handleHoldingPeriodChange}
                            />
                            {getRedemptionDate() && (
                                <p className="text-xs text-emerald-400 mt-1">
                                    Planned Redemption: {getRedemptionDate()}
                                </p>
                            )}
                        </div>
                        <button
                            type="submit"
                            className={`inline-flex items-center justify-center rounded-md text-sm font-medium text-white h-10 px-4 py-2 w-full transition-colors ${isEditMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                        >
                            {isEditMode ? (
                                <>Update Investment</>
                            ) : (
                                <><Plus className="mr-2 h-4 w-4" /> Add Investment</>
                            )}
                        </button>
                    </form>
                </div>

                {/* Recent Investments List */}
                <div className="bg-slate-900 text-slate-50 rounded-lg border border-slate-800 shadow-sm p-6 overflow-hidden flex flex-col">
                    <h3 className="text-lg font-semibold mb-4">Recent History</h3>
                    <div className="overflow-y-auto flex-1 max-h-[600px]">
                        {investments.length === 0 ? (
                            <div className="text-slate-400 text-center py-10">No Lumpsum investments found.</div>
                        ) : (
                            <div className="space-y-4">
                                {investments.map((inv) => (
                                    <div key={inv.id} className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${editingId === inv.id ? 'border-amber-500 bg-amber-900/10' : 'border-slate-800 hover:bg-slate-800/50'
                                        }`}>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none truncate max-w-[200px]" title={inv.scheme?.scheme_name || inv.scheme_code}>
                                                {inv.scheme?.scheme_name || inv.scheme_code}
                                            </p>
                                            <p className="text-xs text-slate-400 flex items-center gap-3">
                                                <span className="flex items-center"><Calendar className="mr-1 h-3 w-3" /> <PrivacyGuard>{inv.purchase_date}</PrivacyGuard></span>
                                                <span className="flex items-center text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-800"><Users className="mr-1 h-3 w-3" /> <PrivacyGuard>{inv.account_name || 'Default'}</PrivacyGuard></span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-sm font-bold"><PrivacyGuard>₹{inv.amount.toLocaleString()}</PrivacyGuard></p>
                                                <p className="text-xs text-slate-400">
                                                    <PrivacyGuard>{inv.units.toFixed(3)} units</PrivacyGuard> @ <PrivacyGuard>₹{inv.purchase_nav}</PrivacyGuard>
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleEdit(inv)}
                                                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => initiateDelete(inv)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LumpsumTracker;
