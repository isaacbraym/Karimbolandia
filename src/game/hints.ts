/** Dicas contextuais (aparecem uma vez), variando conforme o dispositivo de entrada. */
export type Device = 'kb' | 'touch' | 'pad';

const H: Record<string, Record<Device, string>> = {
  interceptGrenade: { kb: 'Granada laranja no ar? Atire nela para neutralizar!', touch: 'Mire FOGO na granada laranja para neutralizar!', pad: 'Mire e atire na granada laranja para neutralizar!' },
  move: { kb: 'Mova-se com A/D ou ← →', touch: 'Arraste o joystick à esquerda para andar', pad: 'Analógico esquerdo para andar' },
  shoot: { kb: 'Clique (ou J) para atirar — mire com o mouse', touch: 'Segure FOGO para atirar • ARRASTE o botão FOGO para mirar em qualquer direção', pad: 'X ou RT para atirar' },
  jump: { kb: 'ESPAÇO para pular — solte para pular mais baixo', touch: 'Toque em PULO • segure para pular mais alto', pad: 'A para pular' },
  glide: { kb: 'No ar, aperte PULO de novo e segure: as ORELHAS planam!', touch: 'No ar, toque em PULO de novo e segure: as ORELHAS planam!', pad: 'No ar, aperte A de novo e segure: as ORELHAS planam!' },
  nomad: { kb: 'Segure o gatilho: as duas shotguns disparam juntas!', touch: 'FOGO dispara as duas shotguns ao mesmo tempo!', pad: 'X/RT dispara as duas shotguns!' },
  dash: { kb: 'SHIFT: AVANÇO — atropele tudo pela frente!', touch: 'Botão ⚡ : AVANÇO — atropele tudo pela frente!', pad: 'Y: AVANÇO — atropele tudo pela frente!' },
  mountNomad: { kb: 'Pule em cima do NÔMAD para pilotá-lo!', touch: 'Pule em cima do NÔMAD para pilotá-lo!', pad: 'Pule em cima do NÔMAD para pilotá-lo!' },
  swap: { kb: 'Munição é limitada! Troque de arma com Q / E ou a roda do mouse', touch: 'Munição é limitada! Troque de arma no botão ⇄', pad: 'Munição é limitada! Troque de arma com LB / RB' },
  slam: { kb: 'No ar: S + ESPAÇO = ORELHADA (mergulho com onda de choque)!', touch: 'No ar: joystick p/ baixo + PULO = ORELHADA!', pad: 'No ar: baixo + A = ORELHADA (onda de choque)!' },
  melee: { kb: 'Inimigo colado? O tiro vira GOLPE (sem gastar munição, atravessa escudos)', touch: 'Inimigo colado? FOGO vira GOLPE (atravessa escudos)', pad: 'Inimigo colado? O tiro vira GOLPE (atravessa escudos)' },
  swim: { kb: "Debaixo d'água: ESPAÇO dá braçadas • W/S sobe e desce • na superfície, ESPAÇO pula para fora", touch: "Debaixo d'água: PULO dá braçadas • joystick sobe e desce • na superfície, PULO salta para fora", pad: "Debaixo d'água: A dá braçadas • analógico sobe e desce" },
  swing: { kb: 'Cipó: ← → balança, W/S sobe e desce, ESPAÇO solta com impulso', touch: 'Cipó: joystick balança e sobe/desce, PULO solta com impulso', pad: 'Cipó: analógico balança, A solta com impulso' },
  quicksand: { kb: 'Areia movediça! Aperte ESPAÇO várias vezes para se soltar', touch: 'Areia movediça! Toque em PULO várias vezes para se soltar', pad: 'Areia movediça! Aperte A várias vezes para se soltar' },
  door: { kb: 'Na porta do templo, aperte ↑ (W) para entrar', touch: 'Na porta do templo, empurre o joystick para cima para entrar', pad: 'Na porta do templo, analógico para cima para entrar' },
  crouch: { kb: 'Segure S / ↓ para engatinhar', touch: 'Empurre o joystick para baixo para engatinhar', pad: 'Analógico para baixo para engatinhar' },
};

export function hintText(key: string, dev: Device): string | null {
  return H[key]?.[dev] ?? null;
}
