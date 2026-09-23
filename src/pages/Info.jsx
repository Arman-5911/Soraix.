import React from "react";
import { Link, useLocation } from "react-router-dom";
const content = {
  about: [
    "Built for the love of anime.",
    "SoraiX connects you to a live anime catalogue, current rankings, upcoming broadcasts and in-site episode playback. Save your favorites without creating an account.",
    "Anime metadata comes from AniList. Full episodes come from the connected video source and play in the SoraiX player. Episode and audio availability depend on the source; a catalogue listing does not guarantee a playable stream.",
  ],
  contact: [
    "Get in touch.",
    "A public support address has not been published for this installation.",
    "For account or playback issues on an external streaming service, contact that provider directly. SoraiX does not manage provider subscriptions or accounts.",
  ],
  privacy: [
    "Your space stays yours.",
    "Your watchlist, local comments, preferences and playback history stay in this browser. SoraiX does not require an account. Clearing browser site data removes these records.",
    "Search queries and catalogue requests pass through the SoraiX server to AniList. Artwork and fonts are loaded from their hosts. Episode lookup sends the anime title to the video provider. Playing an episode connects your browser directly to its video and subtitle servers. Official trailers connect to YouTube. These services receive standard connection data, such as your IP address.",
  ],
  copyright: [
    "Respect the people behind the stories.",
    "Anime titles, artwork and descriptions belong to their respective rights holders. SoraiX uses AniList metadata and a third-party video provider. It is not affiliated with anime studios or the video provider.",
    "SoraiX does not copy episodes from streaming services or bypass their access controls. Configured in-site video sources must be provided with appropriate distribution rights.",
  ],
  terms: [
    "A few things before the journey.",
    "Catalogue data, official streaming links and scheduled broadcasts are supplied by AniList and can change. Streaming availability depends on the source and your region.",
    "Resume history is available for direct streams and configured videos played on SoraiX. Local comments and personal collections are specific to this browser.",
  ],
};
export default function Info({ notFound = false }) {
  const path = useLocation().pathname.slice(1);
  const item = content[path];
  if (notFound || !item)
    return (
      <div className="page error-page">
        <span className="error-number">404</span>
        <h1>A little lost in another dimension.</h1>
        <p>Looks like this episode disappeared into another dimension.</p>
        <div>
          <Link className="button primary" to="/">
            Return home
          </Link>
          <Link className="button secondary" to="/filter">
            Browse anime
          </Link>
        </div>
      </div>
    );
  return (
    <div className="page prose-page">
      <span className="eyebrow">SORAIX · {path.toUpperCase()}</span>
      <h1>{item[0]}</h1>
      {item.slice(1).map((p) => (
        <p key={p}>{p}</p>
      ))}
      <Link className="button secondary" to="/">
        Back to exploring →
      </Link>
    </div>
  );
}
