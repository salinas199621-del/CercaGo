import { useCallback, useEffect, useState, type FormEvent } from "react";
import cercaGoLogo from "../../mobile/public/cercago-logo.png";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
type User = { id: string; name: string; email: string; role: string; active: boolean };
type Store = { id: string; name: string; address: string; owner_name: string; owner_email: string; approved: boolean; active: boolean; commission_rate: number };
type StoreUpdate = { approved?: boolean; active?: boolean; commissionRate?: number };
type Metrics = { users: Array<{ role: string; count: number }>; stores: { total: number; approved: number }; orders: Array<{ status: string; count: number }>; sales: { gross_sales: string; order_count: number } };
type ExchangeRate = { rate: number; source: "BCV"; valueDate: string; updatedAt: string };
type RecoveryStage = "login" | "request" | "confirm";

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${response.status}`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("cercago-admin-token") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryStage, setRecoveryStage] = useState<RecoveryStage>("login");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [commission, setCommission] = useState("10");
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [exchangeRateError, setExchangeRateError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const [nextMetrics, nextStores, nextUsers, setting] = await Promise.all([
        request<Metrics>("/admin/metrics", token),
        request<Store[]>("/admin/stores", token),
        request<User[]>("/admin/users", token),
        request<{ rate: number }>("/admin/settings/commission", token),
      ]);
      setMetrics(nextMetrics);
      setStores(nextStores);
      setUsers(nextUsers);
      setCommission(String(setting.rate));
      try {
        setExchangeRate(await request<ExchangeRate>("/exchange-rate", token));
        setExchangeRateError("");
      } catch (reason) {
        setExchangeRate(null);
        setExchangeRateError(reason instanceof Error ? reason.message : "La tasa del BCV no está disponible.");
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudieron cargar los datos";
      setError(message);
      if (message.includes("Token")) logout();
    } finally { setBusy(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function logout() {
    localStorage.removeItem("cercago-admin-token");
    setToken("");
    setMetrics(null);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar sesión");
      if (result.user.role !== "admin") throw new Error("Esta cuenta no tiene permisos de administración");
      localStorage.setItem("cercago-admin-token", result.token);
      setToken(result.token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión");
    } finally { setBusy(false); }
  }

  async function requestPasswordCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setRecoveryMessage("");
    try {
      const response = await fetch(`${API}/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el código");
      setRecoveryMessage(result.message ?? "Si la cuenta existe, enviaremos un código de recuperación.");
      setRecoveryStage("confirm");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo enviar el código");
    } finally { setBusy(false); }
  }

  async function confirmPasswordReset(event: FormEvent) {
    event.preventDefault();
    setError("");
    setRecoveryMessage("");
    if (recoveryPassword !== recoveryPasswordConfirm) {
      setError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API}/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, code: recoveryCode, password: recoveryPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo cambiar la contraseña");
      setPassword("");
      setRecoveryCode("");
      setRecoveryPassword("");
      setRecoveryPasswordConfirm("");
      setRecoveryStage("login");
      setRecoveryMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar la contraseña");
    } finally { setBusy(false); }
  }

  async function updateStore(store: Store, update: StoreUpdate) {
    try {
      await request(`/admin/stores/${store.id}`, token, { method: "PATCH", body: JSON.stringify(update) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el comercio"); }
  }

  async function toggleUser(user: User) {
    try {
      await request(`/admin/users/${user.id}`, token, { method: "PATCH", body: JSON.stringify({ active: !user.active }) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar el usuario"); }
  }

  async function saveCommission(event: FormEvent) {
    event.preventDefault();
    const rate = Number(commission);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return setError("La comisión debe estar entre 0 y 100.");
    try {
      await request("/admin/settings/commission", token, { method: "PATCH", body: JSON.stringify({ rate }) });
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la comisión"); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await request<{ message: string }>("/auth/password/change", token, {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordMessage(result.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (reason) {
      setPasswordError(reason instanceof Error ? reason.message : "No se pudo cambiar la contraseña.");
    } finally { setPasswordBusy(false); }
  }

  async function refreshExchangeRate() {
    setBusy(true);
    setError("");
    setExchangeRateError("");
    try {
      setExchangeRate(await request<ExchangeRate>("/admin/settings/exchange-rate/refresh", token, { method: "POST" }));
    } catch (reason) {
      setExchangeRateError(reason instanceof Error ? reason.message : "No se pudo consultar la tasa oficial del BCV");
    } finally { setBusy(false); }
  }

  const salesInBolivars = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(metrics?.sales.gross_sales ?? 0) * (exchangeRate?.rate ?? 0));

  if (!token) return (
    <main className="login-shell">
      <div className="login-card">
        <img className="admin-logo" src={cercaGoLogo} alt="CercaGo" />
        <p className="eyebrow">SUPERADMIN</p>
        <h1>Administración</h1>
        {recoveryMessage && <p className="success" role="status">{recoveryMessage}</p>}
        {recoveryStage === "login" && (
          <form onSubmit={(event) => void login(event)}>
            <p>Ingresa con una cuenta autorizada.</p>
            <label>Correo<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
            <button className="text-button" type="button" onClick={() => { setError(""); setRecoveryMessage(""); setRecoveryStage("request"); }}>¿Olvidaste tu contraseña?</button>
          </form>
        )}
        {recoveryStage === "request" && (
          <form onSubmit={(event) => void requestPasswordCode(event)}>
            <p>Te enviaremos un código al correo de tu cuenta.</p>
            <label>Correo<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button disabled={busy}>{busy ? "Enviando…" : "Enviar código"}</button>
            <button className="text-button" type="button" onClick={() => { setError(""); setRecoveryStage("login"); }}>Volver al inicio de sesión</button>
          </form>
        )}
        {recoveryStage === "confirm" && (
          <form onSubmit={(event) => void confirmPasswordReset(event)}>
            <p>Ingresa el código de 6 dígitos enviado a {email} y crea tu nueva contraseña.</p>
            <label>Código<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} required /></label>
            <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={10} maxLength={72} value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} required /><small>Debe tener al menos 10 caracteres.</small></label>
            <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength={10} maxLength={72} value={recoveryPasswordConfirm} onChange={(event) => setRecoveryPasswordConfirm(event.target.value)} required /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button disabled={busy}>{busy ? "Guardando…" : "Cambiar contraseña"}</button>
            <button className="text-button" type="button" onClick={() => { setError(""); setRecoveryStage("request"); }}>Solicitar otro código</button>
          </form>
        )}
      </div>
    </main>
  );

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="topbar-brand"><img className="admin-logo" src={cercaGoLogo} alt="CercaGo" /><div><p className="eyebrow">SUPERADMIN</p><h1>Panel de administración</h1></div></div>
        <button className="outline" onClick={logout}>Cerrar sesión</button>
      </header>
      <section className="panel password-panel">
        <div><h2>Seguridad de la cuenta</h2><p className="muted">Cambia tu contraseña de administrador.</p></div>
        <form onSubmit={(event) => void changePassword(event)}>
          <label>Contraseña actual<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /><small>Debe tener al menos 8 caracteres.</small></label>
          <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
          {passwordError && <p className="error" role="alert">{passwordError}</p>}
          {passwordMessage && <p className="success" role="status">{passwordMessage}</p>}
          <button disabled={passwordBusy}>{passwordBusy ? "Guardando…" : "Cambiar contraseña"}</button>
        </form>
      </section>
      {error && <p className="error">{error}</p>}
      {busy && <p className="muted">Actualizando información…</p>}
      <section className="metrics">
        <article><span>Ventas brutas</span><strong>${Number(metrics?.sales.gross_sales ?? 0).toFixed(2)}</strong><small>Bs. {salesInBolivars}</small></article>
        <article><span>Pedidos no cancelados</span><strong>{metrics?.sales.order_count ?? 0}</strong></article>
        <article><span>Comercios aprobados</span><strong>{metrics?.stores.approved ?? 0} / {metrics?.stores.total ?? 0}</strong></article>
        <article><span>Usuarios registrados</span><strong>{metrics?.users.reduce((sum, item) => sum + item.count, 0) ?? 0}</strong></article>
      </section>
      <section className="panel commission-panel">
        <div><h2>Comisión predeterminada</h2><p className="muted">Valor que se aplica a nuevos comercios.</p></div>
        <form onSubmit={(event) => void saveCommission(event)}>
          <input type="number" min="0" max="100" step="0.01" value={commission} onChange={(event) => setCommission(event.target.value)} aria-label="Porcentaje de comisión" />
          <span>%</span><button>Guardar</button>
        </form>
      </section>
      <section className="panel commission-panel">
        <div>
          <h2>Tasa oficial del BCV</h2>
          <p className="muted">
            {exchangeRate
              ? `1 USD = Bs. ${exchangeRate.rate} · Fecha de valor ${new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${exchangeRate.valueDate}T12:00:00Z`))}`
              : exchangeRateError || "Consultando al BCV…"}
          </p>
        </div>
        <button disabled={busy} onClick={() => void refreshExchangeRate()}>{busy ? "Consultando…" : "Actualizar desde BCV"}</button>
        {exchangeRateError && <p role="status" className="muted">{exchangeRateError}</p>}
      </section>
      <section className="panel">
        <div className="section-heading"><div><h2>Comercios afiliados</h2><p className="muted">Aprobación, disponibilidad y comisión por comercio.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Comercio</th><th>Responsable</th><th>Estado</th><th>Comisión</th><th>Acciones</th></tr></thead>
          <tbody>{stores.map((store) => <tr key={store.id}>
            <td><strong>{store.name}</strong><small>{store.address}</small></td>
            <td>{store.owner_name}<small>{store.owner_email}</small></td>
            <td><span className={`badge ${store.approved && store.active ? "good" : "pending"}`}>{store.approved ? (store.active ? "Aprobado" : "Pausado") : "Pendiente"}</span></td>
            <td>{Number(store.commission_rate).toFixed(2)}%</td>
            <td className="actions">
              {!store.approved && <button className="small" onClick={() => void updateStore(store, { approved: true })}>Aprobar</button>}
              <button className="small outline" onClick={() => void updateStore(store, { active: !store.active })}>{store.active ? "Pausar" : "Activar"}</button>
              <button className="small outline" onClick={() => {
                const value = window.prompt("Comisión del comercio (%)", String(store.commission_rate));
                if (value !== null) void updateStore(store, { commissionRate: Number(value) });
              }}>Comisión</button>
            </td>
          </tr>)}</tbody>
        </table></div>
      </section>
      <section className="panel">
        <div className="section-heading"><div><h2>Usuarios</h2><p className="muted">Clientes, comercios y repartidores.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}>
            <td>{user.name}</td><td>{user.email}</td><td>{user.role}</td>
            <td><span className={`badge ${user.active ? "good" : "pending"}`}>{user.active ? "Activo" : "Desactivado"}</span></td>
            <td>{user.role !== "admin" && <button className="small outline" onClick={() => void toggleUser(user)}>{user.active ? "Desactivar" : "Activar"}</button>}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
    </main>
  );
}
