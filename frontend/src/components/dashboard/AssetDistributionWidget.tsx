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
            <div className="p-4 border-b border-slate-50 flex justify-between items-center shrink-0">
                <h3 className="text-[13px] font-extrabold text-[#0B2545] uppercase tracking-[0.2em] flex items-center gap-2">
                    Distribución de Activos
                </h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded tracking-widest uppercase border border-slate-100 shadow-sm">
                    Dinámico
                </span>
            </div>

            <div className="flex flex-col flex-1 bg-white overflow-hidden min-h-0">
                {/* Row 1: Equity & Fixed Income - 50/50 balance */}
                <div className="flex px-8 pt-8 pb-4 border-b border-slate-50 flex-1 min-h-0 gap-8">
                    <div className="flex-1 h-full overflow-hidden pr-4 relative">
                        <EquityDistribution portfolio={portfolio} />
                        {/* Soft divider */}
                        <div className="absolute right-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-slate-100 to-transparent" />
                    </div>
                    <div className="flex-1 h-full overflow-hidden pl-4">
                        <FixedIncomeDistribution portfolio={portfolio} />
                    </div>
                </div>

                {/* Row 2: SmartBars & GeoBars - 50/50 balance */}
                <div className="flex flex-col px-8 pb-6 pt-4 flex-1 min-h-0">
                    <div className="grid grid-cols-2 gap-12 flex-1 min-h-0">
                        <div className="h-full relative flex flex-col justify-center overflow-hidden">
                            <SmartBars allocation={allocData} />
                        </div>
                        <div className="h-full relative flex flex-col justify-center overflow-hidden">
                            <GeoBars allocation={regionAllocation.map(r => ({ label: r.name, value: r.value }))} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
