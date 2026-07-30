import type { Rectangle, WebviewTag } from 'electron'
import { gameSetting } from '@renderer/store/gamesetting'
import { Const } from '@common/const'

class CaptureStuff {
  public async capture(webview: WebviewTag): Promise<string> {
    const date = new Date()
    const rect: Rectangle = {
      x: 0,
      y: Math.ceil(Const.GameBarHeight * gameSetting.zoom_factor),
      width: Math.floor(Const.GameWidth * gameSetting.zoom_factor),
      height: Math.floor(Const.GameHeight * gameSetting.zoom_factor)
    }
    console.log('capture stuff', rect, 'zoom-factor:', gameSetting.zoom_factor)
    const image = await webview.capturePage(rect)
    const buffer = image.toPNG()
    return window.api.saveCapture(date, buffer)
  }
}
export const captureStuff = new CaptureStuff()
