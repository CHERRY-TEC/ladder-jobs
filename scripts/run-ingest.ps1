# Ladder feed ingestion — Windows Task Scheduler wrapper.
#
# Register a daily run (07:47 local time):
#   schtasks /create /tn "LadderFeedIngest" /sc daily /st 07:47 /tr "powershell -NoProfile -ExecutionPolicy Bypass -File \"C:\Users\HANMANTH\ladder-jobs\scripts\run-ingest.ps1\""
#
# Remove it later with:
#   schtasks /delete /tn "LadderFeedIngest"
#
# Prefer cloud scheduling? Push the repo to GitHub — .github/workflows/ingest.yml
# runs the same ingest daily without this machine being on.

Set-Location -Path (Join-Path $PSScriptRoot '..')
node scripts\ingest-jobs.mjs *>> scripts\ingest.log
