import { makeCanvas } from './kit';

/** Máscara de clima limitada à silhueta; o retângulo transparente do bake não tinge o céu. */
export function layerTint(source: HTMLCanvasElement, color: string) {
  const c = makeCanvas(source.width,source.height), g = c.getContext('2d')!;
  g.drawImage(source,0,0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0,0,c.width,c.height);
  g.globalCompositeOperation = 'source-over';
  return c;
}
