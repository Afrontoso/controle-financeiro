"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (monthlyBudget: number) => void;
    currentBudget: number;
}

export default function SettingsModal({
    isOpen,
    onClose,
    onSave,
    currentBudget,
}: SettingsModalProps) {
    const [budget, setBudget] = useState(currentBudget.toString());

    // Atualiza states internos quando as props vierem corretas de tela pro modal
    useEffect(() => {
        setBudget(currentBudget.toString());
    }, [currentBudget, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(Number(budget) || 0);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-5 border-b border-neutral-100">
                    <h2 className="text-xl font-bold text-neutral-800">Cofigurações Iniciais</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Teto de Gastos Mensal (Gasto Livre / Diário)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                className="w-full bg-neutral-50 border border-neutral-300 text-neutral-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
                            />
                        </div>
                    </div>
                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-3 text-center transition-colors"
                        >
                            Salvar e Recalcular
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
