"use client"

/* ------------------------------------------------------------------ */
/*  Navigation HUD — on-screen movement controls                        */
/*  Works with mouse and touch; mirrors the keyboard input              */
/* ------------------------------------------------------------------ */

export const navInput = {
  forward: false,
  back: false,
  left: false,
  right: false,
  up: false,
  down: false,
}

export function resetNavInput() {
  navInput.forward = false
  navInput.back = false
  navInput.left = false
  navInput.right = false
  navInput.up = false
  navInput.down = false
}

function NavButton({
  label,
  onHold,
  className = "",
}: {
  label: string
  onHold: (active: boolean) => void
  className?: string
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onHold(true)
      }}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`w-11 h-11 flex items-center justify-center border border-neutral-700/50 bg-black/40 backdrop-blur-sm text-neutral-400 active:bg-violet-500/30 active:border-violet-400/50 select-none touch-none ${className}`}
    >
      {label}
    </button>
  )
}

export function NavHud({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-4 pb-4 pointer-events-none">
      {/* Movement pad */}
      <div
        className="grid grid-cols-3 gap-1 pointer-events-auto"
        style={{ gridTemplateAreas: '". up .", "left down right"' }}
      >
        <NavButton label="↑" onHold={(a) => (navInput.forward = a)} className="col-start-2" />
        <NavButton label="←" onHold={(a) => (navInput.left = a)} className="col-start-1 row-start-2" />
        <NavButton label="↓" onHold={(a) => (navInput.back = a)} className="col-start-2 row-start-2" />
        <NavButton label="→" onHold={(a) => (navInput.right = a)} className="col-start-3 row-start-2" />
      </div>

      {/* Vertical pad */}
      <div className="flex flex-col gap-1 pointer-events-auto">
        <NavButton label="⤒" onHold={(a) => (navInput.up = a)} />
        <NavButton label="⤓" onHold={(a) => (navInput.down = a)} />
      </div>
    </div>
  )
}
