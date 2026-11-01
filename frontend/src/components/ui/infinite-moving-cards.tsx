"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "fast",
  pauseOnHover = true,
  className,
}: {
  items: {
    quote: string;
    name: string;
    title: string;
  }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const scroller = scrollerRef.current;
    if (!container || !scroller) return;

    // Avoid adding another copy when React StrictMode runs effects twice in development.
    if (scroller.dataset.duplicated !== "true") {
      for (const item of Array.from(scroller.children)) {
        const duplicate = item.cloneNode(true) as HTMLElement;
        duplicate.setAttribute("aria-hidden", "true");
        scroller.appendChild(duplicate);
      }
      scroller.dataset.duplicated = "true";
    }

    container.style.setProperty(
      "--animation-direction",
      direction === "left" ? "forwards" : "reverse"
    );

    const durations = { fast: "20s", normal: "40s", slow: "80s" };
    container.style.setProperty("--animation-duration", durations[speed]);
    setStart(true);
  }, [direction, speed]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
        className,
        "infinite-moving-cards"
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-4",
          start && "animate-scroll",
          pauseOnHover && "hover:[animation-play-state:paused]",
          "infinite-moving-cards__track",
          pauseOnHover && "infinite-moving-cards__pause"
        )}
      >
        {items.map((item) => (
          <li
            className={cn(
              "relative w-[350px] max-w-full shrink-0 rounded-2xl border border-b-0 border-zinc-200 bg-[linear-gradient(180deg,#fafafa,#f5f5f5)] px-8 py-6 md:w-[450px] dark:border-zinc-700 dark:bg-[linear-gradient(180deg,#272727,#181818)]",
              "infinite-moving-cards__item"
            )}
            key={item.name}
          >
            <blockquote>
              <div
                aria-hidden="true"
                className="user-select-none pointer-events-none absolute -top-0.5 -left-0.5 -z-1 h-[calc(100%_+_4px)] w-[calc(100%_+_4px)]"
              />
              <span className="relative z-20 text-sm leading-[1.6] font-normal text-neutral-800 dark:text-gray-100 infinite-moving-cards__description">
                {item.quote}
              </span>
              <div className="relative z-20 mt-6 flex flex-row items-center infinite-moving-cards__byline">
                <span className="flex flex-col gap-1">
                  <span className="text-sm leading-[1.6] font-normal text-neutral-500 dark:text-gray-400 infinite-moving-cards__name">
                    {item.name}
                  </span>
                  <span className="text-sm leading-[1.6] font-normal text-neutral-500 dark:text-gray-400 infinite-moving-cards__title">
                    {item.title}
                  </span>
                </span>
              </div>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  );
};
