' Auto-start fitness cloud service silently at logon
' (runs watchdog.js hidden; falls back to "node" in PATH if the bundled path changed)
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
sh.CurrentDirectory = "C:\Users\3c\WorkBuddy\2026-10-08-task-4\cloud"
nodeExe = "C:\Users\3c\.workbuddy\binaries\node\versions\22.12.0\node.exe"
If Not fso.FileExists(nodeExe) Then nodeExe = "node"
sh.Run """" & nodeExe & """ watchdog.js", 0, False
