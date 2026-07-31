import Modal from './Modal'
import Button from './Button'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel, loading }: Props) {
  return (
    <Modal open={open} title={title} onClose={onCancel} width="sm" footer={
      <>
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>
    }>
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  )
}
