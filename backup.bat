@echo off
cd /d "C:\Users\ALENT\OneDrive\Documents\Claude\Projects\Kumon CRM\kumon-pwa"
git add .
git commit -m "automated backup %date% %time%"
git push
