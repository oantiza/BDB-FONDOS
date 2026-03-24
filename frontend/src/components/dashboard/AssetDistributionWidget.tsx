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
            <div className="h-[45px] px-4 bg-[#F8FAFC] border-b border-slate-200/60 flex justify-between items-center z-10">
                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                    Distribución de Activos
                </h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded tracking-widest uppercase border border-slate-100 shadow-sm">
                    Dinámico
                </span>
            </div>

            <div className="flex flex-col flex-1 bg-white overflow-hidden min-h-0">
                {/* Row 1: Equity & Fixed Income (40% height) */}
                <div className="flex px-6 py-4 border-b border-slate-50 flex-[2] min-h-0 gap-6">
                    <div className="flex-1 h-full overflow-hidden pr-6 border-r border-slate-100 flex flex-col justify-center">
                        <EquityDistribution portfolio={portfolio} />
                        {/* Soft divider */}
                        <div className="absolute right-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-slate-100 to-transparent" />
                    </div>
                    <div className="flex-1 h-full overflow-hidden flex flex-col justify-center">
                        <FixedIncomeDistribution portfolio={portfolio} />
                    </div>
                </div>

                {/* Row 2: Activos & Región (60% height) */}
                <div className="flex px-6 py-5 flex-[3] min-h-0 gap-6">
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
