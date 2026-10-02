import { captureProfile, applyProfile, hasProgress, mergeRecords, validateProfile, type ProfileData } from './profile';
import { currentProfile, setProfile, onPersist, readStored, writeStored, profileKey } from './persistence';
import { reloadProgress } from './storage';
import { record, integer } from './saveValidation';

export interface CloudUser { uid: string; email: string | null }
export interface RemoteSave { revision: number; data: ProfileData }
export interface CloudTransport {
  userChanged(fn: (user: CloudUser | null) => void): () => void;
  login(): Promise<void>;
  logout(): Promise<void>;
  read(uid: string): Promise<RemoteSave | null>;
  write(uid: string, data: ProfileData, expectedRevision: number): Promise<number>;
}
export type CloudState = 'unconfigured' | 'loading' | 'guest' | 'syncing' | 'saved' | 'pending' | 'conflict' | 'error';
interface Baseline { revision: number; payload: string }
function validateBaseline(v: unknown): Baseline | null {
  return record(v) && integer(v.revision) && typeof v.payload === 'string' ? { revision: v.revision as number, payload: v.payload } : null;
}
const fingerprint = (p: ProfileData) => JSON.stringify(p);
export class CloudSaves {
  state: CloudState = 'unconfigured';
  user: CloudUser | null = null;
  message = 'Seu progresso fica neste aparelho. Baixe um backup para guardá-lo.';
  conflict: { local: ProfileData; remote: RemoteSave } | null = null;
  private adapter: CloudTransport | null = null;
  private hooks = { beforeSwitch: () => {}, changed: () => {}, safeToApply: () => true };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private busy = false;
  private applying = false;
  private queued = false;
  private base: Baseline | null = null;
  get available() { return this.adapter !== null; }

  constructor() {
    onPersist(key => {
      if (this.applying || !this.user || !/karimbolandia\.(save|progress)\.v1/.test(key)) return;
      this.schedule();
    });
  }
  configureHooks(hooks: typeof this.hooks) { this.hooks = hooks; }
  subscribe(fn: () => void) { this.listeners.add(fn); fn(); return () => { this.listeners.delete(fn); }; }
  private status(state: CloudState, message: string) { this.state = state; this.message = message; for (const fn of this.listeners) fn(); }
  async initialize(baseUrl: string) {
    let config: unknown;
    try {
      const env = import.meta.env.VITE_FIREBASE_CONFIG;
      config = env ? JSON.parse(env) : await fetch(`${baseUrl}cloud-config.json`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null);
      if (!record(config) || config.enabled === false) return;
      if (typeof config.apiKey !== 'string' || !config.apiKey || typeof config.projectId !== 'string' || !/^[a-z0-9-]+$/.test(config.projectId) || typeof config.authDomain !== 'string' || !/^[a-z0-9-]+\.firebaseapp\.com$/.test(config.authDomain)) throw new Error('Configuração de contas inválida.');
      this.status('loading', 'Preparando o acesso à conta...');
      const { createFirebaseTransport } = await import('./firebaseCloud');
      this.connect(await createFirebaseTransport(config));
      window.addEventListener('online', () => { void this.sync(); });
      // Sem listeners Firestore contínuos: uma checagem ao retornar ao jogo.
      document.addEventListener('visibilitychange', () => { if (!document.hidden) void this.sync(); });
    } catch { this.status('error', 'O serviço de contas não está disponível. O backup local continua funcionando.'); }
  }
  connect(adapter: CloudTransport) {
    this.adapter = adapter;
    this.status('guest', 'Entre com Google para guardar seu progresso na sua conta.');
    adapter.userChanged(user => { void this.changeUser(user); });
  }
  private async changeUser(user: CloudUser | null) {
    // A primeira leitura da autenticação não deve interromper uma partida de visitante.
    if (!user && !this.user && !currentProfile()) {
      this.status('guest', 'Entre com Google para guardar seu progresso na sua conta.');
      return;
    }
    ++this.generation;
    this.cancelTimer();
    this.conflict = null;
    this.hooks.beforeSwitch();
    const oldScope = currentProfile();
    const guest = !oldScope ? captureProfile() : null;
    this.user = user;
    this.applying = true;
    if (user) {
      setProfile(user.uid);
      reloadProgress();
      // Só oferece o progresso de visitante. Nunca importa a conta anterior.
      if (guest && hasProgress(guest) && !hasProgress(captureProfile())) applyProfile(guest);
      this.base = readStored(profileKey('karimbolandia.cloud-base.v1'), validateBaseline);
    } else {
      setProfile('');
      reloadProgress();
      this.base = null;
    }
    this.applying = false;
    this.hooks.changed();
    if (user) { this.status('pending', 'Conta conectada. Conferindo seu save...'); await this.sync(); }
    else this.status('guest', 'Jogando como visitante. O progresso desta conta foi preservado neste aparelho.');
  }
  async login() {
    if (!this.adapter) return;
    try { await this.adapter.login(); }
    catch (error) {
      const code = record(error) ? error.code : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      this.status('error', code === 'auth/popup-blocked' ? 'Permita a janela de login e tente novamente.' : 'Não foi possível entrar. Seu progresso local está preservado.');
    }
  }
  async logout() {
    if (!this.adapter) return;
    // Não bloqueia a saída em uma conexão ruim; o perfil pendente fica no aparelho.
    try { await this.adapter.logout(); } catch { this.status('error', 'Não foi possível sair da conta. Tente novamente.'); }
  }
  private cancelTimer() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
  private schedule() {
    if (!this.user) { this.queued = false; this.cancelTimer(); return; }
    if (this.state === 'conflict') return;
    this.queued = true;
    this.status('pending', 'Progresso salvo no aparelho; aguardando envio para a conta.');
    this.cancelTimer();
    this.timer = setTimeout(() => { this.timer = null; void this.sync(); }, 1800);
  }
  private acceptBase(revision: number, data: ProfileData) {
    this.base = { revision, payload: fingerprint(data) };
    this.applying = true;
    writeStored(profileKey('karimbolandia.cloud-base.v1'), this.base, validateBaseline);
    this.applying = false;
  }
  private showConflict(local: ProfileData, remote: RemoteSave) {
    this.conflict = { local, remote };
    this.status('conflict', 'Há progresso diferente neste aparelho e na conta. Escolha qual partida continuar; os melhores recordes serão mantidos.');
  }
  async sync() {
    if (!this.adapter || !this.user || this.state === 'conflict') return;
    if (this.busy) { this.queued = true; return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.status('pending', 'Sem internet. Seu save fica no aparelho e será enviado quando a conexão voltar.'); return; }
    this.busy = true;
    this.queued = false;
    const adapter = this.adapter, uid = this.user.uid, generation = this.generation;
    const local = captureProfile(), payload = fingerprint(local), base = this.base;
    this.status('syncing', 'Sincronizando seu progresso...');
    try {
      const remote = await adapter.read(uid);
      if (generation !== this.generation) return;
      if (fingerprint(captureProfile()) !== payload) { this.queued = true; return; }
      if (remote && fingerprint(remote.data) === payload) this.acceptBase(remote.revision, local);
      else if (remote && (!base || remote.revision !== base.revision)) {
        const clean = base ? base.payload === payload : !hasProgress(local);
        if (!clean || !this.hooks.safeToApply()) { this.showConflict(local, remote); return; }
        this.applying = true;
        applyProfile(remote.data);
        this.applying = false;
        this.acceptBase(remote.revision, remote.data);
        this.hooks.changed();
      } else {
        const revision = await adapter.write(uid, local, remote?.revision ?? 0);
        if (generation !== this.generation) return;
        this.acceptBase(revision, local);
      }
      if (fingerprint(captureProfile()) !== this.base?.payload) this.queued = true;
      else this.status('saved', 'Progresso salvo na sua conta. Você pode continuar em outro aparelho.');
    } catch {
      if (generation === this.generation) this.status('error', 'O envio não foi confirmado. Seu progresso fica no aparelho; tente sincronizar novamente.');
    } finally {
      this.applying = false;
      this.busy = false;
      // Uma troca de conta invalida resultados antigos, mas a nova conta ainda precisa sincronizar.
      if (this.queued || generation !== this.generation) this.schedule();
    }
  }
  async resolveConflict(choice: 'local' | 'remote') {
    if (!this.conflict || !this.adapter || !this.user || this.busy) return;
    const { remote } = this.conflict;
    const local = captureProfile();
    const selected = choice === 'local' ? local : remote.data;
    const data: ProfileData = { ...selected, progress: mergeRecords(local.progress, remote.data.progress) };
    const uid = this.user.uid, generation = this.generation;
    this.busy = true;
    this.status('syncing', 'Guardando a partida escolhida...');
    try {
      const revision = await this.adapter.write(uid, data, remote.revision);
      if (generation !== this.generation) return;
      if (fingerprint(captureProfile()) !== fingerprint(local)) {
        this.queued = true;
        this.status('pending', 'Surgiu progresso novo no aparelho. Conferindo novamente para preservar as duas partidas.');
        return;
      }
      this.hooks.beforeSwitch();
      this.applying = true;
      applyProfile(data);
      this.applying = false;
      this.acceptBase(revision, data);
      this.conflict = null;
      this.hooks.changed();
      this.status('saved', 'Partida escolhida salva na sua conta.');
    } catch {
      if (generation === this.generation) {
        this.conflict = null;
        this.status('error', 'O save da conta mudou ou a conexão falhou. Confira novamente antes de escolher.');
      }
    } finally {
      this.applying = false;
      this.busy = false;
      if (this.queued || generation !== this.generation) this.schedule();
    }
  }
}
export const cloudSaves = new CloudSaves();
