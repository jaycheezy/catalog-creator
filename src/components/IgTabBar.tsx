/* Instagram tab bar with crisp SVG icons (the old text glyphs ⌂⚲▣🎬
   rendered inconsistently across platforms). Light style: black icons on
   white, home filled as the active tab. */

export function IgTabBar() {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  return (
    <div className="flex items-center justify-around px-5 pt-2 pb-[10px] border-t border-zinc-100 bg-white shrink-0 text-black">
      {/* home · active = filled */}
      <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor" aria-label="Home">
        <path d="M12 2.7 2.8 10.6c-.35.3-.28.9.14.9H5v9.1c0 .5.4.9.9.9H10v-6h4v6h4.1c.5 0 .9-.4.9-.9v-9.1h2.06c.42 0 .49-.6.14-.9z" />
      </svg>
      {/* search */}
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-label="Search">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4.2-4.2" />
      </svg>
      {/* reels */}
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-label="Reels">
        <rect x="4" y="4.5" width="16" height="15" rx="4.5" />
        <path d="M10.2 9.3l4.8 2.7-4.8 2.7z" fill="currentColor" stroke="none" />
      </svg>
      {/* new post */}
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-label="New post">
        <path d="M12 5.5v13M5.5 12h13" />
      </svg>
      {/* send */}
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-label="Direct messages">
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22l-4-9-9-4z" />
      </svg>
    </div>
  );
}
