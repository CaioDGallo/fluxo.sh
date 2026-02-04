-- Remove calendar and tasks features
DELETE FROM notification_jobs WHERE item_type <> 'bill_reminder';

ALTER TABLE notification_jobs DROP COLUMN IF EXISTS notification_id;

ALTER TABLE user_settings DROP COLUMN IF EXISTS default_event_offset_minutes;
ALTER TABLE user_settings DROP COLUMN IF EXISTS default_task_offset_minutes;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS recurrence_rules;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS calendar_sources;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type') THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type_new') THEN
      DROP TYPE item_type_new;
    END IF;

    CREATE TYPE item_type_new AS ENUM ('bill_reminder');
    ALTER TABLE notification_jobs
      ALTER COLUMN item_type TYPE item_type_new
      USING item_type::text::item_type_new;
    DROP TYPE item_type;
    ALTER TYPE item_type_new RENAME TO item_type;
  END IF;
END $$;

DROP TYPE IF EXISTS priority;
DROP TYPE IF EXISTS event_status;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS calendar_source_status;
