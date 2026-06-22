'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Seat = { id: number; name: string; status: 'AVAILABLE' | 'RESERVED' }

export default function SeatsPage() {
  const router = useRouter()
  const [seats, setSeats] = useState<Seat[]>([])
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function fetchSeats() {
    const res = await fetch('/api/seats')
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    setSeats(data.seats ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchSeats() }, [])

  async function reserve(seatId: number) {
    setError('')
    setReserving(seatId)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to reserve'); return }
      router.push(`/reservations/${data.reservation.id}`)
    } finally {
      setReserving(null)
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading seats…</div>

  return (
    <div className="mx-auto max-w-lg p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Available Seats</h1>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
          Sign out
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="grid gap-4">
        {seats.map((seat) => (
          <div
            key={seat.id}
            className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-medium text-gray-900">{seat.name}</p>
              <p className={`text-sm ${seat.status === 'AVAILABLE' ? 'text-green-600' : 'text-red-500'}`}>
                {seat.status === 'AVAILABLE' ? 'Available' : 'Reserved'}
              </p>
            </div>
            <button
              onClick={() => reserve(seat.id)}
              disabled={seat.status !== 'AVAILABLE' || reserving === seat.id}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reserving === seat.id ? 'Reserving…' : 'Reserve'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
