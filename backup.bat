@echo off
cd /d "C:\\Users\\adaml\\kumon-pwa"
git add .
git commit -m "automated backup %date% %time%"
git push
