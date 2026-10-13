const GOOGLE_HINT = "obensonflorice2016@gmail.com";
const FOLDER = "Flourish Backups";
const KEEP = 30;

let hooks = { state: () => ({}), patch() {}, note() {} };
let auth = null;
let files = [];
let lastHash = "";
let timer = 0;
let uploading = false;

export function bindCloud(next) {
  hooks = { ...hooks, ...next };
}
export function cloudFiles() {
  return files;
}

export async function cloudBoot() {
  auth = await idbGet("cloud-auth");
  const back = await consumeRedirect();
  const state = hooks.state();
  const hash = await fingerprint(state);
  const today = dayKey(new Date());
  const lastDay = state.lastCloudAt ? dayKey(new Date(state.lastCloudAt)) : "";
  if (back || (signedIn() && lastDay !== today)) await runCloud();
  else lastHash = hash;
}

export function scheduleCloud() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void runCloud();
  }, 5000);
}

export function startSignIn(provider) {
  const id = clientId(provider);
  if (!id) {
    hooks.patch({
      cloudSetup: true,
      cloudError: provider === "microsoft"
        ? "Paste the Microsoft key below, then tap Sign in again."
        : "Google still needs the sign-in key below. Paste it, then tap Sign in again. Your copies stay in your Drive, not with Grok.",
    });
    hooks.reveal?.();
    return;
  }
  let popup = null;
  try {
    popup = window.open("about:blank", "flourish-signin");
  } catch {
    popup = null;
  }
  void sendToProvider(provider, id, popup);
}

export async function cloudSignOut() {
  auth = null;
  files = [];
  await idbSet("cloud-auth", null);
  hooks.patch({ cloudProvider: "", cloudEmail: "", cloudError: "" });
  hooks.note("Signed out. The copies already in your Drive stay there.");
}

export async function openCloudRestore() {
  if (!signedIn()) {
    hooks.note("Sign in first, then restore.");
    return [];
  }
  try {
    await ensureToken();
    files = await listBackups();
    hooks.patch({ cloudError: "" });
    return files;
  } catch (error) {
    hooks.patch({ cloudError: failText(error) });
    hooks.note(failText(error));
    return [];
  }
}

export async function pullCloudFile(id) {
  await ensureToken();
  const text = await downloadFile(id);
  const parsed = JSON.parse(text);
  const data = parsed && parsed.app === "Flourish" && parsed.data ? parsed.data : parsed;
  if (!data || !data.goals) throw new Error("not-flourish");
  return { data, version: Number(parsed.version || data.version || 0) };
}

function signedIn() {
  return !!(auth && (auth.access || auth.refresh));
}
function state() {
  return hooks.state();
}
function clientId(provider) {
  const saved = state().cloudClients || {};
  return String(saved[provider] || "").trim();
}
function redirectUri() {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  return url.href;
}
function payload(current) {
  const data = { ...current, cloudError: "" };
  return data;
}
async function fingerprint(current) {
  const data = payload(current);
  delete data.lastCloudAt;
  delete data.cloudError;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(data)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function stampName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `flourish-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
}
function failText(error) {
  const code = String(error && (error.code || error.message) || "");
  if (code.includes("invalid_client") || code.includes("unauthorized_client")) return "That sign-in key was not accepted. Check the key, and that this page is allowed to redirect.";
  if (code.includes("access_denied")) return "Sign-in was cancelled. Everything is still on this phone.";
  if (code.includes("not-flourish")) return "That cloud file is not a Flourish backup.";
  return "Cloud backup did not save. Everything is still on this phone.";
}

async function sendToProvider(provider, id, popup) {
  try {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    localStorage.setItem("flourish-pkce", JSON.stringify({ verifier, provider }));
    const redirect = redirectUri();
    const url = provider === "microsoft" ? microsoftAuth(id, challenge, redirect) : googleAuth(id, challenge, redirect);
    if (popup && !popup.closed) {
      popup.location.href = url;
      return;
    }
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
    location.assign(url);
  } catch {
    try {
      popup?.close();
    } catch {
      /* ignore */
    }
    hooks.patch({
      cloudError: "Google did not open. Open Flourish in Safari, then tap Sign in again. It cannot sign in inside another app.",
    });
    hooks.reveal?.();
  }
}
function googleAuth(id, challenge, redirect) {
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/drive.file",
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
    login_hint: GOOGLE_HINT,
    state: "google",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}
function microsoftAuth(id, challenge, redirect) {
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    response_type: "code",
    scope: "offline_access Files.ReadWrite User.Read",
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    state: "microsoft",
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${q}`;
}
async function consumeRedirect() {
  const url = new URL(location.href);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (!code && !error) return false;
  const saved = JSON.parse(localStorage.getItem("flourish-pkce") || "null");
  localStorage.removeItem("flourish-pkce");
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  if (error) {
    hooks.patch({ cloudError: failText({ code: error }) });
    return false;
  }
  if (!saved?.verifier) {
    hooks.patch({ cloudError: "Sign-in did not finish. Try again." });
    return false;
  }
  const provider = urlState(saved.provider);
  try {
    auth = await exchange(provider, saved.verifier, code);
    auth.provider = provider;
    auth.email = await accountEmail(provider, auth.access);
    auth.folderId = "";
    await idbSet("cloud-auth", auth);
    hooks.patch({ cloudProvider: provider, cloudEmail: auth.email, cloudError: "", cloudSetup: false });
    if (window.opener && window.opener !== window) {
      window.opener.postMessage({ type: "flourish-cloud" }, location.origin);
      window.close();
    }
    return true;
  } catch (err) {
    hooks.patch({ cloudError: failText(err) });
    return false;
  }
}
function urlState(fallback) {
  return fallback === "microsoft" ? "microsoft" : "google";
}
async function exchange(provider, verifier, code) {
  const body = new URLSearchParams({
    client_id: clientId(provider),
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
  const endpoint = provider === "microsoft" ? "https://login.microsoftonline.com/common/oauth2/v2.0/token" : "https://oauth2.googleapis.com/token";
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(json.error || "token"), { code: json.error || "token" });
  return packToken(json, null);
}
function packToken(json, previous) {
  return {
    provider: previous?.provider || "",
    email: previous?.email || "",
    folderId: previous?.folderId || "",
    access: json.access_token,
    refresh: json.refresh_token || previous?.refresh || "",
    expires: Date.now() + Math.max(60, Number(json.expires_in || 3600) - 90) * 1000,
  };
}
async function ensureToken() {
  if (!auth) throw Object.assign(new Error("signed-out"), { code: "signed-out" });
  if (auth.access && auth.expires > Date.now() + 15000) return auth.access;
  if (!auth.refresh) throw Object.assign(new Error("signed-out"), { code: "signed-out" });
  const provider = auth.provider;
  const body = new URLSearchParams({
    client_id: clientId(provider),
    grant_type: "refresh_token",
    refresh_token: auth.refresh,
  });
  const endpoint = provider === "microsoft" ? "https://login.microsoftonline.com/common/oauth2/v2.0/token" : "https://oauth2.googleapis.com/token";
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(json.error || "refresh"), { code: json.error || "refresh" });
  auth = { ...auth, ...packToken(json, auth), provider, email: auth.email, folderId: auth.folderId };
  await idbSet("cloud-auth", auth);
  return auth.access;
}
async function accountEmail(provider, token) {
  if (provider === "microsoft") {
    const me = await api("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", token);
    return me.mail || me.userPrincipalName || "";
  }
  const me = await api("https://www.googleapis.com/oauth2/v3/userinfo", token);
  return me.email || "";
}
async function api(url, token, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  if (response.status === 204) return {};
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(json.error?.message || json.error || "api"), { code: json.error?.status || json.error || "api" });
  return json;
}

async function runCloud() {
  if (!signedIn() || uploading) return;
  const current = state();
  const hash = await fingerprint(current);
  const today = dayKey(new Date());
  const lastDay = current.lastCloudAt ? dayKey(new Date(current.lastCloudAt)) : "";
  if (hash === lastHash && lastDay === today) return;
  uploading = true;
  try {
    await ensureToken();
    const name = stampName();
    const text = JSON.stringify({ app: "Flourish", version: current.version || 2, exportedAt: new Date().toISOString(), data: payload(current) }, null, 2);
    await upload(name, text);
    await prune();
    lastHash = hash;
    hooks.patch({ lastCloudAt: new Date().toISOString(), cloudError: "", cloudProvider: auth.provider, cloudEmail: auth.email || current.cloudEmail || "" });
  } catch (error) {
    if (String(error && error.code) === "signed-out") return;
    hooks.patch({ cloudError: failText(error) });
  } finally {
    uploading = false;
  }
}
async function upload(name, text) {
  if (auth.provider === "microsoft") return uploadMicrosoft(name, text);
  return uploadGoogle(name, text);
}
async function folderGoogle() {
  if (auth.folderId) return auth.folderId;
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER}' and trashed=false`);
  const found = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`, auth.access);
  if (found.files && found.files[0]) {
    auth.folderId = found.files[0].id;
  } else {
    const created = await api("https://www.googleapis.com/drive/v3/files", auth.access, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER, mimeType: "application/vnd.google-apps.folder" }),
    });
    auth.folderId = created.id;
  }
  await idbSet("cloud-auth", auth);
  return auth.folderId;
}
async function uploadGoogle(name, text) {
  const parent = await folderGoogle();
  const boundary = "flourish_boundary";
  const meta = JSON.stringify({ name, parents: [parent], mimeType: "application/json" });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
  await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", auth.access, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}
async function folderMicrosoft() {
  if (auth.folderId) return auth.folderId;
  const path = encodeURIComponent(FOLDER);
  const probe = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}`, { headers: { Authorization: `Bearer ${auth.access}` } });
  if (probe.ok) {
    const json = await probe.json();
    auth.folderId = json.id;
  } else {
    const created = await api("https://graph.microsoft.com/v1.0/me/drive/root/children", auth.access, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: FOLDER, folder: {}, "@microsoft.graph.conflictBehavior": "replace" }),
    });
    auth.folderId = created.id;
  }
  await idbSet("cloud-auth", auth);
  return auth.folderId;
}
async function uploadMicrosoft(name, text) {
  await folderMicrosoft();
  const path = `${encodeURIComponent(FOLDER)}/${encodeURIComponent(name)}`;
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${auth.access}`, "Content-Type": "application/json" },
    body: text,
  });
  if (!response.ok) throw Object.assign(new Error("upload"), { code: "upload" });
}
async function listBackups() {
  return (await allBackups()).slice(0, KEEP);
}
async function allBackups() {
  if (auth.provider === "microsoft") {
    await folderMicrosoft();
    const path = encodeURIComponent(FOLDER);
    const json = await api(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/children?$select=id,name,lastModifiedDateTime&$top=80`, auth.access);
    return (json.value || [])
      .filter((item) => String(item.name || "").startsWith("flourish-") && String(item.name).endsWith(".json"))
      .sort((a, b) => String(b.name).localeCompare(String(a.name)))
      .map((item) => ({ id: item.id, name: item.name, when: item.lastModifiedDateTime || "" }));
  }
  const parent = await folderGoogle();
  const q = encodeURIComponent(`'${parent}' in parents and trashed=false and name contains 'flourish-'`);
  const json = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=80`, auth.access);
  return (json.files || [])
    .filter((item) => String(item.name || "").endsWith(".json"))
    .sort((a, b) => String(b.name).localeCompare(String(a.name)))
    .map((item) => ({ id: item.id, name: item.name, when: item.modifiedTime || "" }));
}
async function prune() {
  const listed = await allBackups();
  for (const item of listed.slice(KEEP)) {
    if (auth.provider === "microsoft") await api(`https://graph.microsoft.com/v1.0/me/drive/items/${item.id}`, auth.access, { method: "DELETE" });
    else await api(`https://www.googleapis.com/drive/v3/files/${item.id}`, auth.access, { method: "DELETE" });
  }
}
async function downloadFile(id) {
  await ensureToken();
  const url = auth.provider === "microsoft" ? `https://graph.microsoft.com/v1.0/me/drive/items/${id}/content` : `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${auth.access}` } });
  if (!response.ok) throw Object.assign(new Error("download"), { code: "download" });
  return response.text();
}

function b64url(bytes) {
  let raw = "";
  bytes.forEach((b) => {
    raw += String.fromCharCode(b);
  });
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("flourish", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const req = db.transaction("kv", "readonly").objectStore("kv").get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
async function idbSet(key, value) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    if (value == null) tx.objectStore("kv").delete(key);
    else tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function redirectHint() {
  try {
    return redirectUri();
  } catch {
    return "";
  }
}
