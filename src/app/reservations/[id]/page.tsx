'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'

type Reservation = {
  id: number
  seatId: number
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'EXPIRED'
  paymentAttemptCount: number
  expiresAt: string
}

type Payment = { id: number; status: 'PENDING' | 'SUCCESS' | 'FAILED'; idempotencyKey: string }

export default function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [lastPayment, setLastPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [message, setMessage] = useState('')

  async function fetchReservation() {
    const res = await fetch(`/api/reservations/${id}`)
    if (res.status === 401) { router.push('/login'); return }
    if (!res.ok) { router.push('/seats'); return }
    const data = await res.json()
    setReservation(data.reservation)
    setLoading(false)
  }

  useEffect(() => { fetchReservation() }, [id])

  async function pay() {
    if (!reservation) return
    setPaying(true)
    setMessage('')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const res = await fetch(`/api/payments/${reservation.id}`, { method: 'POST', headers })
      const data = await res.json()
      if (!res.ok) { setMessage(data.error ?? 'Payment failed'); return }
      setLastPayment(data.payment)
      setReservation(data.reservation)
      if (data.payment.status === 'FAILED') {
        setMessage('Payment failed. Please retry.')
      } else {
        setMessage('Payment successful! Your seat is confirmed.')
      }
    } finally {
      setPaying(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading…</div>
  if (!reservation) return null

  const isExpired = reservation.status === 'EXPIRED'
  const isConfirmed = reservation.status === 'CONFIRMED'
  const expiresAt = new Date(reservation.expiresAt)

  return (
    <div className="mx-auto max-w-md p-8">
      <button onClick={() => router.push('/seats')} className="mb-6 text-sm text-blue-600 hover:underline">
        ← Back to seats
      </button>
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-bold text-gray-900">Reservation #{reservation.id}</h1>
        <dl className="mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Status</dt>
            <dd className={`font-medium ${isConfirmed ? 'text-green-600' : isExpired ? 'text-red-500' : 'text-yellow-600'}`}>
              {reservation.status}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Expires at</dt>
            <dd className="text-gray-900">{expiresAt.toLocaleTimeString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Payment attempts</dt>
            <dd className="text-gray-900">{reservation.paymentAttemptCount}</dd>
          </div>
        </dl>

        {message && (
          <p className={`mb-4 rounded p-2 text-sm ${lastPayment?.status === 'SUCCESS' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </p>
        )}

        {!isConfirmed && !isExpired && (
          <button
            onClick={pay}
            disabled={paying}
            className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {paying ? 'Processing…' : reservation.paymentAttemptCount === 0 ? 'Pay now' : 'Retry payment'}
          </button>
        )}
      </div>
    </div>
  )
}
