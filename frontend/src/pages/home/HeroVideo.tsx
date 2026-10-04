// The hero's product demo: a real screen recording of the application
// (see scripts/demo-video/record_demo.py), with discreet captions on top.
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import cues from "../../assets/demo/demo.json";
import desktopPoster from "../../assets/demo/hero-desktop.jpg";
import desktopVideo from "../../assets/demo/hero-desktop.mp4";
import mobilePoster from "../../assets/demo/hero-mobile.jpg";
import mobileVideo from "../../assets/demo/hero-mobile.mp4";
import { FOCUS, motionDisabled } from "./tokens";

type Variant = "desktop" | "mobile";

// A phone gets a recording of the app's own mobile layout: the desktop film
// scaled down to 340px would be unreadable.
const MEDIA: Record<Variant, { src: string; poster: string; width: number; height: number }> = {
  desktop: { src: desktopVideo, poster: desktopPoster, width: 1440, height: 900 },
  mobile: { src: mobileVideo, poster: mobilePoster, width: 720, height: 1272 },
};

const PHONE_QUERY = "(max-width: 639px)";
const LABEL =
  "Démonstration de MP Maroc : recherche et filtres du catalogue, fiche d'une consultation, suivi, puis préparation de la candidature.";

function currentVariant(): Variant {
  return typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches ? "mobile" : "desktop";
}

export function HeroVideo() {
  const [variant, setVariant] = useState<Variant>(currentVariant);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  // The visitor's own pause wins over the scroll-driven autoplay.
  const [userPaused, setUserPaused] = useState(() => motionDisabled());
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const media = MEDIA[variant];

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setVariant(query.matches ? "mobile" : "desktop");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Play only while on screen, so the film never costs CPU out of view.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || failed || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !userPaused) {
          // Autoplay can be refused (data saver, policy): the poster stays up.
          video.play()?.catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [variant, userPaused, failed]);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      video.play()?.catch(() => undefined);
    } else {
      setUserPaused(true);
      video.pause();
    }
  }

  const cue = playing ? cues[variant].find((item) => time >= item.start && time < item.end) : undefined;
  const phone = variant === "mobile";

  return (
    <figure
      aria-label={LABEL}
      className={`relative mx-auto overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] shadow-[var(--shadow-pop)] ${
        phone ? "max-w-[21rem] rounded-[2rem]" : "rounded-[1.5rem]"
      }`}
      style={{ aspectRatio: `${media.width} / ${media.height}` }}
    >
      {failed ? (
        <img src={media.poster} alt="" width={media.width} height={media.height} className="h-full w-full object-cover" />
      ) : (
        <video
          key={variant}
          ref={videoRef}
          src={media.src}
          poster={media.poster}
          width={media.width}
          height={media.height}
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}

      {cue && (
        <figcaption
          key={cue.text}
          aria-hidden="true"
          className="animate-in pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-4.5rem)] rounded-full bg-[color-mix(in_srgb,var(--color-ink)_88%,transparent)] px-3.5 py-2 text-xs font-semibold leading-4 text-[var(--color-surface)] shadow-card backdrop-blur sm:bottom-5 sm:left-5 sm:px-4 sm:text-sm"
        >
          {cue.text}
        </figcaption>
      )}

      {!failed && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Mettre la démonstration en pause" : "Lire la démonstration"}
          className={`absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--color-ink)_88%,transparent)] text-[var(--color-surface)] shadow-card backdrop-blur transition-opacity hover:opacity-100 motion-reduce:transition-none sm:bottom-5 sm:right-5 ${
            playing ? "opacity-70" : "opacity-100"
          } ${FOCUS}`}
        >
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </button>
      )}
    </figure>
  );
}
