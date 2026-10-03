# Read & Listen

Select **Read & Listen** in the content dropdown, search Manga/Manhwa/Manhua,
open a title and choose a chapter. The companion and its toolbar toggle appear only
for this route (`listen=1`), which is preserved through chapter/source changes and reloads.
Normal Manga/Manhwa/Manhua browsing and reading history open a distraction-free reader
without narration controls, regardless of any older saved narration preference.

* Free: Tesseract.js performs OCR on the device. Choose the language printed on the page.
  It reads text; it does not translate or infer a story summary. The first run downloads
  OCR models. Image sources must permit browser image access. Browser/system voices
  determine which languages can be spoken and may require an internet connection.
* AI: enter your own Gemini API key in the password field for the current open chapter.
  The key stays in component memory, is never saved to localStorage, and is sent only
  to Google's API in the `x-goog-api-key` header. Do not put an owner/shared API key
  in frontend code. Users supply their own key; this is not a shared site-funded service.
  The selected images are sent to Google only when Prepare is pressed. One request per
  uncached page uses `gemini-3.5-flash-lite`. Quotas, model access and billing depend on
  the user's Google project. No automatic paid generation occurs during navigation.

Prepare one page or the chapter, review/edit the transcript, then listen. Prepared pages
play in chapter order and select their matching picture in single-page layout. Stop/pause,
voice and speed controls are available. Leaving the chapter cancels generation and audio.
Five recent chapter/mode/language transcript groups are saved locally; the normal reader
history retains the current page. Clear chapter narration removes the current group.

AI summaries may misinterpret panels; OCR may misorder speech bubbles. Missing voices,
blocked image access and empty OCR results are surfaced instead of inventing narration.

References: https://github.com/naptha/tesseract.js and
https://ai.google.dev/gemini-api/docs/image-understanding
