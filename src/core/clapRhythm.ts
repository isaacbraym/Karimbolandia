/** Two low claps, one bright accent, then a rest. Shared by sound and hands. */
export const CLAP_STEP = .3;
export function clapTick(time:number) { return Math.floor((time+1e-9)/CLAP_STEP); }
export function clapTone(tick:number): 'clap'|'clapAccent'|null {
  const beat=((tick%4)+4)%4;
  return beat===3?null:beat===2?'clapAccent':'clap';
}
/** Hands meet on the three hits and stay apart through the final rest. */
export function clapOpen(time:number) {
  const period=CLAP_STEP*4, phase=((time%period)+period)%period;
  const distance=Math.min(phase,Math.abs(phase-CLAP_STEP),Math.abs(phase-CLAP_STEP*2),period-phase);
  return Math.min(1,distance/.12);
}
