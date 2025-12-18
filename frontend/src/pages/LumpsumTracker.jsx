import { useState, useEffect } from 'react';
import { Plus, Calendar, Trash2, Pencil } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getInvestments, addInvestment, deleteInvestment, updateInvestment } from '../services/api';
import FundSelector from '../components/FundSelector';
import ConfirmModal from '../components/ConfirmModal';

const LumpsumTracker = () => {
    const [investments, setInvestments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedScheme, setSelectedScheme] = useState(null);
    const [formData, setFormData] = useState({
        amount: '',
        purchase_nav: '',
        purchase_date: new Date().toISOString().split('T')[0]
    });

    // Edit/Delete State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);

    const fetchInvestments = async () => {
        try {
            const { data } = await getInvestments('LUMPSUM');
            setInvestments(data);
        } catch (error) {
            console.error("Failed to fetch Lumpsum investments", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvestments();
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
                purchase_date: new Date().toISOString().split('T')[0]
            });
            setSelectedScheme(null);
            fetchInvestments();
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
            purchase_date: inv.purchase_date
        });

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
            purchase_date: new Date().toISOString().split('T')[0]
        });
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
                            <label className="text-sm font-medium">Amount (₹)</label>
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
                                <label className="text-sm font-medium">Purchase NAV</label>
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
                                <label className="text-sm font-medium">Date</label>
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
                                            <p className="text-xs text-slate-400 flex items-center">
                                                <Calendar className="mr-1 h-3 w-3" />
                                                {inv.purchase_date}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-sm font-bold">₹{inv.amount.toLocaleString()}</p>
                                                <p className="text-xs text-slate-400">{inv.units.toFixed(3)} units @ ₹{inv.purchase_nav}</p>
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
