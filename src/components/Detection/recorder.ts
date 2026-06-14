// Background session recorder for nail-biting detection.
//
// The detector runs continuously; this module accumulates the raw signal for
// later data-science use. It keeps two streams:
//   - `samples`: one row per inference tick (dense time series)
//   - `bites`:   one row per detected bite (the rising edge of an alert)
// plus a derived `summary`. Everything is held in plain arrays so it can be
// serialized to CSV/JSON and pulled out of the browser for analysis.

export type FingerSample = {
  /** Stable finger identity, e.g. "Right:index". */
  name: string;
  /** This finger's biting contribution this tick, in [0, 1]. */
  score: number;
};

export type Sample = {
  /** Milliseconds since the session started. */
  t: number;
  /** Overall biting confidence this tick, in [0, 1]. */
  score: number;
  /** Whether the alert (sustained biting) was active this tick. */
  alerting: boolean;
  /** Per-finger breakdown for richer features. */
  fingers: FingerSample[];
};

export type BiteEvent = {
  /** Milliseconds since the session started. */
  t: number;
  /** Biting confidence at the moment the alert fired. */
  score: number;
};

export type PostureEvent = {
  /** Milliseconds since the session started. */
  t: number;
  /** Why the posture was flagged. */
  reason: "slouch" | "tilt";
};

export type SessionSummary = {
  /** Session length in milliseconds. */
  durationMs: number;
  /** Total inference samples recorded. */
  sampleCount: number;
  /** Total distinct bite events. */
  biteCount: number;
  /** Total distinct bad-posture events. */
  postureCount: number;
  /** Bites per minute over the session. */
  bitesPerMinute: number;
  /** Fraction of time the alert was active, in [0, 1]. */
  fractionAlerting: number;
  /** Mean biting score across all samples, in [0, 1]. */
  meanScore: number;
};

export class SessionRecorder {
  readonly startedAt: number;
  private samples: Sample[] = [];
  private bites: BiteEvent[] = [];
  private postures: PostureEvent[] = [];
  private alertingTicks = 0;
  private scoreSum = 0;

  constructor(startedAt: number) {
    this.startedAt = startedAt;
  }

  /** Record one inference tick. `now` is an absolute timestamp (ms). */
  addSample(now: number, score: number, alerting: boolean, fingers: FingerSample[]) {
    this.samples.push({
      t: Math.round(now - this.startedAt),
      score,
      alerting,
      fingers,
    });
    if (alerting) this.alertingTicks += 1;
    this.scoreSum += score;
  }

  /** Record a distinct bite event (call on the rising edge of an alert). */
  addBite(now: number, score: number) {
    this.bites.push({ t: Math.round(now - this.startedAt), score });
  }

  /** Record a distinct bad-posture event (rising edge of bad posture). */
  addPosture(now: number, reason: "slouch" | "tilt") {
    this.postures.push({ t: Math.round(now - this.startedAt), reason });
  }

  /** Most-recent samples, newest last, capped to `limit` for the live log. */
  recentSamples(limit: number): Sample[] {
    return this.samples.slice(-limit);
  }

  getBites(): BiteEvent[] {
    return this.bites;
  }

  getPostures(): PostureEvent[] {
    return this.postures;
  }

  summary(now: number): SessionSummary {
    const durationMs = Math.max(0, now - this.startedAt);
    const sampleCount = this.samples.length;
    const minutes = durationMs / 60000;
    return {
      durationMs,
      sampleCount,
      biteCount: this.bites.length,
      postureCount: this.postures.length,
      bitesPerMinute: minutes > 0 ? this.bites.length / minutes : 0,
      fractionAlerting: sampleCount > 0 ? this.alertingTicks / sampleCount : 0,
      meanScore: sampleCount > 0 ? this.scoreSum / sampleCount : 0,
    };
  }

  /** Flat CSV of every sample. Per-finger scores are flattened into columns. */
  toCSV(): string {
    // Collect the union of finger names so columns are stable across rows.
    const fingerNames = Array.from(
      new Set(this.samples.flatMap((s) => s.fingers.map((f) => f.name)))
    ).sort();

    const header = ["t_ms", "score", "alerting", ...fingerNames];
    const rows = this.samples.map((s) => {
      const byName = new Map(s.fingers.map((f) => [f.name, f.score]));
      const fingerCols = fingerNames.map((n) => {
        const v = byName.get(n);
        return v === undefined ? "" : v.toFixed(4);
      });
      return [
        s.t,
        s.score.toFixed(4),
        s.alerting ? 1 : 0,
        ...fingerCols,
      ].join(",");
    });

    return [header.join(","), ...rows].join("\n");
  }

  /** Full structured session: summary + both streams. */
  toJSON(now: number) {
    return {
      startedAt: this.startedAt,
      summary: this.summary(now),
      bites: this.bites,
      postures: this.postures,
      samples: this.samples,
    };
  }
}

/** Format a millisecond duration as M:SS for the UI. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
