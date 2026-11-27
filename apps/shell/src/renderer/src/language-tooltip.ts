import '@genoffice/ui/tokens.css'
import './language-tooltip.css'
import { LANGUAGE_MENU_TOOLTIP } from '../../shared/language-options'

const card = document.querySelector('.language-tip')!
const copy = document.createElement('div')
copy.className = 'language-tip-copy'
for (const [lang, text] of Object.entries(LANGUAGE_MENU_TOOLTIP)) {
  const description = document.createElement('p')
  description.lang = lang
  description.textContent = text
  const parent = lang === 'mn-Mong' ? card : copy
  parent.append(description)
}
card.append(copy)
