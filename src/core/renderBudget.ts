import type { Quality } from '../art';

const DESKTOP_H:Record<Quality,number>={low:540,medium:720,high:960};
const MOBILE_H:Record<Quality,number>={low:432,medium:540,high:720};
/** Cap raster work independently of a phone's physical resolution/DPR. */
export function targetRenderHeight(cssH:number,dpr:number,quality:Quality,mobile:boolean) {
  return Math.max(360,Math.min(cssH*Math.max(1,dpr),(mobile?MOBILE_H:DESKTOP_H)[quality]));
}
export function backingSize(viewW:number,viewH:number,targetH:number,scale:number) {
  const pxScale=targetH/viewH*Math.max(.5,Math.min(1,scale));
  return {pxScale,width:Math.round(viewW*pxScale),height:Math.round(viewH*pxScale)};
}
/** Assigning even the same canvas size destroys its backing buffer and drawing state. */
export function resizeBacking(canvas:Pick<HTMLCanvasElement,'width'|'height'>,width:number,height:number) {
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
}
