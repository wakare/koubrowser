import { Const } from '@common/const'
const isAssist = !!process.argv.find((a) => a.startsWith(Const.ArgIsAssist))
const isInitMuted = !!process.argv.find((a) => a.startsWith(Const.ArgIsInitMuted))
const isTestMode = !!process.argv.find((a) => a.startsWith(Const.ArgIsTestMode))
const isLayoutFixture = !!process.argv.find((a) =>
  a.startsWith(Const.ArgIsLayoutFixture)
)
const isPseudoLocale =
  isLayoutFixture &&
  !!process.argv.find((a) => a.startsWith(Const.ArgPseudoLocale))
const appLaunchId = process.argv
  .find((a) => a.startsWith(`${Const.ArgAppLaunchId}=`))
  ?.slice(`${Const.ArgAppLaunchId}=`.length)

export class EnvRenderer {
  static get isAssist(): boolean {
    return isAssist
  }
  static get isInitMuted(): boolean {
    return isInitMuted
  }
  static get isTestMode(): boolean {
    return isTestMode
  }
  static get isLayoutFixture(): boolean {
    return isLayoutFixture
  }
  static get isPseudoLocale(): boolean {
    return isPseudoLocale
  }
  static get appLaunchId(): string | undefined {
    return appLaunchId
  }
}
