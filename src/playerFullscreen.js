export function exitPlayerFullscreen(target) {
  if (target?.classList.contains("player-expanded")) {
    if (target.hidePopover && target.hasAttribute("popover")) target.hidePopover();
    target.removeAttribute("popover");
    target.classList.remove("player-expanded");
    document.body.classList.remove("player-fullscreen-open");
    return;
  }
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (document.fullscreenElement || document.webkitFullscreenElement)
    return exit?.call(document);
}

export async function togglePlayerFullscreen(target) {
  if (!target) return;
  if (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    target.classList.contains("player-expanded")
  ) {
    await exitPlayerFullscreen(target);
    return;
  }
  const request = target.requestFullscreen || target.webkitRequestFullscreen;
  if (request) {
    try {
      await request.call(target);
      return;
    } catch {
      /* Use viewport expansion when the browser denies fullscreen. */
    }
  }
  target.classList.add("player-expanded");
  document.body.classList.add("player-fullscreen-open");
  // The top layer escapes transformed page ancestors without remounting video.
  if (target.showPopover) {
    target.setAttribute("popover", "manual");
    target.showPopover();
  }
}
