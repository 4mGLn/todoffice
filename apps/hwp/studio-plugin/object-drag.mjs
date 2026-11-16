/**
 * Hancom Hangul's mouse rules for a selected picture or drawing object, as its help gives them
 * (개체 크기 조절, 개체 이동하기):
 *
 * - A picture's corner handle keeps its width to height ("그림의 크기를 조절할 때에는 그리기
 *   개체와는 달리, 각 모서리의 점을 잡고 끌면 너비와 높이가 비례적으로 조절됩니다"). A drawing
 *   object's corner keeps it with Shift held ("<Shift>를 누른 채로 각 모서리의 점을 잡고 끌면
 *   너비와 높이가 비례적으로 조절됩니다"). A side handle sizes one direction only.
 * - Shift while moving keeps the object on its row or its column ("현재 개체의 수평이나 수직
 *   위치로만 이동합니다").
 * - Esc while dragging puts the object back ("끄는 도중에 <Esc>를 누르면 개체 이동이 취소됩니다").
 *
 * The studio sized every object freely and had neither key. Hangul's Shift on a picture's corner
 * crops it (그림 자르기); until that exists here, the picture keeps its ratio with Shift too.
 *
 * Bundled into the studio through hancom-keys.mjs and called from the studio's drag code by the
 * studio-hancom-object-drag and studio-hancom-object-drag-cancel patches. What cancelObjectDrag
 * uses of the studio's input handler is listed in hancomHooks (scripts/rhwp-patches.mjs).
 */

const CORNERS = new Set(['nw', 'ne', 'sw', 'se'])

/**
 * Whether a resize drag keeps the width to height: a corner handle, on pictures alone, or on
 * anything with Shift. `state` is the studio's resize state: the handle (`dir`) and the object
 * (`ref`), or the objects of a multiple selection (`multiRefs`).
 */
export function dragKeepsRatio(state, shiftKey) {
  if (!CORNERS.has(state?.dir)) return false
  if (shiftKey) return true
  const refs = state.multiRefs ?? [state.ref]
  return refs.length > 0 && refs.every((ref) => ref?.type === 'image')
}

/**
 * The box a corner drag that keeps the ratio leaves (page px): the opposite corner stays where it
 * is, and the size follows the pointer's move along the box's diagonal, the way the studio sizes a
 * turned picture. The box does not go below one pixel on its longer side, nor turn over.
 */
export function ratioResizedBox(box, dir, dx, dy) {
  const { x, y, w, h } = box
  const signX = dir.includes('e') ? 1 : -1
  const signY = dir.includes('s') ? 1 : -1
  const diagonal = Math.hypot(w, h) || 1
  const along = (signX * dx * w + signY * dy * h) / diagonal
  const scale = Math.max((diagonal + along) / diagonal, 1 / Math.max(w, h, 1))
  const width = w * scale
  const height = h * scale
  return {
    x: signX > 0 ? x : x + w - width,
    y: signY > 0 ? y : y + h - height,
    width,
    height,
  }
}

/**
 * Where a Shift+drag takes the pointer: along the axis it went farther on from where the drag
 * started, the other one held at the start.
 */
export function axisLockedPoint(start, point) {
  return Math.abs(point.x - start.x) >= Math.abs(point.y - start.y)
    ? { x: point.x, y: start.y }
    : { x: start.x, y: point.y }
}

/**
 * Esc while a picture or drawing object is being moved or sized: the object goes back where it
 * was and the drag ends without an undo step. False when no such drag is on.
 */
export function cancelObjectDrag(ih) {
  if (ih?.isPictureResizeDragging && ih.pictureResizeState) {
    // the drag's journal puts back what the drag changed so far
    ih.cleanupPictureResizeDrag()
    ih.eventBus.emit('document-changed')
    ih.renderPictureObjectSelection()
    return true
  }
  if (ih?.isPictureMoveDragging && ih.pictureMoveState) {
    const state = ih.pictureMoveState
    const targets = state.multiRefs ?? [
      { ...state.ref, origHorzOffset: state.origHorzOffset, origVertOffset: state.origVertOffset },
    ]
    if (state.totalDeltaH !== 0 || state.totalDeltaV !== 0) {
      for (const ref of targets) {
        ih.setObjectProperties(ref, {
          horzOffset: ref.origHorzOffset,
          vertOffset: ref.origVertOffset,
        })
      }
      try {
        ih.wasm.updateConnectorsInSection(targets[0].sec)
      } catch {
        // a section without connectors
      }
      ih.eventBus.emit('document-changed')
    }
    ih.isPictureMoveDragging = false
    ih.pictureMoveState = null
    ih.container.style.cursor = ''
    if (ih.dragRafId) {
      globalThis.cancelAnimationFrame(ih.dragRafId)
      ih.dragRafId = 0
    }
    ih.renderPictureObjectSelection()
    return true
  }
  return false
}
