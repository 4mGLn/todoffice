import { describe, expect, it, vi } from 'vitest'
import {
  axisLockedPoint,
  cancelObjectDrag,
  dragKeepsRatio,
  ratioResizedBox,
} from '../studio-plugin/object-drag.mjs'

const picture = { sec: 0, ppi: 1, ci: 0, type: 'image' }
const shape = { sec: 0, ppi: 2, ci: 0, type: 'shape' }

describe('which drags keep the ratio (help: 개체 크기 조절)', () => {
  it("keeps a picture's on a corner handle, with or without Shift", () => {
    for (const dir of ['nw', 'ne', 'sw', 'se']) {
      expect(dragKeepsRatio({ dir, ref: picture }, false)).toBe(true)
      expect(dragKeepsRatio({ dir, ref: picture }, true)).toBe(true)
    }
  })

  it("keeps a drawing object's on a corner handle only with Shift", () => {
    for (const type of ['shape', 'group', 'line', 'ole']) {
      const ref = { ...shape, type }
      expect(dragKeepsRatio({ dir: 'se', ref }, false)).toBe(false)
      expect(dragKeepsRatio({ dir: 'se', ref }, true)).toBe(true)
    }
  })

  it('never on a side handle, which sizes one direction', () => {
    for (const dir of ['n', 'e', 's', 'w']) {
      expect(dragKeepsRatio({ dir, ref: picture }, false)).toBe(false)
      expect(dragKeepsRatio({ dir, ref: shape }, true)).toBe(false)
    }
  })

  it('keeps it for several pictures, and for a mixed selection with Shift', () => {
    expect(dragKeepsRatio({ dir: 'ne', ref: picture, multiRefs: [picture, picture] }, false)).toBe(
      true,
    )
    expect(dragKeepsRatio({ dir: 'ne', ref: picture, multiRefs: [picture, shape] }, false)).toBe(
      false,
    )
    expect(dragKeepsRatio({ dir: 'ne', ref: picture, multiRefs: [picture, shape] }, true)).toBe(
      true,
    )
  })
})

describe('the box of a corner drag that keeps the ratio', () => {
  const box = { x: 100, y: 50, w: 200, h: 100 }
  const ratio = (b: { width: number; height: number }) => b.width / b.height

  it('grows along the diagonal and holds the opposite corner', () => {
    const se = ratioResizedBox(box, 'se', 40, 20)
    expect(ratio(se)).toBeCloseTo(2)
    expect(se.width).toBeCloseTo(240)
    expect([se.x, se.y]).toEqual([100, 50])

    const nw = ratioResizedBox(box, 'nw', -40, -20)
    expect(nw.width).toBeCloseTo(240)
    expect(nw.x + nw.width).toBeCloseTo(300)
    expect(nw.y + nw.height).toBeCloseTo(150)

    const ne = ratioResizedBox(box, 'ne', -20, 0)
    expect(ratio(ne)).toBeCloseTo(2)
    expect(ne.width).toBeLessThan(200)
    expect(ne.x).toBe(100)
    expect(ne.y + ne.height).toBeCloseTo(150)

    const sw = ratioResizedBox(box, 'sw', 0, 30)
    expect(ratio(sw)).toBeCloseTo(2)
    expect(sw.x + sw.width).toBeCloseTo(300)
    expect(sw.y).toBe(50)
  })

  it('keeps the ratio when the pointer moves one way only', () => {
    const across = ratioResizedBox(box, 'se', 100, 0)
    expect(ratio(across)).toBeCloseTo(2)
    expect(across.width).toBeGreaterThan(200)
  })

  it('does not go below a pixel or turn over when dragged past the other corner', () => {
    const past = ratioResizedBox(box, 'se', -1000, -1000)
    expect(past.width).toBeCloseTo(1)
    expect(past.height).toBeCloseTo(0.5)
    expect([past.x, past.y]).toEqual([100, 50])
  })
})

describe('Shift while moving (help: 개체 이동하기)', () => {
  const start = { x: 10, y: 10 }

  it('holds the axis the pointer went less far on', () => {
    expect(axisLockedPoint(start, { x: 50, y: 18 })).toEqual({ x: 50, y: 10 })
    expect(axisLockedPoint(start, { x: 4, y: -40 })).toEqual({ x: 10, y: -40 })
  })

  it('goes across when both are even', () => {
    expect(axisLockedPoint(start, { x: 20, y: 20 })).toEqual({ x: 20, y: 10 })
  })
})

function inputHandler(overrides: Record<string, unknown> = {}) {
  return {
    isPictureResizeDragging: false,
    pictureResizeState: null,
    isPictureMoveDragging: false,
    pictureMoveState: null,
    dragRafId: 0,
    container: { style: { cursor: 'move' } },
    eventBus: { emit: vi.fn() },
    wasm: { updateConnectorsInSection: vi.fn() },
    setObjectProperties: vi.fn(),
    cleanupPictureResizeDrag: vi.fn(),
    renderPictureObjectSelection: vi.fn(),
    ...overrides,
  }
}

describe('Esc while dragging an object', () => {
  it('leaves the key alone when no drag is on', () => {
    const ih = inputHandler()
    expect(cancelObjectDrag(ih)).toBe(false)
    expect(cancelObjectDrag(null)).toBe(false)
    expect(ih.setObjectProperties).not.toHaveBeenCalled()
  })

  it('puts a moved object back where it was, without an undo step', () => {
    const ih = inputHandler({
      isPictureMoveDragging: true,
      pictureMoveState: {
        ref: picture,
        origHorzOffset: 1000,
        origVertOffset: 2000,
        totalDeltaH: 750,
        totalDeltaV: -75,
      },
    })
    expect(cancelObjectDrag(ih)).toBe(true)
    expect(ih.setObjectProperties).toHaveBeenCalledWith(expect.objectContaining(picture), {
      horzOffset: 1000,
      vertOffset: 2000,
    })
    expect(ih.isPictureMoveDragging).toBe(false)
    expect(ih.pictureMoveState).toBeNull()
    expect(ih.container.style.cursor).toBe('')
    expect(ih.eventBus.emit).toHaveBeenCalledWith('document-changed')
    expect(ih.renderPictureObjectSelection).toHaveBeenCalled()
  })

  it('puts every object of a moved selection back', () => {
    const multiRefs = [
      { ...picture, origHorzOffset: 10, origVertOffset: 20 },
      { ...shape, origHorzOffset: 30, origVertOffset: 40 },
    ]
    const ih = inputHandler({
      isPictureMoveDragging: true,
      pictureMoveState: { ref: multiRefs[0], multiRefs, totalDeltaH: 5, totalDeltaV: 0 },
    })
    cancelObjectDrag(ih)
    expect(ih.setObjectProperties).toHaveBeenCalledTimes(2)
    expect(ih.setObjectProperties).toHaveBeenLastCalledWith(multiRefs[1], {
      horzOffset: 30,
      vertOffset: 40,
    })
    expect(ih.wasm.updateConnectorsInSection).toHaveBeenCalledWith(0)
  })

  it('writes nothing when the object has not moved yet', () => {
    const ih = inputHandler({
      isPictureMoveDragging: true,
      pictureMoveState: {
        ref: picture,
        origHorzOffset: 0,
        origVertOffset: 0,
        totalDeltaH: 0,
        totalDeltaV: 0,
      },
    })
    expect(cancelObjectDrag(ih)).toBe(true)
    expect(ih.setObjectProperties).not.toHaveBeenCalled()
    expect(ih.isPictureMoveDragging).toBe(false)
  })

  it("ends a size drag through the studio's clean-up, which puts the size back", () => {
    const ih = inputHandler({ isPictureResizeDragging: true, pictureResizeState: { dir: 'se' } })
    expect(cancelObjectDrag(ih)).toBe(true)
    expect(ih.cleanupPictureResizeDrag).toHaveBeenCalled()
    expect(ih.renderPictureObjectSelection).toHaveBeenCalled()
  })
})
