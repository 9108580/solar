/**
 * מכין את payload ההגדרות לשמירה בענן: קבצים גדולים (דאטהשיטים, לוגואים, תמונות)
 * עולים ל-Storage; ב-Postgres נשאר JSON קטן — מונע statement timeout.
 */

export const ADMIN_ASSETS_BUCKET = 'admin-assets';

/** מעל ~90KB קובץ מקורי — מעלים ל-Storage במקום base64 ב-jsonb */
export const CLOUD_INLINE_MAX_B64_CHARS = 120_000;

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function normalizeAsset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { fileName, mimeType, dataBase64, storagePath } = raw;
  if (storagePath && typeof storagePath === 'string') {
    return {
      fileName: typeof fileName === 'string' ? fileName : 'file',
      mimeType: typeof mimeType === 'string' ? mimeType : 'application/octet-stream',
      storagePath,
    };
  }
  if (!dataBase64 || typeof dataBase64 !== 'string' || !mimeType || typeof mimeType !== 'string') {
    return null;
  }
  return {
    fileName: typeof fileName === 'string' ? fileName : 'file',
    mimeType,
    dataBase64,
  };
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeStorageSegment(s) {
  return String(s || 'file')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file';
}

async function uploadAsset(supabase, storagePath, asset) {
  const body = base64ToBytes(asset.dataBase64);
  const { error } = await supabase.storage.from(ADMIN_ASSETS_BUCKET).upload(storagePath, body, {
    contentType: asset.mimeType,
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw error;
  return {
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    storagePath,
  };
}

async function maybeExternalize(supabase, asset, storagePath) {
  const n = normalizeAsset(asset);
  if (!n) return null;
  if (n.storagePath) return n;
  if (!n.dataBase64 || n.dataBase64.length <= CLOUD_INLINE_MAX_B64_CHARS) return n;
  return uploadAsset(supabase, storagePath, n);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function prepareAdminPricesForCloud(supabase, payload) {
  if (!supabase || !payload || typeof payload !== 'object') return payload;
  const next = clonePayload(payload);

  next.panelDatasheet = await maybeExternalize(supabase, next.panelDatasheet, 'panel/datasheet');
  next.panelLogo = await maybeExternalize(supabase, next.panelLogo, 'panel/logo');
  next.constructionDatasheet = await maybeExternalize(
    supabase,
    next.constructionDatasheet,
    'construction/datasheet',
  );
  next.constructionLogo = await maybeExternalize(supabase, next.constructionLogo, 'construction/logo');

  if (next.optimizerDatasheets && typeof next.optimizerDatasheets === 'object') {
    const od = { ...next.optimizerDatasheets };
    for (const key of Object.keys(od)) {
      od[key] = await maybeExternalize(supabase, od[key], `optimizers/${safeStorageSegment(key)}/datasheet`);
    }
    next.optimizerDatasheets = od;
  }

  if (next.optimizerLogos && typeof next.optimizerLogos === 'object') {
    const ol = { ...next.optimizerLogos };
    for (const key of Object.keys(ol)) {
      ol[key] = await maybeExternalize(supabase, ol[key], `optimizers/${safeStorageSegment(key)}/logo`);
    }
    next.optimizerLogos = ol;
  }

  const mapInverterList = async (list, prefix) => {
    if (!Array.isArray(list)) return list;
    return Promise.all(
      list.map(async (inv) => {
        const id = safeStorageSegment(inv?.id || 'inv');
        return {
          ...inv,
          datasheet: await maybeExternalize(supabase, inv.datasheet, `${prefix}/${id}/datasheet`),
          customLogo: await maybeExternalize(supabase, inv.customLogo, `${prefix}/${id}/logo`),
        };
      }),
    );
  };

  next.inverters = await mapInverterList(next.inverters, 'inverters');
  next.invertersHybrid = await mapInverterList(next.invertersHybrid, 'inverters-hybrid');

  if (Array.isArray(next.batteries)) {
    next.batteries = await Promise.all(
      next.batteries.map(async (bat) => {
        const id = safeStorageSegment(bat?.id || 'bat');
        return {
          ...bat,
          logo: await maybeExternalize(supabase, bat.logo, `batteries/${id}/logo`),
          datasheet: await maybeExternalize(supabase, bat.datasheet, `batteries/${id}/datasheet`),
        };
      }),
    );
  }

  if (Array.isArray(next.agents)) {
    next.agents = await Promise.all(
      next.agents.map(async (ag) => {
        const id = safeStorageSegment(ag?.tz || ag?.id || 'agent');
        return {
          ...ag,
          photo: await maybeExternalize(supabase, ag.photo, `agents/${id}/photo`),
        };
      }),
    );
  }

  return next;
}

export function publicAdminAssetUrl(storagePath) {
  const base = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/+$/, '');
  if (!base || !storagePath) return null;
  const encoded = String(storagePath)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${base}/storage/v1/object/public/${ADMIN_ASSETS_BUCKET}/${encoded}`;
}
