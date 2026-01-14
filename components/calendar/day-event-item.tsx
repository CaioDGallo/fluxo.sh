"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Invoice01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu"
import {
  type CalendarEventItemProps,
  getPriorityIcon,
  getPriorityColor,
  getStatusConfig,
  formatTime,
  getEventTypeBorderColor,
} from "./calendar-helpers"

export function DayEventItem({
  calendarEvent,
  onEdit,
  onDelete,
  onBillReminderClick,
}: CalendarEventItemProps) {
  const {
    title = 'Untitled',
    start,
    end,
    priority = 'low',
    status = 'scheduled',
    itemType = 'event',
    itemId,
    isAllDay = false,
  } = calendarEvent

  // Format time range
  const timeDisplay = React.useMemo(() => {
    if (isAllDay) {
      return 'All day'
    }

    if (!start || !end) {
      return ''
    }

    const startTime = formatTime(start)
    const endTime = formatTime(end)

    if (!startTime || !endTime) {
      return ''
    }

    return `${startTime} - ${endTime}`
  }, [start, end, isAllDay])

  // Get priority icon and color (not used for bill reminders)
  const PriorityIcon = getPriorityIcon(priority)
  const priorityColor = getPriorityColor(priority)
  const isBillReminder = itemType === 'bill_reminder'

  // Get status badge config
  const statusConfig = getStatusConfig(status, itemType)
  const StatusIcon = statusConfig.icon

  // Event type border color
  const borderColor = getEventTypeBorderColor(itemType)

  // Create accessible label
  const ariaLabel = `${title}${timeDisplay ? ` - ${timeDisplay}` : ''}${priority ? ` - Priority: ${priority}` : ''}${status ? ` - Status: ${status}` : ''}`

  // Handle click for bill reminders
  const handleClick = () => {
    if (isBillReminder && onBillReminderClick && itemId !== undefined) {
      onBillReminderClick(itemId)
    }
  }

  // Handle context menu actions
  const handleEdit = () => {
    if (onEdit && itemId !== undefined) {
      onEdit(itemId, itemType)
    }
  }

  const handleDelete = () => {
    if (onDelete && itemId !== undefined) {
      onDelete(itemId, itemType)
    }
  }

  const eventContent = (
    <div
      className={cn(
        "group/event-item",
        "flex flex-col gap-1.5",
        "px-2 py-1.5",
        "bg-background hover:bg-muted/50",
        "border border-border",
        "border-l-[3px]",
        borderColor,
        "rounded-sm",
        "shadow-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        "dark:shadow-gray-400",
        "transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "cursor-pointer",
        "overflow-hidden",
        "h-full",
        status === 'cancelled' && "line-through opacity-75 bg-red-300/20",
        status === 'completed' && "opacity-40"
      )}
      aria-label={ariaLabel}
      title={title}
      onClick={isBillReminder ? handleClick : undefined}
    >
      {/* Priority | Title | Status */}
      <div className="flex items-center gap-1.5">
        {isBillReminder ? (
          <HugeiconsIcon
            icon={Invoice01Icon}
            className="size-2.5 shrink-0 text-yellow-600 dark:text-yellow-400"
            aria-label="Bill Reminder"
          />
        ) : (
          <HugeiconsIcon
            icon={PriorityIcon}
            className={cn("size-2.5 shrink-0", priorityColor)}
            aria-label={`Priority: ${priority}`}
          />
        )}
        <span
          className={cn(
            "flex-1 text-[11px] font-medium leading-tight truncate",
            status === 'cancelled' && "line-through opacity-60",
            status === 'completed' && "opacity-70"
          )}
        >
          {title}
        </span>
        <Badge
          variant={statusConfig.variant}
          className="text-[8px] px-1.5 py-0.5 h-auto gap-0.5 shrink-0"
          aria-label={`Status: ${status}`}
        >
          <HugeiconsIcon icon={StatusIcon} className="size-2" />
          <span className="hidden sm:inline text-[8px]">{status.replace('_', ' ')}</span>
        </Badge>
      </div>

      {/* Time (if available) */}
      {timeDisplay && (
        <span className="text-[9px] text-muted-foreground font-medium">
          {timeDisplay}
        </span>
      )}
    </div>
  )

  // Bill reminders are view-only, no context menu
  if (isBillReminder) {
    return eventContent
  }

  // If no handlers provided, return without context menu
  if (!onEdit && !onDelete) {
    return eventContent
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {eventContent}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onEdit && (
          <ContextMenuItem onClick={handleEdit}>
            <span>Edit {itemType}</span>
          </ContextMenuItem>
        )}
        {onDelete && (
          <ContextMenuItem variant="destructive" onClick={handleDelete}>
            <span>Delete {itemType}</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
