import { useState, useCallback, useRef } from 'react'
import { AXIOS_INSTANCE, getGlobalToken } from '../api/mutator'

interface SSEOptions {
  onToken?: (token: string) => void
  onDone?: (data?: any) => void
  onError?: (error: string) => void
}

/**
 * Hook for SSE (Server-Sent Events) streaming from POST endpoints.
 * Used for draft streaming, chat, and edit suggestions.
 */
export const useSSE = () => {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const startStream = useCallback(
    async (url: string, body: Record<string, unknown>, options?: SSEOptions) => {
      setIsStreaming(true)
      setStreamedText('')
      let accumulated = ''

      abortRef.current = new AbortController()

      try {
        const token = getGlobalToken()
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(
          `${AXIOS_INSTANCE.defaults.baseURL}${url}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: abortRef.current.signal,
          },
        )

        if (!response.ok) {
          const errorText = await response.text().catch(() => '')
          let message = `HTTP ${response.status}`
          try {
            const parsed = JSON.parse(errorText)
            message = parsed.message || parsed.error || message
          } catch {
            if (errorText) message = errorText
          }
          options?.onError?.(message)
          return
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'delta') {
                accumulated += data.text
                setStreamedText(accumulated)
                options?.onToken?.(data.text)
              } else if (data.type === 'done') {
                options?.onDone?.(data)
              } else if (data.type === 'error') {
                options?.onError?.(data.message)
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          options?.onError?.(err.message)
        }
      } finally {
        setIsStreaming(false)
      }
    },
    [],
  )

  const stopStream = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { startStream, stopStream, isStreaming, streamedText }
}
