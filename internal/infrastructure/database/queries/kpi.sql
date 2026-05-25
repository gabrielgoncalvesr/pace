-- name: GetKPICurrentValue :one
SELECT COALESCE(SUM(value), 0) AS current_value
FROM kpi_entries
WHERE kpi_id = ? AND entry_date BETWEEN ? AND ?;
