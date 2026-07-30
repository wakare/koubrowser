export class LatestRequestScopes {
  private readonly requestIds = new Map<number, number>()

  start(scopeId: number, requestId: number): void {
    this.requestIds.set(scopeId, requestId)
  }

  isCurrent(scopeId: number, requestId: number): boolean {
    return this.requestIds.get(scopeId) === requestId
  }

  finish(scopeId: number, requestId: number): void {
    if (this.isCurrent(scopeId, requestId)) {
      this.requestIds.delete(scopeId)
    }
  }
}
