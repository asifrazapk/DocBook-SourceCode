import { CreditCard, Info } from 'lucide-react'
import { Card, PageHeader, EmptyState } from '../../components/ui/Card'
import { useTheme } from '../../context/ThemeContext'

export default function BillingPage() {
  const { colors } = useTheme()

  return (
    <div className="space-y-5">
      <PageHeader title="Billing" subtitle="Your plan and invoice history." />

      <Card className="flex items-start gap-3 bg-slate-50 border-slate-200">
        <Info size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          Billing isn't connected to a payment provider yet — this page is a placeholder. Nothing here is charged or invoiced for real.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Current plan</p>
            <p className="text-xl font-bold text-slate-900">Free</p>
          </div>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: colors.primary }}
          >
            <CreditCard size={20} />
          </div>
        </div>
      </Card>

      <Card noPad>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-sm">Invoice history</h2>
        </div>
        <EmptyState icon={<CreditCard size={32} />} title="No invoices yet" subtitle="Invoices will appear here once billing is connected." />
      </Card>
    </div>
  )
}
