import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, HelpCircle } from 'lucide-react'
import { useClinic } from '../../context/ClinicContext'
import { getFAQs, createFAQ, updateFAQ, deleteFAQ, type FAQ } from '../../services/api'
import { Card, PageHeader, EmptyState, Spinner } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'

export default function FaqsPage() {
  const { clinicId } = useClinic()
  const toast = useToast()
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<FAQ | 'new' | null>(null)
  const [deleting, setDeleting] = useState<FAQ | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = () => {
    if (!clinicId) return
    setLoading(true)
    getFAQs(clinicId).then((r) => setFaqs(r.data)).finally(() => setLoading(false))
  }

  useEffect(load, [clinicId])

  const doDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await deleteFAQ(deleting.id)
      setFaqs((prev) => prev.filter((f) => f.id !== deleting.id))
      toast.show('FAQ removed.')
    } catch {
      toast.show('Could not remove this FAQ.', 'error')
    } finally {
      setDeleteLoading(false)
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="FAQs"
        subtitle="Answers the chatbot gives for common patient questions, in English and Urdu."
        action={
          <Button icon={<Plus size={15} />} onClick={() => setEditing('new')}>
            Add FAQ
          </Button>
        }
      />

      <Card noPad>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : faqs.length === 0 ? (
          <EmptyState icon={<HelpCircle size={36} />} title="No FAQs yet" subtitle="Add your first FAQ so the chatbot can answer it." />
        ) : (
          <div className="divide-y divide-slate-100">
            {faqs.map((f) => (
              <div key={f.id} className="flex items-start justify-between px-5 py-4 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{f.question_en}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{f.answer_en}</p>
                  {f.category && (
                    <span className="inline-block mt-2 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {f.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(f)} />
                  <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} className="text-rose-500" onClick={() => setDeleting(f)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && clinicId && (
        <FaqFormModal
          clinicId={clinicId}
          faq={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(f) => {
            setFaqs((prev) => (editing === 'new' ? [...prev, f] : prev.map((x) => (x.id === f.id ? f : x))))
            setEditing(null)
            toast.show(editing === 'new' ? 'FAQ added.' : 'FAQ updated.')
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Remove FAQ"
        message="Remove this FAQ? The chatbot will no longer be able to answer it."
        confirmLabel="Remove"
        onConfirm={doDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteLoading}
      />
    </div>
  )
}

function FaqFormModal({
  clinicId,
  faq,
  onClose,
  onSaved,
}: {
  clinicId: number
  faq: FAQ | null
  onClose: () => void
  onSaved: (f: FAQ) => void
}) {
  const toast = useToast()
  const [questionEn, setQuestionEn] = useState(faq?.question_en ?? '')
  const [answerEn, setAnswerEn] = useState(faq?.answer_en ?? '')
  const [category, setCategory] = useState(faq?.category ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!questionEn.trim() || !answerEn.trim()) {
      setError('Question and answer are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (faq) {
        const res = await updateFAQ(faq.id, {
          question_en: questionEn,
          answer_en: answerEn,
          category: category || null,
        })
        onSaved(res.data)
      } else {
        const res = await createFAQ({
          clinic_id: clinicId,
          question_en: questionEn,
          question_ur: null,
          answer_en: answerEn,
          answer_ur: null,
          category: category || null,
        })
        onSaved(res.data)
      }
    } catch {
      setError('Could not save this FAQ.')
      toast.show('Save failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={faq ? 'Edit FAQ' : 'Add FAQ'}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={submitting}>{faq ? 'Save changes' : 'Add FAQ'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        <Field label="Question" required>
          <Input value={questionEn} onChange={(e) => setQuestionEn(e.target.value)} />
        </Field>
        <Field label="Answer" required>
          <Textarea rows={3} value={answerEn} onChange={(e) => setAnswerEn(e.target.value)} />
        </Field>
        <Field label="Category">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="general, billing, appointments…" />
        </Field>
      </div>
    </Modal>
  )
}
