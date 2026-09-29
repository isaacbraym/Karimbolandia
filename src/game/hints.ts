/** Dicas contextuais (aparecem uma vez), variando conforme o dispositivo de entrada. */
export type Device = 'kb' | 'touch' | 'pad';

const H: Record<string, Record<Device, string>> = {
  move: { kb: 'Mova-se com A/D ou ← →', touch: 'Arraste o joystick à esquerda para andar', pad: 'Analógico esquerdo para andar' },
  shoot: { kb: 'Clique (ou J) para atirar — mire com o mouse', touch: 'Segure FOGO para atirar • empurre o joystick p/ cima para mirar', pad: 'X ou RT para atirar' },
  jump: { kb: 'ESPAÇO para pular — solte para pular mais baixo', touch: 'Toque em PULO • segure para pular mais alto', pad: 'A para pular' },
  glide: { kb: 'No ar, aperte PULO de novo e segure: as ORELHAS planam!', touch: 'No ar, toque em PULO de novo e segure: as ORELHAS planam!', pad: 'No ar, aperte A de novo e segure: as ORELHAS planam!' },
  nomad: { kb: 'Segure o gatilho: as duas shotguns disparam juntas!', touch: 'FOGO dispara as duas shotguns ao mesmo tempo!', pad: 'X/RT dispara as duas shotguns!' },
  dash: { kb: 'SHIFT: AVANÇO — atropele tudo pela frente!', touch: 'Botão ⚡ : AVANÇO — atropele tudo pela frente!', pad: 'Y: AVANÇO — atropele tudo pela frente!' },
  crouch: { kb: 'Segure S / ↓ para engatinhar', touch: 'Empurre o joystick para baixo para engatinhar', pad: 'Analógico para baixo para engatinhar' },
};

export function hintText(key: string, dev: Device): string | null {
  return H[key]?.[dev] ?? null;
}
