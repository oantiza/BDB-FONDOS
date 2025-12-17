import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, MinusCircle } from 'lucide-react';

const PortfolioTable = ({ portfolio }) => {
  if (!portfolio) return <div className="p-4 text-center text-gray-500">Datos de cartera no disponibles.</div>;

  const totalWeight = portfolio.reduce((acc, item) => acc + item.weight, 0);

  const getViewIcon = (view) => {
    if (view.toLowerCase().includes("sobre")) return <ArrowUpCircle className="text-green-600 inline" size={16} />;
    if (view.toLowerCase().includes("infra")) return <ArrowDownCircle className="text-red-600 inline" size={16} />;
    return <MinusCircle className="text-gray-400 inline" size={16} />;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-bold text-slate-700">Asignación Táctica de Activos</h3>
        <span className={`text-xs font-mono px-2 py-1 rounded ${Math.abs(totalWeight - 100) < 1 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          Total: {totalWeight}%
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-3">Activo</th>
              <th className="px-6 py-3">Región</th>
              <th className="px-6 py-3 text-center">Visión</th>
              <th className="px-6 py-3 text-right">Peso</th>
              <th className="px-6 py-3 w-1/3">Racional</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {portfolio.map((item, index) => (
              <tr key={index} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3 font-medium text-slate-800">{item.asset_class}</td>
                <td className="px-6 py-3 text-slate-600">{item.region}</td>
                <td className="px-6 py-3 text-center gap-2">
                  {getViewIcon(item.view)} <span className="text-xs ml-1">{item.view}</span>
                </td>
                <td className="px-6 py-3 text-right font-bold text-slate-800">{item.weight}%</td>
                <td className="px-6 py-3 text-slate-500 text-xs italic">{item.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortfolioTable;