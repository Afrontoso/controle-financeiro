"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void; // Apenas para recarregar a tela após salvar 
}

export default function TransactionModal({ isOpen, onClose, onSave }: TransactionModalProps) {
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState("Diário");
    const [type, setType] = useState<"entrada" | "saida">("saida");
    const [isForecast, setIsForecast] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Data atual no formato YYYY-MM-DD
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const value = type === "saida" ? -Math.abs(Number(amount)) : Math.abs(Number(amount));

            await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    description,
                    amount: value,
                    category,
                    isForecast,
                    date: new Date(date).toISOString(),
                }),
            });

            // Limpar form
            setDescription("");
            setAmount("");
            onSave(); // Trigger pra recarregar dados
            onClose();
        } catch (error) {
            console.error("Erro ao salvar", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-5 border-b border-neutral-100">
                    <h2 className="text-xl font-bold text-neutral-800">Nova Transação</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Tipo */}
                    <div className="flex bg-neutral-100 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setType("saida")}
                            className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${type === "saida"
                                    ? "bg-white text-red-600 shadow-sm"
                                    : "text-neutral-500 hover:text-neutral-700"
                                }`}
                        >
                            Saída
                        </button>
                        <button
                            type="button"
                            onClick={() => setType("entrada")}
                            className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${type === "entrada"
                                    ? "bg-white text-green-600 shadow-sm"
                                    : "text-neutral-500 hover:text-neutral-700"
                                }`}
                        >
                            Entrada
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Data
                            </label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-neutral-50 border border-neutral-300 text-neutral-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Descrição
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Ex: Almoço"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-neutral-50 border border-neutral-300 text-neutral-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
                            />
                        </div>

                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Valor (R$)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    placeholder="0,00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-neutral-50 border border-neutral-300 text-neutral-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
                                />
                            </div>

                            <div className="w-1/3">
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Categoria
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full bg-neutral-50 border border-neutral-300 text-neutral-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none transition-colors"
                                >
                                    <option value="Diário">Diário</option>
                                    <option value="Fixo">Fixo</option>
                                    <option value="Lazer">Lazer</option>
                                    <option value="Economias">Economias</option>
                                </select>
                            </div>
                        </div>

                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isForecast}
                                onChange={(e) => setIsForecast(e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-neutral-100 border-neutral-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-neutral-700">
                                É uma previsão (planejamento futuro)?
                            </span>
                        </label>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-3 text-center transition-colors disabled:opacity-70"
                        >
                            {loading ? "Salvando..." : "Salvar Transação"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
