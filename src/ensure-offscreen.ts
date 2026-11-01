// Shared: create the offscreen document that hosts the wllama decision model.
// Idempotent — a second caller racing in gets "Only a single offscreen
// document…" and treats that as success. The background exposes it to content
// scripts via the `ensure-offscreen` message; the harness page calls it directly.

export async function ensureOffscreen(): Promise<void> {
  try {
    await chrome.offscreen.createDocument({
      url: 'src/offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Hosts the local decision model (wllama) that scores posts.',
    })
  } catch (err) {
    const msg = String((err as Error)?.message ?? err)
    if (!/single offscreen/i.test(msg)) throw err
  }
}
