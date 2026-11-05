-- team8_azure.sql already creates media without is_dvd, so only drop it if it is still there.
IF COL_LENGTH('dbo.media', 'is_dvd') IS NOT NULL
    ALTER TABLE dbo.[media] DROP COLUMN [is_dvd];
GO

SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'media';
