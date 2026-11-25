export interface AiMarkProps {
  size?: number
  className?: string
}

/**
 * Neutral mark for the AI entry points (ribbon button, panel header, launcher
 * chips): a rounded-square speech bubble holding the Vermilion symbol. It names no AI
 * vendor, so it stays correct whichever provider the user has connected.
 *
 * Drawn inline with `currentColor` so it follows the surrounding text color in
 * both themes and stays crisp at device resolution. The reference drawing is
 * apps/shell/build/brand/ai-mark.svg; keep the two in sync.
 */
export function AiMark({ size = 18, className }: AiMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M7 3.5h10a3.5 3.5 0 0 1 3.5 3.5v7a3.5 3.5 0 0 1-3.5 3.5h-6l-4.2 3.4a.6.6 0 0 1-1-.5v-3.1A3.5 3.5 0 0 1 3.5 14V7A3.5 3.5 0 0 1 7 3.5z" />
      <path fill="currentColor" stroke="none" fillRule="evenodd" transform="translate(8.2 5.6) scale(.036)" d="M74 260 L72 221 C66 227 59 230 50 230 C22 230 0 208 0 179 C0 151 24 124 52 124 C62 124 65 121 65 111 L64 56 C63 23 93 0 126 0 H148 C188 0 217 29 217 68 C217 106 187 135 151 135 H121 C109 135 104 141 104 152 L105 238 C105 248 92 251 74 260 Z M102 109 C109 102 114 100 125 100 H148 C169 100 181 86 181 68 C181 50 168 35 148 35 H127 C111 35 100 46 101 61 Z M69 154 C64 157 58 159 53 159 C40 159 34 168 34 179 C34 191 42 197 52 197 C63 197 69 192 69 184 Z" />
    </svg>
  )
}
