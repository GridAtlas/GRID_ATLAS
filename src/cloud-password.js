import { createCloudAuthClient } from "./cloud-auth.js?v=1";

const elements = {
  panel: document.querySelector("#cloudPasswordPanel"),
  password: document.querySelector("#cloudNewPassword"),
  confirm: document.querySelector("#cloudNewPasswordConfirm"),
  button: document.querySelector("#cloudSetPasswordButton"),
  status: document.querySelector("#cloudPasswordStatus")
};

let authClient = null;
let busy = false;

function setStatus(message, isError = false) {
  if (!elements.status) return;
  elements.status.textContent = message || "";
  elements.status.classList.toggle("is-error", isError);
}

function render(session) {
  const signedIn = Boolean(session?.access_token);
  if (elements.panel) elements.panel.hidden = !signedIn;
  if (elements.button) elements.button.disabled = busy || !signedIn;
}

async function setPassword() {
  if (!authClient || busy) return;
  const password = elements.password?.value || "";
  const confirm = elements.confirm?.value || "";
  if (password.length < 6) {
    setStatus("パスワードは6文字以上にしてください", true);
    return;
  }
  if (password !== confirm) {
    setStatus("パスワードが一致しません", true);
    return;
  }

  busy = true;
  render({ access_token: "pending" });
  setStatus("パスワードを設定しています…");
  try {
    const { error } = await authClient.auth.updateUser({ password });
    if (error) throw error;
    elements.password.value = "";
    elements.confirm.value = "";
    setStatus("パスワードを設定しました。次回から通常ログインできます");
  } catch (error) {
    setStatus(error?.message || "パスワードの設定に失敗しました", true);
  } finally {
    busy = false;
    const { data } = await authClient.auth.getSession();
    render(data?.session);
  }
}

async function initialize() {
  if (!elements.panel || !elements.button) return;
  authClient = await createCloudAuthClient();
  if (!authClient) return;
  elements.button.addEventListener("click", () => void setPassword());
  authClient.auth.onAuthStateChange((_event, session) => render(session));
  const { data } = await authClient.auth.getSession();
  render(data?.session);
}

void initialize();
