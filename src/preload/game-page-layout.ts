const GamePageLayoutStyleId = 'koubrowser-game-page-layout'

const GamePageLayoutCss = `
html,
body {
  overflow: hidden !important;
  margin: 0 !important;
  padding: 0 !important;
}

#w,
#main-ntg {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  z-index: 100 !important;
  margin-top: 0 !important;
  margin-left: 0 !important;
}

#game_frame {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 1200px !important;
  height: 720px !important;
  border: 0 !important;
}

.naviapp {
  z-index: -1 !important;
}

#ntg-recommend,
#spacing_top,
aside,
ul:has([aria-label="close"]) {
  display: none !important;
}

#root > div > main {
  padding-top: 0 !important;
}
`

function isGamePage(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return (
      url.pathname.includes('kancolle') ||
      url.pathname.includes('854854') ||
      url.hostname === 'osapi.dmm.com' ||
      url.pathname.includes('/kcs')
    )
  } catch {
    return false
  }
}

function alignGamePage(): void {
  if (!isGamePage(window.location.href)) {
    return
  }

  if (!document.getElementById(GamePageLayoutStyleId)) {
    const style = document.createElement('style')
    style.id = GamePageLayoutStyleId
    style.textContent = GamePageLayoutCss
    const parent = document.head ?? document.documentElement
    parent?.appendChild(style)
  }

  const gameFrame = document.querySelector<HTMLIFrameElement>('#game_frame')
  if (gameFrame) {
    gameFrame.scrolling = 'no'
  }

  window.scrollTo(0, 0)
}

export function installGamePageLayout(): void {
  alignGamePage()

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', alignGamePage, { once: true })
  }
}
