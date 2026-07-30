const BASE_SHIP_COUNT = 6
const SHIPS_PER_BANNER_ROW = 3
const SHIP_BANNER_ROW_HEIGHT = 50
const SHIP_STATUS_ROW_HEIGHT = 30

export const BASE_DECK_PORT_LOGICAL_HEIGHT = 333

export const deckPortLogicalHeight = (shipIds: readonly number[]): number => {
  const shipCount = shipIds.filter((shipId) => shipId > 0).length
  const bannerRows = Math.ceil(shipCount / SHIPS_PER_BANNER_ROW)
  const extraBannerRows = Math.max(0, bannerRows - BASE_SHIP_COUNT / SHIPS_PER_BANNER_ROW)
  const extraStatusRows = Math.max(0, shipCount - BASE_SHIP_COUNT)

  return (
    BASE_DECK_PORT_LOGICAL_HEIGHT +
    extraBannerRows * SHIP_BANNER_ROW_HEIGHT +
    extraStatusRows * SHIP_STATUS_ROW_HEIGHT
  )
}
