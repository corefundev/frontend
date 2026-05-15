/**
 * PjaxLoader — thin horizontal progress bar fixed to viewport top, in the
 * spirit of GitHub's `progress-pjax-loader` (and nprogress).
 *
 * Triggers:
 *   • route changes (useLocation pathname diff)
 *   • react-query background fetches (useIsFetching > 0)
 *   • react-query mutations (useIsMutating > 0) — uploads, training kicks, etc.
 *
 * Behaviour (matches GitHub's feel — fast first burst, asymptote at ~90%,
 * snap to 100% on completion, then fade out):
 *   • on start  →  jump to 20%, then trickle toward 90% (each tick adds a
 *                  fraction of the remaining distance — never reaches 100%
 *                  while busy, mimics network arrival pacing).
 *   • on finish →  set 100%, hold 200 ms so the eye registers completion,
 *                  fade out over 300 ms, reset to 0 once invisible.
 *   • on restart while still fading → cancel fade and start a fresh cycle.
 *
 * Visual is brand-500 #2463EB (referest royal blue), 2 px tall, with a
 * trailing glow that gives it the "loading something real" feel rather
 * than the flat block most generic spinners produce.
 *
 * Mounted once at the App root so it spans every route + layout.
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

const START_PERCENT       = 20
const TRICKLE_MAX_PERCENT = 90
const TRICKLE_INTERVAL_MS = 200
const COMPLETE_HOLD_MS    = 200   // 100% snap held this long before fading
const FADE_DURATION_MS    = 300

type Phase = 'idle' | 'loading' | 'finishing'

export default function PjaxLoader() {
  const location = useLocation()
  const isFetching  = useIsFetching()
  const isMutating  = useIsMutating()
  const busy        = isFetching > 0 || isMutating > 0

  const [percent, setPercent] = useState(0)
  const [phase, setPhase]     = useState<Phase>('idle')

  // Track the most recent pathname so we can detect transitions without
  // restarting on identical re-renders.
  const lastPath = useRef(location.pathname)
  const trickleTimer = useRef<number | null>(null)
  const finishTimer  = useRef<number | null>(null)
  const resetTimer   = useRef<number | null>(null)

  function clearAllTimers() {
    if (trickleTimer.current !== null) window.clearInterval(trickleTimer.current)
    if (finishTimer.current  !== null) window.clearTimeout(finishTimer.current)
    if (resetTimer.current   !== null) window.clearTimeout(resetTimer.current)
    trickleTimer.current = null
    finishTimer.current  = null
    resetTimer.current   = null
  }

  function startLoading() {
    clearAllTimers()
    setPhase('loading')
    setPercent(START_PERCENT)
    // Trickle: each tick, add a fraction of the remaining distance to 90%.
    // Pure NProgress algorithm — feels like real network arrival because
    // the increment shrinks as we approach the cap.
    trickleTimer.current = window.setInterval(() => {
      setPercent((p) => {
        if (p >= TRICKLE_MAX_PERCENT) return p
        const remaining = TRICKLE_MAX_PERCENT - p
        return p + remaining * 0.08   // 8% of the gap per tick
      })
    }, TRICKLE_INTERVAL_MS)
  }

  function finishLoading() {
    clearAllTimers()
    setPhase('finishing')
    setPercent(100)
    finishTimer.current = window.setTimeout(() => {
      // After the hold, fade-out begins via CSS (opacity transition); we
      // reset to phase=idle once the transition is done so the next start
      // gets a clean slate.
      resetTimer.current = window.setTimeout(() => {
        setPhase('idle')
        setPercent(0)
      }, FADE_DURATION_MS)
    }, COMPLETE_HOLD_MS)
  }

  // Route-change trigger — sees a different pathname, kicks the bar.
  useEffect(() => {
    if (location.pathname !== lastPath.current) {
      lastPath.current = location.pathname
      startLoading()
    }
    // We intentionally do NOT finish here — finish is owned by the busy
    // signal effect below, so route + data fetch can co-occur and the
    // bar only completes when BOTH settle.
  }, [location.pathname])

  // Busy signal — start/finish based on react-query activity.
  useEffect(() => {
    if (busy) {
      if (phase !== 'loading') startLoading()
    } else if (phase === 'loading') {
      finishLoading()
    }
  }, [busy, phase])

  // Cleanup on unmount.
  useEffect(() => () => clearAllTimers(), [])

  if (phase === 'idle') return null

  return (
    <div
      role="progressbar"
      aria-label="Загрузка"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className="fixed left-0 top-0 z-[9999] h-[2px] w-full pointer-events-none"
      style={{
        opacity: phase === 'finishing' ? 0 : 1,
        transition: phase === 'finishing'
          ? `opacity ${FADE_DURATION_MS}ms ease-out`
          : undefined,
      }}
    >
      <div
        className="h-full bg-brand-500"
        style={{
          width: `${percent}%`,
          // Linear width transition matches GitHub's feel — abrupt would
          // look glitchy, ease-out would look lazy. 220 ms feels alive.
          transition: 'width 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          // Glow on the trailing edge — gives the bar a sense of "leading
          // a request through the wire" rather than just expanding.
          boxShadow: '0 0 8px 1px rgba(36, 99, 235, 0.55), 0 0 4px rgba(36, 99, 235, 0.35)',
        }}
      />
    </div>
  )
}
