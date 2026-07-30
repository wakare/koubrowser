import util from 'node:util'

interface NeDBLegacyUtil {
  isArray: (value: unknown) => value is unknown[]
  isDate: (value: unknown) => value is Date
  isRegExp: (value: unknown) => value is RegExp
}

/**
 * NeDB 1.8.0 still calls legacy node:util type guards.
 * Node.js 24 removed isDate/isRegExp and deprecated isArray.
 */
export function installNeDBUtilCompatibility(): void {
  const legacyUtil = util as typeof util & NeDBLegacyUtil
  legacyUtil.isArray = Array.isArray
  legacyUtil.isDate = util.types.isDate
  legacyUtil.isRegExp = util.types.isRegExp
}

installNeDBUtilCompatibility()
