/** Limit expensive frames without tying simulation speed to the display refresh rate. */
export class FramePacer {
  private next=NaN;
  private presented=NaN;
  private fps=0;
  reset(now:number) { this.next=NaN;this.presented=now; }
  take(now:number,fps=60):number|null {
    if(!Number.isFinite(now))return null;
    const interval=1000/fps;
    if(!Number.isFinite(this.next)||fps!==this.fps||now<this.presented||now-this.presented>250) {
      this.fps=fps;this.presented=now;this.next=now+interval;return 0;
    }
    // Small timestamp jitter must not turn 60 Hz into 30 Hz. Keep the phase, not now+interval.
    const tolerance=.35;
    if(now+tolerance<this.next)return null;
    const elapsed=now-this.presented;
    this.next+=(Math.floor((now-this.next+tolerance)/interval)+1)*interval;
    this.presented=now;
    return elapsed;
  }
}
