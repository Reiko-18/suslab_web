import { useState, useEffect } from 'react'
import type { AxiosResponse } from 'axios'
import api from '../services/api'

interface UseFetchResult<T> {
  data: T | null
  loading: boolean
  error: unknown
}

function useFetch<T = unknown>(url: string): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        setLoading(true)
        const response: AxiosResponse<T> = await api.get<T>(url)
        if (!cancelled) setData(response.data)
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [url])

  return { data, loading, error }
}

export default useFetch
