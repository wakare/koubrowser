import { ApiItemId } from '@common/kcs'
import {
  DbName,
  type PortRecord,
  type PortRecordQuery,
  type PortRecordQueryProjection,
  type QueryReturn,
  toRecordDate
} from '@common/record'
import { withPanelLoadTimeout } from '@renderer/common/panel-load'

export type QueryTodayExp = (query: PortRecordQuery) => Promise<QueryReturn>

export interface TodayExpLoadControllerOptions {
  queryDb: QueryTodayExp
  currentExp: () => number
  onLoaded: (startExp: number) => void
  onError?: (error: unknown) => void
}

export class TodayExpLoadController {
  private pending: Promise<void> | null = null
  private requestId = 0
  private loaded = false
  private disposed = false

  constructor(private readonly options: TodayExpLoadControllerOptions) {}

  load(): Promise<void> {
    if (this.loaded || this.disposed) {
      return Promise.resolve()
    }
    if (this.pending) {
      return this.pending
    }

    const requestId = ++this.requestId
    const pending = this.performLoad(requestId).finally(() => {
      if (this.pending === pending) {
        this.pending = null
      }
    })
    this.pending = pending
    return pending
  }

  dispose(): void {
    this.disposed = true
    this.requestId += 1
    this.pending = null
  }

  private async performLoad(requestId: number): Promise<void> {
    try {
      const startExp = await loadTodayStartExp(
        this.options.queryDb,
        this.options.currentExp()
      )
      if (this.disposed || requestId !== this.requestId) {
        return
      }
      this.loaded = true
      this.options.onLoaded(startExp)
    } catch (error) {
      if (this.disposed || requestId !== this.requestId) {
        return
      }
      this.options.onError?.(error)
    }
  }
}

export async function loadTodayStartExp(
  queryDb: QueryTodayExp,
  currentExp: number,
  now: Date = new Date()
): Promise<number> {
  const fromDate = new Date(now)
  if (fromDate.getHours() < 2) {
    fromDate.setDate(fromDate.getDate() - 1)
  }
  fromDate.setHours(2, 0, 0, 0)

  const projection: PortRecordQueryProjection = { date: 1 }
  projection[ApiItemId.teitoku_exp] = 1

  const query: PortRecordQuery = {
    dbName: DbName.port,
    find: {
      date: {
        $gte: toRecordDate(fromDate)
      }
    },
    sort: { date: 1 },
    limit: 1,
    projection
  }
  const records = (await withPanelLoadTimeout(
    queryDb(query),
    'Today battle score request timed out'
  )) as PortRecord[]
  const startExp = records[0]?.[ApiItemId.teitoku_exp]
  return typeof startExp === 'number' ? startExp : currentExp
}
