import { ApiDeckPort, ApiDeckPortId, KcsUtil, ShipHpState, SvData } from '@common/kcs'

export type TaihaWarning = 'none' | 'battle-result' | 'advanced'

const deckHasTaiha = (svdata: SvData, deck: ApiDeckPort, skipFlagship: boolean): boolean =>
  deck.api_ship.some((shipId, index) => {
    if ((skipFlagship && index === 0) || svdata.isShipEscaped(deck, index)) {
      return false
    }

    const ship = svdata.ship(shipId)
    return ship ? KcsUtil.shipHpState(ship) === ShipHpState.taiha : false
  })

export const hasTaihaSortieShip = (svdata: SvData): boolean => {
  if (!svdata.inMap) {
    return false
  }

  const battleDeck = svdata.battleDeck
  if (!battleDeck) {
    return false
  }
  if (deckHasTaiha(svdata, battleDeck, false)) {
    return true
  }
  if (!svdata.isCombined) {
    return false
  }

  const escortDeck = svdata.deckPort(ApiDeckPortId.deck2st)
  return escortDeck ? deckHasTaiha(svdata, escortDeck, true) : false
}

export const taihaWarningTitle = (warning: TaihaWarning): string => {
  switch (warning) {
    case 'battle-result':
      return '！大破艦があります！'
    case 'advanced':
      return '！大破進撃です！'
    default:
      return ''
  }
}
