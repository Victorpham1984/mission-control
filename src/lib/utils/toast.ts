// Simple toast notification system
type ToastType = "success" | "error" | "info";

function showToast(message: string, type: ToastType = "info") {
  const el = document.createElement("div");
  const colors = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
  };
  el.className = `fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl text-white text-sm font-medium shadow-xl ${colors[type]} animate-modal`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

export const toast = {
  success: (msg: string) => showToast(msg, "success"),
  error: (msg: string) => showToast(msg, "error"),
  info: (msg: string) => showToast(msg, "info"),
};
