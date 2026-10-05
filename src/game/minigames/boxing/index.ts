/** Boxe em 3ª pessoa (T8). Provisório da T6: sessão mínima que só termina por abandono. */
import type { MinigameContext, MinigameModule, MinigameSession } from '../types';

class Placeholder implements MinigameSession {
  done = false;
  update() { /* implementado na T8 */ }
  draw(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = '#10142a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.font = '16px sans-serif';
    g.textAlign = 'center';
    g.fillText('BOXE — em construção', W / 2, H / 2);
  }
  resize() { /* nada */ }
  result() { return null; }
  dispose() { /* nada */ }
}
export const create: MinigameModule['create'] = (_ctx: MinigameContext) => new Placeholder();
export default { create } satisfies MinigameModule;
