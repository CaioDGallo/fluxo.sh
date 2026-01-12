"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"
import {
  type CalendarEventItemProps,
  getPriorityIcon,
  getPriorityColor,
  getStatusConfig,
  formatTime,
  getEventTypeBorderColor,
} from "./calendar-helpers"

export function MonthGridEventItem({
  calendarEvent,
  onEdit,
}: Omit<CalendarEventItemProps, 'onDelete'>) {
  const {
    title = 'Untitled',
    start,
    priority = 'low',
    status = 'scheduled',
    itemType = 'event',
    itemId,
    isAllDay = false,
  } = calendarEvent

  // Format start time (compact)
  const timeDisplay = React.useMemo(() => {
    if (isAllDay) return ''
    if (!start) return ''
    const time = formatTime(start)
    return time || ''
  }, [start, isAllDay])

  // Get priority icon and color
  const PriorityIcon = getPriorityIcon(priority)
  const priorityColor = getPriorityColor(priority)

  // Get status icon
  const statusConfig = getStatusConfig(status, itemType)
  const StatusIcon = statusConfig.icon

  // Event type border color
  const borderColor = getEventTypeBorderColor(itemType)

  // Create accessible label
  const ariaLabel = `${title}${timeDisplay ? ` - ${timeDisplay}` : ''}${priority ? ` - Priority: ${priority}` : ''}${status ? ` - Status: ${status}` : ''}`

  // Handle click to edit (no context menu in grid view, too small)
  const handleClick = () => {
    if (onEdit && itemId !== undefined) {
      onEdit(itemId, itemType)
    }
  }

  return (
    <div
      className={cn(
        "group/event-item",
        "flex items-center gap-1",
        "px-1.5 py-0.5",
        "bg-background hover:bg-muted/50",
        "border border-border",
        "border-l-[2px]",
        borderColor,
        "rounded-sm",
        "transition-colors",
        "cursor-pointer",
        "overflow-hidden",
        "w-full",
        status === 'cancelled' && "line-through opacity-75 bg-red-300/20",
        status === 'completed' && "opacity-40"
      )}
      aria-label={ariaLabel}
      title={`${title}${timeDisplay ? ` - ${timeDisplay}` : ''}`}
      onClick={handleClick}
    >
      {/* Time (if not all day) */}
      {timeDisplay && (
        <span className="text-[8px] text-muted-foreground font-medium whitespace-nowrap shrink-0">
          {timeDisplay}
        </span>
      )}

      {/* Priority dot */}
      <HugeiconsIcon
        icon={PriorityIcon}
        className={cn("size-2 shrink-0", priorityColor)}
        aria-label={`Priority: ${priority}`}
      />

      {/* Title */}
      <span
        className={cn(
          "flex-1 text-[9px] font-medium truncate",
          status === 'cancelled' && "line-through opacity-60",
          status === 'completed' && "opacity-70"
        )}
      >
        {title}
      </span>

      {/* Status icon */}
      <HugeiconsIcon
        icon={StatusIcon}
        className="size-2 shrink-0 text-muted-foreground"
        aria-label={`Status: ${status}`}
      />
    </div>
  )
}
