export function subtitleToVtt(input) {
  const text = String(input)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (text.length > 2 * 1024 * 1024)
    throw new Error("Subtitle file must be smaller than 2 MB.");
  if (!/\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s+-->\s+\d{1,2}:\d{2}/.test(text))
    throw new Error(
      "No valid timed subtitles found. Choose an SRT or WebVTT file.",
    );
  if (/^WEBVTT(?:\s|$)/.test(text)) return text + "\n";
  return (
    "WEBVTT\n\n" +
    text.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2") +
    "\n"
  );
}
