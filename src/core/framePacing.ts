/**
 * Limit expensive frames without tying simulation speed to the display refresh rate.
 *
 * Telas múltiplas do alvo (60/120/240 Hz): conta vsyncs inteiros desde o último quadro aceito, então
 * o jitter dos carimbos do rAF (±0,3 ms) e a deriva de uma tela a 120,016 Hz não geram mais quadros
 * de 25/33 ms. Telas não múltiplas (90/144 Hz): mantém a média de 60 pela agenda ideal, com tolerância
 * de quase meio vsync (escolhe o vsync mais próximo do horário ideal).
 */
export class FramePacer {
  private presented=NaN;
  private prev=NaN;
  private next=NaN;
  private fps=0;
  /** últimos intervalos de rAF plausíveis; o período da tela é o MENOR deles (o rAF nunca vem antes do vsync) */
  private deltas=new Float64Array(32);
  private deltaCount=0;
  private deltaIndex=0;
  /** Intervalo real (ms) até o quadro aceito anterior, inclusive pausas >250 ms; NaN logo após reset. */
  raw=NaN;
  reset(now:number) { this.presented=NaN;this.next=NaN;this.prev=now;this.raw=NaN; }
  /**
   * Período estimado da tela (ms) ou NaN antes de qualquer amostra: média do grupo de intervalos
   * mais curtos (até 1,5× o menor). Quadros atrasados pela GPU (2–3 vsyncs) não puxam a estimativa.
   */
  get vsync() {
    let m=Infinity;
    for(let i=0;i<this.deltaCount;i++)if(this.deltas[i]<m)m=this.deltas[i];
    if(!Number.isFinite(m))return NaN;
    let sum=0,count=0;
    for(let i=0;i<this.deltaCount;i++)if(this.deltas[i]<m*1.5){sum+=this.deltas[i];count++;}
    return sum/count;
  }
  take(now:number,fps=60):number|null {
    if(!Number.isFinite(now))return null;
    const interval=1000/fps;
    const d=now-this.prev;
    this.prev=now;
    if(d>2&&d<50) {
      this.deltas[this.deltaIndex]=d;
      this.deltaIndex=(this.deltaIndex+1)%this.deltas.length;
      this.deltaCount=Math.min(this.deltaCount+1,this.deltas.length);
    }
    if(!Number.isFinite(this.presented)||fps!==this.fps||now<this.presented||now-this.presented>250) {
      // começo, troca de estado ou pausa longa: não tenta recuperar quadros; a física recebe 0
      this.raw=Number.isFinite(this.presented)&&now>=this.presented&&fps===this.fps?now-this.presented:NaN;
      this.fps=fps;this.presented=now;this.next=now+interval;return 0;
    }
    const vs=this.vsync,v=Number.isFinite(vs)?vs:interval;
    const elapsed=now-this.presented;
    const ratio=interval/v,n=Math.round(ratio);
    if(n>=1&&Math.abs(ratio-n)<.06*n) {
      if(elapsed<(n-.5)*v)return null;
    } else {
      if(now<this.next-v*.45)return null;
    }
    this.next=Math.max(this.next+interval,now+interval-v*.45);
    this.presented=now;this.raw=elapsed;
    return elapsed;
  }
}
