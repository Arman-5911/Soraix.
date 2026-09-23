import React, { useState } from "react";
import { MessageSquare, Send, ThumbsUp } from "lucide-react";
import { useApp, useLocal } from "./store";
export default function Discussion({ animeId }) {
  const [comments, setComments] = useLocal("comments-" + animeId, []),
    [nickname, setNickname] = useState(""),
    [comment, setComment] = useState(""),
    [spoiler, setSpoiler] = useState(false),
    [tab, setTab] = useState("Newest");
  const { notify } = useApp();
  const ordered = [...comments].sort((a, b) =>
    tab === "Newest" ? b.date - a.date : b.likes - a.likes,
  );
  return (
    <section className="discussion">
      <div className="section-head">
        <div>
          <h2>
            After the episode <MessageSquare size={19} />
          </h2>
          <p>Your thoughts, kept on this browser.</p>
        </div>
        <div className="small-tabs">
          {["Newest", "Popular"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nickname.trim() || !comment.trim()) return;
          setComments((v) => [
            {
              id: crypto.randomUUID(),
              name: nickname.trim().slice(0, 40),
              text: comment.trim().slice(0, 2000),
              spoiler,
              date: Date.now(),
              likes: 0,
              liked: false,
            },
            ...v,
          ]);
          setComment("");
          setSpoiler(false);
          notify("Your comment is saved on this browser");
        }}
      >
        <input
          required
          maxLength={40}
          placeholder="Your nickname"
          aria-label="Nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <textarea
          required
          maxLength={2000}
          placeholder="What did you think? Keep it kind, and mark your spoilers."
          aria-label="Comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div>
          <label>
            <input
              type="checkbox"
              checked={spoiler}
              onChange={(e) => setSpoiler(e.target.checked)}
            />{" "}
            Contains spoilers
          </label>
          <button className="button primary small">
            <Send size={14} /> Post locally
          </button>
        </div>
      </form>
      {!comments.length && (
        <p className="discussion-empty">
          A great story starts a conversation. Be the first, in your own space.
        </p>
      )}
      {ordered.map((c) => (
        <article className="comment" key={c.id}>
          <span className="comment-avatar">
            {c.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{c.name}</strong>
            <small>{new Date(c.date).toLocaleDateString()}</small>
            {c.spoiler ? (
              <details>
                <summary>Spoiler — click to reveal</summary>
                <p>{c.text}</p>
              </details>
            ) : (
              <p>{c.text}</p>
            )}
            <button
              onClick={() =>
                setComments((v) =>
                  v.map((x) =>
                    x.id === c.id
                      ? {
                          ...x,
                          liked: !x.liked,
                          likes: Math.max(0, x.likes + (x.liked ? -1 : 1)),
                        }
                      : x,
                  ),
                )
              }
            >
              <ThumbsUp size={13} fill={c.liked ? "currentColor" : "none"} />{" "}
              {c.likes}
            </button>
            <button
              onClick={() => setComments((v) => v.filter((x) => x.id !== c.id))}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
