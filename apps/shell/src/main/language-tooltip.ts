import { join } from 'node:path'
import { WebContentsView, type BrowserWindow, type Point } from 'electron'

const WIDTH = 260
const HEIGHT = 150
const HOVER_DELAY_MS = 450

function createTooltip(window: BrowserWindow) {
  const view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  })
  view.setBackgroundColor('#00000000')
  view.setVisible(false)
  const contents = view.webContents
  const devUrl = process.env.ELECTRON_RENDERER_URL
  const ready = (
    devUrl
      ? contents.loadURL(new URL('language-tooltip.html', devUrl).href)
      : contents.loadFile(join(__dirname, '../renderer/language-tooltip.html'))
  ).then(
    () => true,
    () => false,
  )

  let pending: ReturnType<typeof setTimeout> | undefined
  const hide = () => {
    clearTimeout(pending)
    pending = undefined
    if (!contents.isDestroyed()) view.setVisible(false)
  }
  window.on('blur', hide)
  window.on('resize', hide)
  window.on('hide', hide)
  window.once('closed', () => {
    hide()
    if (!contents.isDestroyed()) contents.close()
  })

  return (anchor: Point | null) => {
    hide()
    if (!anchor) return
    const request = setTimeout(async () => {
      if (!(await ready) || pending !== request || window.isDestroyed()) return
      const [width, height] = window.getContentSize()
      const x = Math.round(anchor.x)
      const y = Math.round(anchor.y)
      if (y < 0 || y + HEIGHT > height || x < 0 || x > width) return
      // Raise above the sibling editor views without obscuring the trigger.
      window.contentView.addChildView(view)
      view.setBounds({
        x: Math.max(0, Math.min(width - WIDTH, x - WIDTH + 30)),
        y,
        width: WIDTH,
        height: HEIGHT,
      })
      view.setVisible(true)
    }, HOVER_DELAY_MS)
    pending = request
  }
}

const tooltips = new WeakMap<BrowserWindow, ReturnType<typeof createTooltip>>()

export function setLanguageTooltip(window: BrowserWindow, anchor: Point | null): void {
  let tooltip = tooltips.get(window)
  if (!tooltip && anchor) {
    tooltip = createTooltip(window)
    tooltips.set(window, tooltip)
  }
  tooltip?.(anchor)
}
