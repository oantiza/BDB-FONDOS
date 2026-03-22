import EquityDistribution from './EquityDistribution'
import FixedIncomeDistribution from './FixedIncomeDistribution'
import SmartBars from './SmartBars'
import GeoBars from './GeoBars'

interface AllocationItem { label: string; value: number }
interface RegionItem { name: string; value: number }

interface Props {
    portfolio: any[]
    allocData: AllocationItem[]
    regionAllocation: RegionItem[]
}

export default function AssetDistributionWidget({ portfolio, allocData, regionAllocation }: Props) {
    return (
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm flex flex-col shrink-0 h-full group hover:border-slate-200 transition-colors overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3.5 bg-[#F8FAFC] border-b border-slate-200/60 flex justify-between items-center shrink-0">
                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.15em]">
                    Distribución de Activos
                </h3>
                <span className="text-[8px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded tracking-wide uppercase">
                    Dinámico
                </span>
            </div>

            <div className="flex flex-col flex-1 bg-white overflow-hidden min-h-0">
                {/* Row 1: Equity & Fixed Income */}
                <div className="flex px-6 py-6 border-b border-slate-50 flex-1 min-h-0 gap-6">
                    <div className="flex-1 h-full overflow-hidden pr-6 border-r border-slate-100 flex flex-col justify-center">
                        <EquityDistribution portfolio={portfolio} />
                    </div>
                    <div className="flex-1 h-full overflow-hidden flex flex-col justify-center">
                        <FixedIncomeDistribution portfolio={portfolio} />
                    </div>
                </div>

                {/* Row 2: Activos & Región */}
                <div className="flex px-6 py-6 flex-1 min-h-0 gap-6">
                    <div className="flex-1 h-full relative overflow-hidden pr-6 border-r border-slate-100 flex flex-col justify-center">
                        <SmartBars allocation={allocData} />
                    </div>
                    <div className="flex-1 h-full relative overflow-hidden flex flex-col justify-center">
                        <GeoBars allocation={regionAllocation.map(r => ({ label: r.name, value: r.value }))} />
                    </div>
                </div>
            </div>
        </div>
    )
}
