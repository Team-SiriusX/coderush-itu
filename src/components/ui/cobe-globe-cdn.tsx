"use client"

import { useCallback, useEffect, useRef } from "react"
import createGlobe from "cobe"

interface CdnMarker {
  id: string
  location: [number, number]
  region: string
}

interface CdnArc {
  id: string
  from: [number, number]
  to: [number, number]
}

interface GlobeCdnProps {
  markers?: CdnMarker[]
  arcs?: CdnArc[]
  className?: string
  speed?: number
}

const defaultMarkers: CdnMarker[] = [
  { id: "cdn-iad", location: [38.95, -77.45], region: "iad1" },
  { id: "cdn-sfo", location: [37.62, -122.38], region: "sfo1" },
  { id: "cdn-cdg", location: [49.01, 2.55], region: "cdg1" },
]

const defaultArcs: CdnArc[] = []

export function GlobeCdn({
  markers = defaultMarkers,
  arcs = defaultArcs,
  className = "",
  speed = 0.003,
}: GlobeCdnProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null)
  const animationRef = useRef<number | null>(null)
  const markersRef = useRef<CdnMarker[]>(markers)
  const arcsRef = useRef<CdnArc[]>(arcs)
  const speedRef = useRef(speed)
  const phiRef = useRef(0)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    markersRef.current = markers
  }, [markers])

  useEffect(() => {
    arcsRef.current = arcs
  }, [arcs])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current

    const init = () => {
      const width = canvas.offsetWidth
      if (width === 0 || globeRef.current) return

      globeRef.current = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height: width,
        phi: 0,
        theta: 0.2,
        dark: 0,
        diffuse: 1.5,
        mapSamples: 16000,
        mapBrightness: 10,
        baseColor: [1, 1, 1],
        markerColor: [0, 0, 0],
        glowColor: [0.94, 0.93, 0.91],
        markerElevation: 0.02,
        markers: markersRef.current.map((m) => ({ location: m.location, size: 0.012, id: m.id })),
        arcs: arcsRef.current.map((a) => ({ from: a.from, to: a.to, id: a.id })),
        arcColor: [0, 0, 0],
        arcWidth: 0.5,
        arcHeight: 0.25,
        opacity: 0.7,
      })

      const animate = () => {
        const globe = globeRef.current
        if (!globe) return
        if (!isPausedRef.current) {
          phiRef.current = (phiRef.current + speedRef.current) % (Math.PI * 2)
        }
        globe.update({
          phi: phiRef.current + phiOffsetRef.current + dragOffset.current.phi,
          theta: 0.2 + thetaOffsetRef.current + dragOffset.current.theta,
          markers: markersRef.current.map((m) => ({ location: m.location, size: 0.012, id: m.id })),
          arcs: arcsRef.current.map((a) => ({ from: a.from, to: a.to, id: a.id })),
        })
        animationRef.current = requestAnimationFrame(animate)
      }

      animate()
      setTimeout(() => {
        canvas.style.opacity = "1"
      }, 20)
    }

    if (canvas.offsetWidth > 0) init()
    else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect()
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      animationRef.current = null
      if (globeRef.current) {
        globeRef.current.destroy()
        globeRef.current = null
      }
    }
  }, [])

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1.1s ease",
          borderRadius: "50%",
          touchAction: "none",
        }}
      />

      {markers.map((m, idx) => {
        const angle = (Math.PI * 2 * idx) / Math.max(markers.length, 1)
        const radius = 64
        const captionDx = Math.cos(angle) * radius
        const captionDy = Math.sin(angle) * radius
        const lineAngle = (angle * 180) / Math.PI
        const lineLength = radius - 10
        // Ships can share nearly identical coordinates at spawn.
        // Slightly fan origins so beams stay readable while remaining location-pinned.
        const originFan = 6 + (idx % 3) * 3
        const originDx = Math.cos(angle) * originFan
        const originDy = Math.sin(angle) * originFan
        return (
          <div
            key={m.id}
            style={{
              position: "absolute",
              // @ts-expect-error CSS Anchor Positioning
              positionAnchor: `--cobe-${m.id}`,
              bottom: "anchor(center)",
              left: "anchor(center)",
              translate: `${originDx}px ${originDy}px`,
              display: "block",
              pointerEvents: "none" as const,
              opacity: `var(--cobe-visible-${m.id}, 0)`,
              filter: `blur(calc((1 - var(--cobe-visible-${m.id}, 0)) * 8px))`,
              transition: "opacity 0.3s, filter 0.3s",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -1,
                width: lineLength,
                height: 2,
                background:
                  "linear-gradient(90deg, rgba(248,113,113,0.98) 0%, rgba(248,113,113,0.7) 45%, rgba(248,113,113,0.1) 100%)",
                clipPath: "polygon(0 38%, 92% 38%, 100% 50%, 92% 62%, 0 62%)",
                boxShadow:
                  "0 0 6px rgba(248,113,113,0.4), 0 0 14px rgba(248,113,113,0.18)",
                transform: `rotate(${lineAngle}deg)`,
                transformOrigin: "0 50%",
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: -3,
                top: -3,
                width: 6,
                height: 6,
                borderRadius: "999px",
                background: "#ef4444",
                boxShadow: "0 0 8px rgba(239,68,68,0.95)",
              }}
            />

            <span
              style={{
                position: "absolute",
                left: captionDx + (captionDx > 0 ? 8 : -8),
                top: captionDy,
                fontFamily: "system-ui, sans-serif",
                fontSize: "0.54rem",
                fontWeight: 600,
                color: "#fee2e2",
                background: "rgba(2, 6, 23, 0.88)",
                border: "1px solid rgba(248, 113, 113, 0.45)",
                padding: "2px 7px",
                borderRadius: 6,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                maxWidth: "112px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                boxShadow: "0 6px 12px rgba(2, 6, 23, 0.45)",
                transform: captionDx > 0 ? "translateX(0)" : "translateX(-100%)",
              }}
            >
              {m.region}
            </span>
          </div>
        )
      })}
    </div>
  )
}
