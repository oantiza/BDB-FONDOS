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
                <h3 className="text-sm font-extrabold text-[#0B2545] uppercase tracking-[0.2em]">
                    Distribución de Activos
                </h3>
                <span className="text-[8px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded tracking-wide uppercase">
                    Dinámico
                </span>
            </div>

            <div className="flex flex-col flex-1 bg-white overflow-hidden min-h-0">
                {/* Row 1: Equity & Fixed Income - Moderate prominence */}
                <div className="flex px-4 pt-8 pb-3 border-b border-slate-50 flex-[1.25] min-h-0">
                    <div className="flex-1 h-full overflow-hidden pr-4 border-r border-slate-100">
                        <EquityDistribution portfolio={portfolio} />
                    </div>
                    <div className="flex-1 h-full overflow-hidden pl-4">
                        <FixedIncomeDistribution portfolio={portfolio} />
                    </div>
                </div>

                {/* Row 2: SmartBars & GeoBars - Better balance */}
                <div className="flex flex-col px-3 pb-2 min-h-0 flex-[0.75]">
                    <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                        <div className="h-full relative flex flex-col items-center justify-center overflow-hidden">
                            <SmartBars allocation={allocData} />
                        </div>
                        <div className="h-full relative flex flex-col items-center justify-center overflow-hidden">
                            <GeoBars allocation={regionAllocation.map(r => ({ label: r.name, value: r.value }))} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
