/** Interior autorado em perspectiva: nenhuma silhueta/avatar do jogador. Renderizado uma vez por visita. */
export function cabinScene(index:number):string {
  const wall=['#775143','#596458','#725343'][index%3];
  const boards=Array.from({length:18},(_,i)=>`<path d="M${102+i*43} 45v270" stroke="#302c28" opacity=".27"/><path d="M${107+i*43} 45v270" stroke="#cda277" opacity=".09"/>`).join('');
  const floor=Array.from({length:13},(_,i)=>`<path d="M480 260L${-240+i*120} 560" stroke="#241f1d" opacity=".38"/>`).join('');
  return `<svg class="cabin-art" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="room-wall" x2="0" y2="1"><stop stop-color="${wall}"/><stop offset="1" stop-color="#302c2b"/></linearGradient>
    <linearGradient id="room-floor" x2="0" y2="1"><stop stop-color="#714d34"/><stop offset="1" stop-color="#2b2a28"/></linearGradient>
    <radialGradient id="room-light"><stop stop-color="#ffe8a0" stop-opacity=".35"/><stop offset="1" stop-color="#ffd07c" stop-opacity="0"/></radialGradient>
    <linearGradient id="room-window" x2="0" y2="1"><stop stop-color="#abcfa6"/><stop offset="1" stop-color="#436d68"/></linearGradient>
    <linearGradient id="room-metal" x2="0" y2="1"><stop stop-color="#a5b8b2"/><stop offset=".35" stop-color="#435953"/><stop offset=".7" stop-color="#283c3a"/><stop offset="1" stop-color="#798c7b"/></linearGradient>
    <pattern id="room-grain" width="47" height="37" patternUnits="userSpaceOnUse"><path d="M0 9q18-8 38 1M4 30q11-5 40 0" fill="none" stroke="#e5c594" stroke-width=".6" opacity=".13"/><circle cx="22" cy="16" r="1" fill="#211e1b" opacity=".3"/></pattern>
  </defs>
  <path d="M0 0H960V540H0Z" fill="#202c2b"/>
  <path d="M100 45H860V320H100Z" fill="url(#room-wall)"/>
  <path d="M0 0L100 45V320L0 437Z" fill="#41352f"/><path d="M960 0L860 45V320L960 437Z" fill="#302e2c"/>
  <path d="M0 0H960L860 45H100Z" fill="#282927"/>
  <path d="M100 320H860L960 437V540H0V437Z" fill="url(#room-floor)"/>
  ${boards}${floor}<path d="M100 45H860V320H100Z" fill="url(#room-grain)"/>
  <g fill="none" stroke="#1c2423" stroke-width="13"><path d="M100 40V322H860V40M0 8L480 45L960 8"/><path d="M100 105H860" stroke-width="6"/></g>
  <path d="M0 430L100 317H860L960 430" fill="none" stroke="#a18056" stroke-width="5" opacity=".6"/>
  <!-- janela: floresta, ponte e um fio azul que liga o interior à aldeia -->
  <g stroke="#232c28" stroke-width="7"><rect x="571" y="91" width="147" height="157" rx="4" fill="url(#room-window)"/>
    <path d="M575 196L606 143L631 180L664 128L716 191V244H575Z" fill="#466b51" stroke="none"/>
    <path d="M575 219Q616 208 645 228T715 223V244H575Z" fill="#7aa6a1" stroke="none"/>
    <path d="M577 188L714 175M609 118v127M668 118v127" stroke="#334e3a" stroke-width="3"/>
    <path d="M645 92v154M573 163h142"/><path d="M718 92l-19 51 12 33" stroke="#71ac64" stroke-width="4"/>
  </g><path d="M581 102L720 249L606 313L389 313Z" fill="#d9e1a2" opacity=".08"/>
  <!-- tecido confiscado, marcas de contagem e mapa rabiscado -->
  <path d="M300 80L335 88L327 208L292 202Z" fill="#c39c57"/><path d="M301 107l30 6m-32 30l29 6m-31 31l29 6" stroke="#6eb2bd" stroke-width="8"/>
  <path d="M301 80l3-6m18 10l4-8" stroke="#d7b276" stroke-width="2"/>
  <path d="M543 112l7 30m1-33l7 29m1-34l7 29m-26-9l34-3" stroke="#c1ad89" stroke-width="2" opacity=".5"/>
  <!-- retrato satírico, medalha e bigode -->
  <rect x="408" y="65" width="117" height="137" rx="3" fill="#342922" stroke="#b58d50" stroke-width="8"/>
  <path d="M418 79H515V191H418Z" fill="#607468"/><path d="M426 188q8-45 40-43 34 1 39 43" fill="#434d38"/>
  <ellipse cx="466" cy="122" rx="26" ry="32" fill="#c98e65"/><path d="M435 106l5-23 51-2 9 25Z" fill="#38472e"/>
  <path d="M445 130q21-15 43 0q-21 14-43 0" fill="#312d29"/><path d="M450 119h5m24 0h5" stroke="#292720" stroke-width="3"/>
  <path d="M466 97l-4-7 5-8 6 8Z" fill="#efd084"/><circle cx="490" cy="171" r="9" fill="#d6b662"/>
  <text x="466" y="214" fill="#c8ad75" font-size="9" text-anchor="middle">PRESENÇA CONFIRMADA</text>
  <!-- mesa, rádio vintage, antena e estante de bebidas -->
  <ellipse cx="236" cy="450" rx="145" ry="25" fill="#161f1d" opacity=".55"/>
  <path d="M98 316L285 310L310 365L113 371Z" fill="#a27b50" stroke="#272b25" stroke-width="5"/>
  <path d="M113 371H298V439L115 459Z" fill="#594837" stroke="#272b25" stroke-width="4"/>
  <g class="cabin-drawer"><path d="M120 382H232V417L120 425Z" fill="#806343" stroke="#332f28" stroke-width="3"/><path d="M159 402h30" stroke="#d0ab68" stroke-width="4"/></g>
  <g class="cabin-drawer-loot"><path d="M124 378h104v15H124Z" fill="#242d25"/><path d="M135 383h7m9 0h7m9 0h7m9 0h7m9 0h7" stroke="#d8b46d" stroke-width="7"/></g>
  <path d="M116 441v54m174-62v45" stroke="#342e28" stroke-width="13"/>
  <path d="M126 230l117-4 14 20-126 5Z" fill="#806245"/><rect x="132" y="193" width="117" height="45" rx="6" fill="#778376" stroke="#292e2b" stroke-width="4"/>
  <path d="M150 193l-13-48" stroke="#acb6a0" stroke-width="2"/>
  <rect x="146" y="201" width="47" height="26" rx="3" fill="#2b3934"/><path d="M150 207h39m-39 5h39m-39 6h39" stroke="#73847b" stroke-width="2"/>
  <rect x="202" y="200" width="35" height="9" fill="#d7ba73"/><path d="M207 204h3m5 0h3m5 0h3" stroke="#49533f"/><circle cx="220" cy="222" r="7" fill="#bba575" stroke="#37473f" stroke-width="2"/>
  <path d="M131 274h11v20l7 7v40h-25v-40l7-7Z" fill="#78844c" stroke="#2c342a" stroke-width="3"/>
  <path d="M161 295h13v18l8 7v27h-28v-27l7-7Z" fill="#976c43" stroke="#2c342a" stroke-width="3"/>
  <rect x="128" y="316" width="19" height="15" fill="#dac38d"/><text x="138" y="327" font-size="7" text-anchor="middle" fill="#514230">70%</text>
  <path d="M186 317h20l-3 23h-13Z" fill="#bfb2a0"/>
  <!-- revista na mesa de centro, caneca, carta e migalhas -->
  <ellipse cx="475" cy="464" rx="213" ry="25" fill="#162321" opacity=".55"/>
  <path d="M288 337L619 334L697 409L247 421Z" fill="#a57d53" stroke="#282b26" stroke-width="5"/>
  <path d="M247 421L697 409v20L247 441Z" fill="#5d4433"/>
  <path d="M289 435l-5 81m358-89l12 74" stroke="#4c3c2b" stroke-width="18"/>
  <path d="M279 354L372 347L409 396L301 408Z" fill="#d0a47c" stroke="#49372e" stroke-width="2"/>
  <path d="M284 359L367 353L378 367L295 375Z" fill="#72554b"/><text x="293" y="369" fill="#ffdeb0" font-size="9" transform="rotate(-5 293 369)">MERCENÁRIO</text>
  <path d="M318 382l11-7 25 2 15 14-40 6Z" fill="#544c36"/><path d="M380 384l9 11m-17-10l9 12" stroke="#faf0c8"/>
  <path d="M581 355L644 352L671 380L602 389Z" fill="#dfd1a2"/><path d="M600 360l37-2m-32 9l36-2m-26 9l34-2" stroke="#76715a" stroke-width="2"/>
  <path d="M599 332h34v26q-17 14-34 0Z" fill="#658a78" stroke="#283e35" stroke-width="3"/>
  <path d="M633 335q23-2 18 16q-3 8-17 6" fill="none" stroke="#658a78" stroke-width="6"/>
  <path d="M610 322q-8-12 1-18m10 17q-6-14 3-21" fill="none" stroke="#e2d9b4" opacity=".22" stroke-width="2"/>
  <path d="M470 366l11 2m-5 14l6-1m39 11l7-2" stroke="#d7be81" stroke-width="3"/>
  <!-- armeiro: madeira, arma de metal com pequenas peças e cabos identificáveis -->
  <path d="M746 127H854V275H746Z" fill="#554536" stroke="#2a2f29" stroke-width="5"/>
  <path d="M754 171h92m-92 61h92" stroke="#ae8956" stroke-width="8"/>
  <g transform="translate(772 145) rotate(10)"><path d="M0 0h10v92H-2V33h-6V18h8Z" fill="url(#room-metal)" stroke="#1a2927" stroke-width="2"/><path d="M-5 60H9v40H-7Z" fill="#946442"/><path d="M-3 41h7v17h-7Z" fill="#788377"/><path d="M4 10h20v6H4Z" fill="#afbab0"/></g>
  <g transform="translate(817 147) rotate(-7)"><path d="M0 0h7v93h-7Z" fill="url(#room-metal)" stroke="#202a28" stroke-width="2"/><path d="M-3 52h13v18H-3Z" fill="#9f805a"/><path d="M-5 89H8v19H-5Z" fill="#665338"/></g>
  <text x="800" y="292" fill="#c4b387" font-size="8" text-anchor="middle">PREENCHA O FORMULÁRIO ANTES</text>
  <!-- baú de reserva: tampa metálica, rebites e meias -->
  <ellipse cx="782" cy="484" rx="103" ry="17" fill="#15221e" opacity=".6"/>
  <path d="M713 405L816 392L859 416L746 434Z" fill="#697552" stroke="#26312a" stroke-width="4"/>
  <path d="M746 434L859 416V472L746 488Z" fill="#43543a" stroke="#26312a" stroke-width="4"/>
  <path d="M713 405L746 434V488L711 458Z" fill="#586045" stroke="#26312a" stroke-width="4"/>
  <path d="M773 431v51m44-57v51" stroke="#ac9c71" stroke-width="8"/><rect x="790" y="451" width="13" height="15" rx="2" fill="#d3b272"/>
  <path d="M729 402l9-26 18 6-7 18 13 8-8 9Z" fill="#bab2a0" stroke="#58594b" stroke-width="2"/>
  <path d="M710 449h17m-13 5h13" stroke="#bcae83" stroke-width="2"/>
  <!-- lanterna, mosquiteiro, botas, cipós e luz volumétrica -->
  <path d="M368 45v43" stroke="#d9bd73" stroke-width="2"/><path d="M357 90h22l4 35h-31Z" fill="#c9a657" stroke="#2e3026" stroke-width="3"/>
  <path d="M359 100h18v18h-18Z" fill="#ffe4a1"/><ellipse cx="369" cy="144" rx="201" ry="178" fill="url(#room-light)"/>
  <path d="M98 47l21 64 31-29 18 28m693-64l-23 89 29 24" fill="none" stroke="#3f6946" stroke-width="6"/>
  <path d="M21 84q16-18 28-7m-18 36q24-10 31 8m869-54q-18-16-30-2" fill="none" stroke="#78a65d" stroke-width="10"/>
  <path d="M365 451h17v27l14 5v13h-32Z M410 453h17v24l14 5v14h-32Z" fill="#383e32" stroke="#202925" stroke-width="3"/>
  <path d="M105 46L850 45" stroke="#e5cfaa" opacity=".3"/><path d="M804 53l46 57m-28-57l28 27m-10-27l10 9" stroke="#c0baaa" opacity=".18"/>
  <path d="M0 0H960V540H0Z" fill="none" stroke="#111d1c" stroke-width="30" opacity=".35"/>
  </svg>`;
}
