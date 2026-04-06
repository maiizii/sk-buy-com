// Tremor Tracker [v1.0.0] — Copy-pasted from Tremor Raw official docs
"use client";

import React from "react";
import * as HoverCardPrimitives from "@radix-ui/react-hover-card";

import { cx } from "@/lib/utils";

interface TrackerBlockProps {
  key?: string | number;
  color?: string;
  tooltip?: string;
  hoverEffect?: boolean;
  hoverClassName?: string;
  defaultBackgroundColor?: string;
  disableTooltip?: boolean;
  disableTooltips?: boolean;
}

const Block = ({
  color,
  tooltip,
  defaultBackgroundColor,
  hoverEffect,
  hoverClassName,
  disableTooltip,
  disableTooltips,
}: TrackerBlockProps) => {
  const blockNode = (
    <div className="size-full overflow-hidden px-[0.5px] transition first:rounded-l-[4px] first:pl-0 last:rounded-r-[4px] last:pr-0 sm:px-px">
      <div
        className={cx(
          "size-full rounded-[1px]",
          color || defaultBackgroundColor,
          hoverEffect ? hoverClassName || "hover:opacity-50" : ""
        )}
      />
    </div>
  );

  if (!tooltip || disableTooltip || disableTooltips) {
    return blockNode;
  }

  return (
    <HoverCardPrimitives.Root openDelay={60} closeDelay={40}>
      <HoverCardPrimitives.Trigger asChild>{blockNode}</HoverCardPrimitives.Trigger>
      <HoverCardPrimitives.Portal>
        <HoverCardPrimitives.Content
          sideOffset={10}
          side="top"
          align="center"
          avoidCollisions
          className={cx(
            "z-50 max-w-[220px] rounded-md px-2 py-1 text-sm shadow-md",
            "pointer-events-none select-none",
            "text-white dark:text-gray-900",
            "bg-gray-900 dark:bg-gray-50"
          )}
        >
          {tooltip}
        </HoverCardPrimitives.Content>
      </HoverCardPrimitives.Portal>
    </HoverCardPrimitives.Root>
  );
};

Block.displayName = "Block";

interface TrackerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TrackerBlockProps[];
  defaultBackgroundColor?: string;
  hoverEffect?: boolean;
  hoverClassName?: string;
  disableTooltip?: boolean;
  disableTooltips?: boolean;
}

const Tracker = React.forwardRef<HTMLDivElement, TrackerProps>(
  (
      {
        data = [],
        defaultBackgroundColor = "bg-gray-400 dark:bg-gray-400",
        className,
        hoverEffect,
        hoverClassName,
        disableTooltip,
        disableTooltips,
        ...props
      },
    forwardedRef
  ) => {
    return (
      <div
        ref={forwardedRef}
        className={cx("group flex h-8 w-full items-center", className)}
        {...props}
      >
        {data.map(({ key, ...blockProps }, index) => (
          <Block
            key={key ?? index}
            defaultBackgroundColor={defaultBackgroundColor}
            hoverEffect={hoverEffect}
            hoverClassName={hoverClassName}
            disableTooltip={disableTooltip ?? disableTooltips}
            {...blockProps}
          />
        ))}
      </div>
    );
  }
);

Tracker.displayName = "Tracker";

export { Tracker, type TrackerBlockProps };
