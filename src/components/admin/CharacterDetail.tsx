import { useEffect, useState, type FormEvent } from 'react';
import { ADMIN_IMAGE_MAX_BYTES, type AdminCharacterDetail, type CharacterEdit } from '../../game/admin';
import { useI18n } from '../../i18n';
import { editCharacter, fetchCharacter, uploadCharacterImage } from './api';
import { CharacterBadges, CharacterThumb } from './CharactersPanel';
import { actionText, dateTimeText, errorText } from './format';

/** Tamanho das imagens do jogo (3:4), o mesmo de scripts/lib/images.mjs. */
const IMAGE_WIDTH = 240;
const IMAGE_HEIGHT = 320;

/** Como encaixar a imagem enviada em 3:4: cortar pelo topo, pelo centro, ou caber inteira (fundo transparente). */
type Fit = 'top' | 'center' | 'contain';

interface Converted {
  /** WebP em base64 (sem o prefixo data:), para enviar. */
  base64: string;
  /** data: URL para a prévia (a CSP do site libera data: em imagens). */
  preview: string;
  bytes: number;
}

/** Converte o arquivo escolhido no WebP 240×320 do jogo, no próprio navegador. */
async function toGameImage(file: File, fit: Fit): Promise<Converted> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const scale = (fit === 'contain' ? Math.min : Math.max)(IMAGE_WIDTH / bitmap.width, IMAGE_HEIGHT / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (IMAGE_WIDTH - w) / 2, fit === 'top' ? 0 : (IMAGE_HEIGHT - h) / 2, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob || blob.type !== 'image/webp') throw new Error('webp');
  const preview = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { base64: preview.slice(preview.indexOf(',') + 1), preview, bytes: blob.size };
}

/**
 * Edição de um personagem: poder, nome, obra, versão, fama, ativo e imagem. O que o admin muda vale na hora (no
 * servidor, em até 5 min em todos os isolates) e o `characters:sync` não sobrescreve; `characters:pull` traz para o JSON.
 */
export default function CharacterDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, lang } = useI18n();
  const [character, setCharacter] = useState<AdminCharacterDetail | null>(null);
  const [form, setForm] = useState<Required<CharacterEdit> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fit, setFit] = useState<Fit>('top');
  const [image, setImage] = useState<Converted | null>(null);

  const show = (c: AdminCharacterDetail) => {
    setCharacter(c);
    setForm({ name: c.name, series: c.series, version: c.version, tier: c.tier, power: c.power, active: c.active });
  };

  useEffect(() => {
    fetchCharacter(id)
      .then(show)
      .catch((err) => setError(errorText(err, lang)));
  }, [id]);

  // Prévia da imagem escolhida, refeita ao trocar o encaixe.
  useEffect(() => {
    if (!file) return setImage(null);
    let cancelled = false;
    toGameImage(file, fit).then(
      (converted) => !cancelled && setImage(converted),
      () => !cancelled && setError(t('admin.character.imageError')),
    );
    return () => {
      cancelled = true;
    };
  }, [file, fit]);

  const run = async (action: () => Promise<AdminCharacterDetail>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      show(await action());
      setSaved(true);
      return true;
    } catch (err) {
      setError(errorText(err, lang));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    if (!form || !character) return;
    // Só o que mudou (o servidor registra o antes e o depois de cada campo).
    const changed = Object.fromEntries(
      Object.entries(form).filter(([key, value]) => character[key as keyof CharacterEdit] !== value),
    ) as CharacterEdit;
    if (!Object.keys(changed).length) return;
    if (!form.active && character.active && !window.confirm(t('admin.character.deactivateConfirm', { name: character.name }))) return;
    run(() => editCharacter(id, changed));
  };

  const onUpload = async () => {
    if (!image) return;
    if (await run(() => uploadCharacterImage(id, image.base64))) setFile(null);
  };

  const set = <K extends keyof CharacterEdit>(key: K, value: Required<CharacterEdit>[K]) =>
    setForm((f) => f && { ...f, [key]: value });

  const powerValid = form !== null && Number.isFinite(form.power) && form.power >= 0 && form.power <= 100;

  return (
    <div className="admin-stack">
      <button className="btn btn-ghost btn-sm admin-back" onClick={onBack}>
        ← {t('admin.characters.back')}
      </button>
      {error && <p className="error">{error}</p>}
      {!character && !error && <p className="muted">{t('admin.loading')}</p>}
      {character && form && (
        <>
          <section className="panel admin-section admin-character-head">
            <CharacterThumb character={character} size={96} />
            <div>
              <h2 className="admin-player-title">
                {character.name} <span className="muted admin-small">{character.id}</span>
              </h2>
              <p className="muted admin-small">{character.series}</p>
              <CharacterBadges character={character} />
              {character.openReports > 0 && (
                <p className="error admin-small">{t('admin.character.reports', { n: character.openReports })}</p>
              )}
            </div>
          </section>

          <section className="panel admin-section">
            <h3 className="section-title">{t('admin.character.editTitle')}</h3>
            <form className="admin-form admin-character-form" onSubmit={onSave}>
              <label>
                <span className="muted admin-small">{t('admin.character.power')}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.1}
                  value={Number.isFinite(form.power) ? form.power : ''}
                  onChange={(e) => set('power', e.target.value === '' ? NaN : Number(e.target.value))}
                />
              </label>
              <label>
                <span className="muted admin-small">{t('admin.character.name')}</span>
                <input value={form.name} maxLength={60} onChange={(e) => set('name', e.target.value)} />
              </label>
              <label>
                <span className="muted admin-small">{t('admin.character.series')}</span>
                <input value={form.series} maxLength={80} onChange={(e) => set('series', e.target.value)} />
              </label>
              <label>
                <span className="muted admin-small">{t('admin.character.version')}</span>
                <input value={form.version ?? ''} maxLength={80} onChange={(e) => set('version', e.target.value || null)} />
              </label>
              {character.category !== 'pokemon' && (
                <label>
                  <span className="muted admin-small">{t('admin.character.tier')}</span>
                  <select value={form.tier ?? 1} onChange={(e) => set('tier', Number(e.target.value) as 1 | 2 | 3)}>
                    {([1, 2, 3] as const).map((n) => (
                      <option key={n} value={n}>
                        {t(`admin.character.tier${n}`)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="admin-check">
                <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
                <span>{t('admin.character.active')}</span>
              </label>
              <button className="btn btn-primary btn-sm" disabled={busy || !powerValid || !form.name.trim() || !form.series.trim()}>
                {t('common.save')}
              </button>
            </form>
            <p className="muted admin-small">{t('admin.character.hint')}</p>
            {saved && <p className="muted admin-small">{t('admin.character.saved')}</p>}
          </section>

          <section className="panel admin-section">
            <h3 className="section-title">{t('admin.character.imageTitle')}</h3>
            <p className="muted admin-small">{t('admin.character.imageHint')}</p>
            <div className="admin-form">
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label={t('admin.character.imageFile')} />
              <div className="shop-filter" role="radiogroup" aria-label={t('admin.character.fit')}>
                {(['top', 'center', 'contain'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={fit === f}
                    className={`shop-filter-option${fit === f ? ' selected' : ''}`}
                    onClick={() => setFit(f)}
                  >
                    {t(`admin.character.fit.${f}`)}
                  </button>
                ))}
              </div>
            </div>
            {image && (
              <div className="admin-image-preview">
                <img src={image.preview} alt="" width={IMAGE_WIDTH / 2} height={IMAGE_HEIGHT / 2} />
                <span className="muted admin-small">{(image.bytes / 1024).toFixed(1)} KB</span>
                <button className="btn btn-primary btn-sm" onClick={onUpload} disabled={busy || image.bytes > ADMIN_IMAGE_MAX_BYTES}>
                  {t('admin.character.imageUpload')}
                </button>
              </div>
            )}
          </section>

          <section className="panel admin-section">
            <h3 className="section-title">{t('admin.character.history')}</h3>
            {!character.history.length && <p className="muted">{t('admin.none')}</p>}
            <ul className="admin-list admin-small">
              {character.history.map((a) => (
                <li key={a.id} className="admin-log-row">
                  <span className="muted">{dateTimeText(a.createdAt, lang)}</span>
                  <span>{actionText(a, t, lang)}</span>
                  <span className="muted">{a.admin}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
