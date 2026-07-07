-- DOWN 0009: elimina churn_log. (SQLite no soporta DROP COLUMN simple para
-- subscriptions.canceled_at — la columna extra es inocua si se revierte.)
DROP TABLE IF EXISTS churn_log;
