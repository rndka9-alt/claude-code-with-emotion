// 세션이 어느 창의 렌더러에 붙어 있는지 추적한다.
// 창 하나만 닫힐 때(native close) 그 창이 소유한 세션을 정리하기 위한 장부로,
// bootstrap·탭 detach/attach 시점에 갱신된다. 마지막 창 닫힘은 전체 dispose 가 처리한다.
export class SessionWindowOwnership {
  private readonly ownerWindowIdBySessionId = new Map<string, number>();

  assignSessions(sessionIds: readonly string[], windowId: number): void {
    for (const sessionId of sessionIds) {
      this.ownerWindowIdBySessionId.set(sessionId, windowId);
    }
  }

  releaseSession(sessionId: string): void {
    this.ownerWindowIdBySessionId.delete(sessionId);
  }

  // 해당 창 소유 세션들을 장부에서 제거하며 반환한다. 반환된 세션은 호출 측이 닫는다.
  takeSessionsOwnedByWindow(windowId: number): string[] {
    const sessionIds: string[] = [];

    for (const [sessionId, ownerWindowId] of this.ownerWindowIdBySessionId) {
      if (ownerWindowId === windowId) {
        sessionIds.push(sessionId);
      }
    }

    for (const sessionId of sessionIds) {
      this.ownerWindowIdBySessionId.delete(sessionId);
    }

    return sessionIds;
  }
}
