@echo off
REM Copy the database to a dated file. Point Windows Task Scheduler at this.
cd /d "%~dp0"
node --no-warnings=ExperimentalWarning -e "import('./db.js').then(m => console.log('Backup: ' + m.backup()))"
