import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Headphones } from "lucide-react";

export function ReadListenNotice({ onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="coming-soon-dialog"
      aria-labelledby="read-listen-soon"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <Headphones size={34} aria-hidden="true" />
      <span className="eyebrow">SORAIX · COMING SOON</span>
      <h2 id="read-listen-soon">Read &amp; Listen is on its way</h2>
      <p>
        We're getting your chapter audio experience ready. This feature will be
        available soon. You can keep reading manga, manhwa and manhua as usual.
      </p>
      <button className="button primary" onClick={onClose} autoFocus>
        Got it
      </button>
    </dialog>
  );
}
export default function ComingSoon() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <ReadListenNotice onClose={() => navigate("/", { replace: true })} />
    </div>
  );
}
