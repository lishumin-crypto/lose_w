' Auto-start fitness cloud service silently at logon
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\3c\WorkBuddy\2026-10-08-task-4\cloud"
sh.Run """C:\Users\3c\.workbuddy\binaries\node\versions\22.12.0\node.exe"" watchdog.js", 0, False
