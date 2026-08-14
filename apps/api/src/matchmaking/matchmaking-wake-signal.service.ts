import { Injectable } from '@nestjs/common';

@Injectable()
export class MatchmakingWakeSignalService {
  private version = 0;
  private readonly waiters = new Set<() => void>();

  snapshot(): number {
    return this.version;
  }

  wake(): void {
    this.version += 1;
    for (const resolve of this.waiters) resolve();
    this.waiters.clear();
  }

  async waitForChange(snapshot: number, timeoutMs: number): Promise<void> {
    if (this.version !== snapshot) return;

    await new Promise<void>((resolve) => {
      const finish = (): void => {
        clearTimeout(timer);
        this.waiters.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.waiters.add(finish);

      if (this.version !== snapshot) finish();
    });
  }
}
